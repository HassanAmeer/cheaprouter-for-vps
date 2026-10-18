/**
 * API: OpenAPI Spec
 * GET — returns the parsed openapi.yaml as structured JSON catalog
 */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as yaml from "js-yaml";
import { sanitizeErrorMessage } from "@cheaproute/open-sse/utils/error";
import { getEndpointCategory } from "@/shared/utils/apiEndpointCategories";

let cachedSpec: { data: any; mtime: number } | null = null;
const OPENAPI_SPEC_CANDIDATES = [
  path.join(/* turbopackIgnore: true */ process.cwd(), "docs", "openapi.yaml"),
  path.join(/* turbopackIgnore: true */ process.cwd(), "app", "docs", "openapi.yaml"),
  // Legacy locations kept as fallback for old standalone bundles (pre-#4781 move
  // from docs/reference/openapi.yaml to the canonical docs/openapi.yaml).
  path.join(/* turbopackIgnore: true */ process.cwd(), "docs", "reference", "openapi.yaml"),
  path.join(/* turbopackIgnore: true */ process.cwd(), "app", "docs", "reference", "openapi.yaml"),
];

/**
 * Generate example value from OpenAPI schema.
 *
 * Exported for unit testing: the dashboard "Try It" panel pre-fills request
 * bodies from this. Bounded to depth 3 to prevent infinite recursion on
 * self-referential `$ref` schemas.
 */
export function generateExampleFromSchema(
  schema: any,
  components: any,
  depth = 0,
  propertyName = ""
): any {
  if (!schema || depth > 3) return null; // Prevent infinite recursion

  // Use example if provided
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return generateExampleFromSchema(schema.oneOf[0], components, depth + 1, propertyName);
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return generateExampleFromSchema(schema.anyOf[0], components, depth + 1, propertyName);
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return schema.allOf.reduce((acc: any, item: any) => {
      const value = generateExampleFromSchema(item, components, depth + 1, propertyName);
      return value && typeof value === "object" && !Array.isArray(value)
        ? { ...acc, ...value }
        : acc;
    }, {});
  }

  // Handle $ref
  if (schema.$ref) {
    const refPath = schema.$ref.replace("#/components/schemas/", "");
    return generateExampleFromSchema(components[refPath], components, depth + 1, propertyName);
  }

  // Handle type
  switch (schema.type) {
    case "string":
      if (schema.enum) return schema.enum[0];
      if (schema.format === "date-time") return "2024-01-01T00:00:00Z";
      if (schema.format === "email") return "user@example.com";
      if (schema.format === "uri") return "https://example.com";
      if (/model/i.test(propertyName)) return "openai/gpt-4o";
      if (/prompt/i.test(propertyName)) return "Write a function to sort an array";
      if (/system/i.test(propertyName)) return "You are a concise, helpful assistant.";
      if (/query/i.test(propertyName)) return "What is the capital of France?";
      if (/input|text|content/i.test(propertyName)) return "Sample text";
      if (/provider/i.test(propertyName)) return "openai";
      if (/url/i.test(propertyName)) return "https://example.com";
      return "string";

    case "number":
    case "integer":
      return schema.default !== undefined ? schema.default : schema.minimum || 0;

    case "boolean":
      return schema.default !== undefined ? schema.default : false;

    case "array":
      if (schema.items) {
        const item = generateExampleFromSchema(schema.items, components, depth + 1, propertyName);
        return item ? [item] : [];
      }
      return [];

    case "object":
      const obj: any = {};
      if (schema.properties) {
        const required = schema.required || [];
        // Include required fields + first 3 optional fields
        const propsToInclude = [
          ...required,
          ...Object.keys(schema.properties)
            .filter((k) => !required.includes(k))
            .slice(0, 3),
        ];

        for (const key of propsToInclude) {
          const propSchema = schema.properties[key];
          obj[key] = generateExampleFromSchema(propSchema, components, depth + 1, key);
        }
      }
      return obj;

    default:
      return null;
  }
}

