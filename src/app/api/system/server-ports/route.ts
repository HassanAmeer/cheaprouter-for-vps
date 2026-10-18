/**
 * GET  /api/system/server-ports  — Discover active listening TCP ports & running AI/CLI services
 * POST /api/system/server-ports  — Test live HTTP connectivity and latency to a given host/port
 *
 * Security: Requires authenticated session or valid API authorization.
 */

import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import net from "node:net";
import { isAuthenticated } from "@/shared/utils/apiAuth";

const execFileAsync = promisify(execFile);

export const dynamic = "force-dynamic";

export interface DiscoveredPort {
  ip: string;
  port: number;
  protocol: "tcp";
  service: string;
  category: "ai-cli" | "ai-local" | "router" | "system" | "custom";
  isAiService: boolean;
  pid: number | null;
  processName: string;
  cmdline: string;
  suggestedBaseUrl: string;
  status: "listening";
}

function normalizeIpForUrl(ip: string): string {
  if (ip === "0.0.0.0" || ip === "::" || ip === "127.0.0.1" || ip === "localhost") {
    return "127.0.0.1";
  }
  if (ip.startsWith("127.0.0.")) {
    return ip;
  }
  return ip;
}

function identifyService(
  port: number,
  normalizedIp: string,
  cmdline: string,
  procName: string
): {
  service: string;
  category: DiscoveredPort["category"];
  isAiService: boolean;
  suggestedBaseUrl: string;
} {
  const lowerCmd = (cmdline + " " + procName).toLowerCase();

  if (port === 8377 || lowerCmd.includes("antseed")) {
    return {
      service: "Antseed P2P AI Network",
      category: "ai-cli",
      isAiService: true,
      suggestedBaseUrl: `http://${normalizedIp}:${port}/v1`,
    };
  }

  if (
    port === 4099 ||
    port === 4096 ||
    (lowerCmd.includes("opencode") && lowerCmd.includes("serve")) ||
    procName.includes("opencode")
  ) {
    return {
      service: "OpenCode CLI Server",
      category: "ai-cli",
      isAiService: true,
      suggestedBaseUrl: `http://${normalizedIp}:${port}`,
    };
  }

  if (
    port === 4098 ||
    (lowerCmd.includes("kilo") && lowerCmd.includes("serve")) ||
    procName.includes("kilo")
  ) {
    return {
      service: "Kilo Code CLI Server",
      category: "ai-cli",
      isAiService: true,
      suggestedBaseUrl: `http://${normalizedIp}:${port}`,
    };
  }

  if (lowerCmd.includes("antigravity")) {
    return {
      service: "Google Antigravity CLI / Language Server",
      category: "ai-cli",
      isAiService: true,
      suggestedBaseUrl: `http://${normalizedIp}:${port}`,
    };
  }

  if (port === 11434 || lowerCmd.includes("ollama")) {
    return {
      service: "Ollama Local LLM",
      category: "ai-local",
      isAiService: true,
      suggestedBaseUrl: `http://${normalizedIp}:${port}/v1`,
    };
  }

  if (port === 1234 || lowerCmd.includes("lmstudio") || lowerCmd.includes("lms")) {
    return {
      service: "LM Studio Server",
      category: "ai-local",
      isAiService: true,
      suggestedBaseUrl: `http://${normalizedIp}:${port}/v1`,
    };
  }

  if (port === 8000 || lowerCmd.includes("vllm")) {
    return {
      service: "vLLM Inference Engine",
      category: "ai-local",
      isAiService: true,
      suggestedBaseUrl: `http://${normalizedIp}:${port}/v1`,
    };
  }

  if (port === 8080 || lowerCmd.includes("llama-server") || lowerCmd.includes("llamafile")) {
    return {
      service: "llama.cpp Server",
      category: "ai-local",
      isAiService: true,
      suggestedBaseUrl: `http://${normalizedIp}:${port}/v1`,
    };
  }

  if (port === 8188 || lowerCmd.includes("comfyui")) {
    return {
      service: "ComfyUI Image Generation",
      category: "ai-local",
      isAiService: true,
      suggestedBaseUrl: `http://${normalizedIp}:${port}`,
    };
  }

  if (port === 9997 || lowerCmd.includes("xinference")) {
    return {
      service: "Xinference Local Server",
      category: "ai-local",
      isAiService: true,
      suggestedBaseUrl: `http://${normalizedIp}:${port}/v1`,
    };
  }

  if (
    port === 20128 ||
    lowerCmd.includes("cheaproute") ||
    (lowerCmd.includes("next") && port === 20128)
  ) {
    return {
      service: "CheapRouter Gateway (Current Instance)",
      category: "router",
      isAiService: true,
      suggestedBaseUrl: `http://${normalizedIp}:${port}/v1`,
    };
  }

  if (port === 5432 || lowerCmd.includes("postgres")) {
    return {
      service: "PostgreSQL Database",
      category: "system",
      isAiService: false,
      suggestedBaseUrl: `http://${normalizedIp}:${port}`,
    };
  }

  if (port === 631 || lowerCmd.includes("cups")) {
    return {
      service: "CUPS Print System",
      category: "system",
      isAiService: false,
      suggestedBaseUrl: `http://${normalizedIp}:${port}`,
    };
  }

  if (port === 53 || lowerCmd.includes("systemd-resolve")) {
    return {
      service: "System DNS Resolver",
      category: "system",
      isAiService: false,
      suggestedBaseUrl: `http://${normalizedIp}:${port}`,
    };
  }

  // Generic or unknown service
  return {
    service: procName ? `${procName} (port ${port})` : `Listening Port ${port}`,
    category: "custom",
    isAiService: false,
    suggestedBaseUrl: `http://${normalizedIp}:${port}/v1`,
  };
}

