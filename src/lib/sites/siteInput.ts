/**
 * Shared validation + label helpers for the multi-tenant site registry
 * (`config/sites.json` + the `sites` table).
 *
 * The API route, the dashboard dropdown and the sidebar switcher must agree on
 * what a valid site name / subdomain is — a rule enforced in one place instead
 * of three copies drifting apart.
 */
import { z } from "zod";

export interface SiteLike {
  id: string;
  name: string;
  subdomains: string[];
}

/** Max counts mirror the route schemas (`/api/sites`, `/api/sites/[id]`). */
export const SITE_NAME_MAX = 120;
export const SITE_SUBDOMAINS_MAX = 50;
export const SITE_SUBDOMAIN_MAX = 253;

const subdomainSchema = z
  .string()
  .trim()
  .min(1)
  .max(SITE_SUBDOMAIN_MAX)
  .transform((value) => value.toLowerCase())
  .refine((value) => {
    // Format: a bare host, a wildcard host (`*.example.com`) or a host with a
    // port (`localhost:20128`) — never a scheme or a path.
    if (
      !/^(?:\*\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*(?::\d{1,5})?$/.test(
        value
      )
    ) {
      return false;
    }
    // A bare single-label host (e.g. "localhost") is only allowed with a
    // port; multi-label hosts are allowed without one.
    const host = value.replace(/^\*\./, "").split(":")[0] ?? "";
    if (host.includes(".")) return true;
    return /:\d{1,5}$/.test(value);
  }, "Use a host like app.example.com, *.example.com or localhost:20128");

export const siteNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(SITE_NAME_MAX)
  .transform((value) => value.replace(/\s+/g, " "));

/**
 * The label shown next to a site when the operator did not type one.
 *
 * Adding a website is ONE field — the domain. The name is therefore derived
 * from the first host (`*.example.com` → `example.com`,
 * `shop.example.com` → `shop.example.com`) instead of asking for a second,
 * purely cosmetic value.
 */
export function deriveSiteName(subdomains: string[]): string {
  const first = (subdomains[0] ?? "").trim();
  const host = first.replace(/^\*\./, "").replace(/:\d{1,5}$/, "");
  return host || "site";
}

/** An empty string means "not provided" (the form no longer sends a name). */
const optionalSiteName = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  siteNameSchema.optional()
);

export const addSiteSchema = z
  .object({
    name: optionalSiteName,
    subdomains: z.array(subdomainSchema).min(1).max(SITE_SUBDOMAINS_MAX),
  })
  .transform((value) => ({
    name: value.name && value.name.trim() ? value.name : deriveSiteName(value.subdomains),
    subdomains: value.subdomains,
  }));

export type AddSiteInput = z.infer<typeof addSiteSchema>;

export type AddSiteResult =
  { ok: true; name: string; subdomains: string[] } | { ok: false; error: string };

/** Parse + normalize operator input (dashboard form or API body). */
export function parseNewSite(input: { name?: unknown; subdomains: unknown }): AddSiteResult {
  const subdomains = Array.isArray(input.subdomains)
    ? input.subdomains
    : typeof input.subdomains === "string"
      ? input.subdomains.split(/[\s,]+/)
      : input.subdomains;

  const parsed = addSiteSchema.safeParse({ name: input.name, subdomains });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message === "Invalid site" ? issue.message : (issue?.message ?? "Invalid site"),
    };
  }
  return { ok: true, name: parsed.data.name, subdomains: parsed.data.subdomains };
}