export async function GET() {
  try {
    let specPath = "";
    for (const p of OPENAPI_SPEC_CANDIDATES) {
      if (fs.existsSync(p)) {
        specPath = p;
        break;
      }
    }

    if (!specPath) {
      return NextResponse.json({ error: "openapi.yaml not found" }, { status: 404 });
    }

    const stat = fs.statSync(specPath);
    const mtime = stat.mtimeMs;

    // Use cache if file hasn't changed
    if (cachedSpec && cachedSpec.mtime === mtime) {
      return NextResponse.json(cachedSpec.data);
    }

    const content = fs.readFileSync(specPath, "utf-8");
    const raw: any = yaml.load(content);

    // Build a structured catalog
    const catalog: any = {
      info: raw.info || {},
      servers: raw.servers || [],
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      endpoints: [] as any[],
      schemas: Object.keys(raw.components?.schemas || {}),
    };

    // Parse paths into flat endpoint list
    const paths = raw.paths || {};
    for (const [pathStr, methods] of Object.entries(paths as Record<string, any>)) {
      if (!methods || typeof methods !== "object") continue;
      for (const [method, spec] of Object.entries(methods as Record<string, any>)) {
        if (["get", "post", "put", "patch", "delete"].includes(method) && spec) {
          // Extract example from request body schema if available
          let exampleBody: any = null;
          const jsonBody = spec.requestBody?.content?.["application/json"];
          if (jsonBody?.example !== undefined) {
            exampleBody = jsonBody.example;
          } else if (jsonBody?.examples && typeof jsonBody.examples === "object") {
            const firstExample = Object.values(jsonBody.examples)[0] as any;
            exampleBody = firstExample?.value ?? firstExample;
          } else if (jsonBody?.schema) {
            exampleBody = generateExampleFromSchema(jsonBody.schema, raw.components?.schemas || {});
          }

          const endpointTags = Array.isArray(spec.tags) ? spec.tags : [];
          catalog.endpoints.push({
            method: method.toUpperCase(),
            path: pathStr,
            tags: endpointTags,
            category: getEndpointCategory(pathStr, endpointTags),
            summary: spec.summary || "",
            description: spec.description || "",
            security: spec.security ? true : false,
            parameters: spec.parameters || [],
            requestBody: spec.requestBody ? true : false,
            exampleBody,
            responses: Object.keys(spec.responses || {}),
            loopbackOnly: spec["x-loopback-only"] === true,
            alwaysProtected: spec["x-always-protected"] === true,
            internal: spec["x-internal"] === true,
          });
        }
      }
    }

    // Ensure Reseller & BYOK endpoints are fully represented in catalog
    // Ensure Reseller & BYOK endpoints are fully represented in catalog
    const hasResellerUsers = catalog.endpoints.some((e: any) => e.path === "/api/v1/reseller/users");
    if (!hasResellerUsers) {
      catalog.endpoints.push(
        {
          method: "GET",
          path: "/api/v1/reseller/users",
          tags: ["Reseller", "User Accounts"],
          category: "reseller",
          summary: "List All Reseller Users, Key Roster & Piped Models",
          description: "Returns all registered users with token budgets, consumption, RPM limits, attached BYOK keys, generated native API keys, and active piped models & combos. Pass ?userId=... to fetch a single user's profile and model usage breakdown.",
          security: false,
          parameters: [
            {
              name: "userId",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Optional UID to fetch single user profile, keys, and model usage breakdown",
            },
          ],
          requestBody: false,
          responses: ["200", "404", "500"],
          loopbackOnly: false,
          alwaysProtected: false,
          internal: false,
        },
        {
          method: "POST",
          path: "/api/v1/reseller/users",
          tags: ["Reseller", "User Accounts"],
          category: "reseller",
          summary: "Register User / Upgrade or Downgrade Plan (action: upsertUser)",
          description: "Create a user account or modify an existing user's plan tier, token budget, and RPM limit upon signup or subscription upgrade.",
          security: false,
          parameters: [],
          requestBody: true,
          exampleBody: {
            action: "upsertUser",
            userId: "usr_1001",
            userName: "Hasan Ali",
            userEmail: "hasan@example.com",
            plan: "Pro",
            tokenBudget: 50000000,
            rpmLimit: 60,
            isBanned: false,
          },
          responses: ["200", "400", "500"],
          loopbackOnly: false,
          alwaysProtected: false,
          internal: false,
        },
        {
          method: "POST",
          path: "/api/v1/reseller/users",
          tags: ["Reseller", "Quotas & Limits"],
          category: "reseller",
          summary: "Update Token Budget, RPM & Per-Model Quotas (action: updateQuota)",
          description: "Modify user's total token budget, RPM limit, or set custom token quotas per model (e.g. 100M tokens on specific models). Pass resetUsage: true on subscription renewals.",
          security: false,
          parameters: [],
          requestBody: true,
          exampleBody: {
            action: "updateQuota",
            userId: "usr_1001",
            plan: "Pro",
            tokenBudget: 100000000,
            rpmLimit: 60,
            modelQuotas: {
              "openai/gpt-4o": 50000000,
              "claude-3-5-sonnet": 50000000,
            },
            resetUsage: false,
          },
          responses: ["200", "400", "500"],
          loopbackOnly: false,
          alwaysProtected: false,
          internal: false,
        },
        {
          method: "POST",
          path: "/api/v1/reseller/users",
          tags: ["Reseller", "User Accounts"],
          category: "reseller",
          summary: "Suspend or Reactivate User Account (action: setBanStatus)",
          description: "Instantly suspend (ban) or reactivate a user account. Banning blocks all associated API keys immediately.",
          security: false,
          parameters: [],
          requestBody: true,
          exampleBody: {
            action: "setBanStatus",
            userId: "usr_1001",
            isBanned: true,
          },
          responses: ["200", "400", "500"],
          loopbackOnly: false,
          alwaysProtected: false,
          internal: false,
        },
        {
          method: "POST",
          path: "/api/v1/reseller/users",
          tags: ["Reseller", "User API Keys"],
          category: "reseller",
          summary: "Issue Native API Key for User (action: createKey)",
          description: "Generate a new native API key tied to the user's account pool with allowed models, optional key budget, and RPM limit.",
          security: false,
          parameters: [],
          requestBody: true,
          exampleBody: {
            action: "createKey",
            userId: "usr_1001",
            userName: "Hasan Ali",
            userEmail: "hasan@example.com",
            plan: "Pro",
            allowedModels: ["openai/gpt-4o", "claude-3-5-sonnet"],
            tokenBudget: 50000000,
            rpmLimit: 30,
          },
          responses: ["201", "400", "403", "500"],
          loopbackOnly: false,
          alwaysProtected: false,
          internal: false,
        },
        {
          method: "POST",
          path: "/api/v1/reseller/users",
          tags: ["Reseller", "BYOK"],
          category: "reseller",
          summary: "Register / Attach User BYOK Provider Key (action: addByok)",
          description: "Register an external provider API key for a user (OpenAI, Anthropic, Gemini, Grok, etc.) to enable Bring-Your-Own-Key pass-through.",
          security: false,
          parameters: [],
          requestBody: true,
          exampleBody: {
            action: "addByok",
            userId: "usr_1001",
            providerId: "anthropic",
            apiKey: "sk-ant-api03-abcdef...1234",
          },
          responses: ["201", "400", "500"],
          loopbackOnly: false,
          alwaysProtected: false,
          internal: false,
        },
        {
          method: "POST",
          path: "/api/v1/reseller/users",
          tags: ["Reseller", "BYOK"],
          category: "reseller",
          summary: "Pause or Resume User BYOK Provider Key (action: pauseByok)",
          description: "Temporarily pause or reactivate an attached BYOK key without deleting it.",
          security: false,
          parameters: [],
          requestBody: true,
          exampleBody: {
            action: "pauseByok",
            userId: "usr_1001",
            providerId: "anthropic",
            paused: true,
          },
          responses: ["200", "400", "500"],
          loopbackOnly: false,
          alwaysProtected: false,
          internal: false,
        },
        {
          method: "DELETE",
          path: "/api/v1/reseller/users",
          tags: ["Reseller", "User Accounts"],
          category: "reseller",
          summary: "Delete User Account, API Key, or BYOK Key",
          description: "Delete an entire user account (?userId=...), revoke a native API key (?id=...), or delete an attached BYOK key (?byokId=...).",
          security: false,
          parameters: [
            {
              name: "userId",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "The user ID (UID) to delete (removes account, all keys and BYOK)",
            },
            {
              name: "id",
              in: "query",
              required: false,
              schema: { type: "integer" },
              description: "Row ID of the native user API key to revoke and delete",
            },
            {
              name: "byokId",
              in: "query",
              required: false,
              schema: { type: "integer" },
              description: "Row ID of the BYOK provider key to delete",
            },
          ],
          requestBody: false,
          responses: ["200", "400", "500"],
          loopbackOnly: false,
          alwaysProtected: false,
          internal: false,
        }
      );
    }

    const hasResellerByok = catalog.endpoints.some((e: any) => e.path === "/api/v1/reseller/byok");
    if (!hasResellerByok) {
      catalog.endpoints.push(
        {
          method: "GET",
          path: "/api/v1/reseller/byok",
          tags: ["Reseller", "BYOK"],
          category: "reseller",
          summary: "Get BYOK Master Toggle State",
          description: "Check if Bring-Your-Own-Key pass-through is globally enabled.",
          security: true,
          parameters: [],
          requestBody: false,
          responses: ["200", "401", "500"],
          loopbackOnly: false,
          alwaysProtected: false,
          internal: false,
        },
        {
          method: "POST",
          path: "/api/v1/reseller/byok",
          tags: ["Reseller", "BYOK"],
          category: "reseller",
          summary: "Update BYOK Master Toggle State",
          description: "Enable or disable Bring-Your-Own-Key pass-through globally.",
          security: true,
          parameters: [],
          requestBody: true,
          exampleBody: {
            byokEnabled: true,
          },
          responses: ["200", "400", "401", "500"],
          loopbackOnly: false,
          alwaysProtected: false,
          internal: false,
        }
      );
    }

    const existingTagNames = new Set(catalog.tags.map((t: any) => t.name));
    if (!existingTagNames.has("Reseller")) {
      catalog.tags.push({ name: "Reseller", description: "Reseller and multi-tenant management endpoints" });
    }
    if (!existingTagNames.has("User Accounts")) {
      catalog.tags.push({ name: "User Accounts", description: "User registration, plans, and quota balances" });
    }

    cachedSpec = { data: catalog, mtime };

    return NextResponse.json(catalog);
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) || "Failed to parse OpenAPI spec" },
      { status: 500 }
    );
  }
}