/** Probe standard AI ports via TCP socket in parallel when ss is unavailable or as complement */
async function probePortTcp(host: string, port: number, timeoutMs = 250): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isSettled = false;
    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      if (!isSettled) {
        isSettled = true;
        socket.destroy();
        resolve(true);
      }
    });

    socket.on("timeout", () => {
      if (!isSettled) {
        isSettled = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.on("error", () => {
      if (!isSettled) {
        isSettled = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.connect(port, host);
  });
}

async function checkAuth(req: NextRequest): Promise<boolean> {
  if (await isAuthenticated(req)) return true;
  const apiKey = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (apiKey) {
    try {
      const { validateApiKey } = await import("@/lib/db/apiKeys");
      if (await validateApiKey(apiKey)) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

export async function GET(req: NextRequest) {
  if (!(await checkAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const portsMap = new Map<string, DiscoveredPort>();

  // 1. Try Linux `ss` command for fast, complete socket inspection
  try {
    const { stdout } = await execFileAsync("ss", ["-H", "-t", "-l", "-p", "-n"], {
      encoding: "utf8",
      timeout: 3000,
    });

    const lines = stdout.trim().split("\n");
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const localAddr = parts[3];
      if (!localAddr) continue;

      let ip = "127.0.0.1";
      let port = 0;

      if (localAddr.startsWith("[")) {
        const match = localAddr.match(/\[([^\]]+)\]:(\d+)/);
        if (match) {
          ip = match[1];
          port = parseInt(match[2], 10);
        }
      } else {
        const lastColon = localAddr.lastIndexOf(":");
        if (lastColon !== -1) {
          ip = localAddr.slice(0, lastColon);
          port = parseInt(localAddr.slice(lastColon + 1), 10);
        }
      }

      if (!port || isNaN(port) || port <= 0 || port > 65535) continue;

      // Extract PID and Process Name from users:(("...",pid=...,fd=...))
      let pid: number | null = null;
      let processName = "";
      const userMatch = line.match(/users:\(\("([^"]+)",pid=(\d+)/);
      if (userMatch) {
        processName = userMatch[1];
        pid = parseInt(userMatch[2], 10);
      }

      let cmdline = "";
      if (pid) {
        try {
          const raw = await fs.readFile(`/proc/${pid}/cmdline`, "utf8");
          cmdline = raw.replace(/\0/g, " ").trim();
        } catch {
          // Process might have terminated or lack permissions
        }
      }

      const normalizedIp = normalizeIpForUrl(ip);
      const { service, category, isAiService, suggestedBaseUrl } = identifyService(
        port,
        normalizedIp,
        cmdline,
        processName
      );

      const key = `${normalizedIp}:${port}`;
      portsMap.set(key, {
        ip: normalizedIp,
        port,
        protocol: "tcp",
        service,
        category,
        isAiService,
        pid,
        processName,
        cmdline: cmdline.slice(0, 200),
        suggestedBaseUrl,
        status: "listening",
      });
    }
  } catch (error) {
    // If ss failed, log and fallback to probing common AI ports
    console.warn("[server-ports] ss command unavailable or failed:", error);
  }

  // 2. Fallback probe for standard AI ports if not already found
  const candidateAiPorts = [8377, 4098, 4099, 4096, 11434, 1234, 8000, 8080, 8188, 9997, 20128];
  for (const port of candidateAiPorts) {
    const key = `127.0.0.1:${port}`;
    if (!portsMap.has(key)) {
      const isOpen = await probePortTcp("127.0.0.1", port, 200);
      if (isOpen) {
        const { service, category, isAiService, suggestedBaseUrl } = identifyService(
          port,
          "127.0.0.1",
          "",
          ""
        );
        portsMap.set(key, {
          ip: "127.0.0.1",
          port,
          protocol: "tcp",
          service,
          category,
          isAiService,
          pid: null,
          processName: "",
          cmdline: "",
          suggestedBaseUrl,
          status: "listening",
        });
      }
    }
  }

  // Sort discovered ports: AI services first, then by port ascending
  const discoveredList = Array.from(portsMap.values()).sort((a, b) => {
    if (a.isAiService && !b.isAiService) return -1;
    if (!a.isAiService && b.isAiService) return 1;
    return a.port - b.port;
  });

  return NextResponse.json({
    success: true,
    total: discoveredList.length,
    ports: discoveredList,
  });
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      host?: string;
      port?: number;
      path?: string;
      timeoutMs?: number;
    };

    const host = body.host?.trim() || "127.0.0.1";
    const port = Number(body.port);
    const path = body.path ? (body.path.startsWith("/") ? body.path : `/${body.path}`) : "";
    const timeoutMs = Math.min(Math.max(body.timeoutMs || 2500, 500), 10000);

    if (!port || isNaN(port) || port < 1 || port > 65535) {
      return NextResponse.json(
        { success: false, error: "Invalid port number (must be between 1 and 65535)" },
        { status: 400 }
      );
    }

    const targetUrl = `http://${host}:${port}${path}`;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(targetUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json, text/plain, */*",
          "User-Agent": "CheapRouter-PortTester/1.0",
        },
      });

      clearTimeout(timer);
      const latencyMs = Date.now() - startTime;
      const contentType = res.headers.get("content-type") || "";

      let preview = "";
      try {
        const text = await res.text();
        preview = text.slice(0, 1000);
      } catch {
        preview = "";
      }

      return NextResponse.json({
        success: true,
        accessible: true,
        url: targetUrl,
        latencyMs,
        statusCode: res.status,
        statusText: res.statusText,
        contentType,
        preview,
      });
    } catch (fetchErr: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorMessage =
        fetchErr instanceof Error ? fetchErr.message : "Failed to connect to target port";

      return NextResponse.json({
        success: true,
        accessible: false,
        url: targetUrl,
        latencyMs,
        error: errorMessage,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
