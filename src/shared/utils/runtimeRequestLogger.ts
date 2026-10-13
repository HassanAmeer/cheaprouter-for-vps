"use client";

/**
 * runtimeRequestLogger.ts
 *
 * In-memory client-side network request inspector.
 * Captures live requests/responses without writing anything to the database or storage.
 * Completely ephemeral, supports live inspection and instant clearing.
 */

export interface CapturedRequestLog {
  id: string;
  timestamp: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  method: string;
  url: string;
  pathname: string;
  status?: number;
  statusText?: string;
  requestHeaders: Record<string, string>;
  requestBody?: string | null;
  responseHeaders?: Record<string, string>;
  responseBody?: string | null;
  error?: string | null;
}

type LogListener = (logs: CapturedRequestLog[]) => void;

class RuntimeRequestLogger {
  private logs: CapturedRequestLog[] = [];
  private listeners: Set<LogListener> = new Set();
  private isInstalled = false;
  private maxLogs = 100;
  private originalFetch: typeof window.fetch | null = null;

  public getLogs(): CapturedRequestLog[] {
    return [...this.logs];
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snapshot = [...this.logs];
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error("[RuntimeRequestLogger] Listener error:", err);
      }
    }
  }

  public clearLogs() {
    this.logs = [];
    this.notify();
  }

  public install() {
    if (this.isInstalled || typeof window === "undefined" || !window.fetch) {
      return;
    }

    this.originalFetch = window.fetch.bind(window);
    const self = this;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const id = "req_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
      const startTime = performance.now();
      const now = new Date();
      const timestamp = now.toTimeString().split(" ")[0] + "." + String(now.getMilliseconds()).padStart(3, "0");

      let urlStr = "";
      let method = "GET";

      if (typeof input === "string") {
        urlStr = input;
      } else if (input instanceof URL) {
        urlStr = input.toString();
      } else if (input && typeof input === "object" && "url" in input) {
        urlStr = (input as Request).url;
        method = (input as Request).method || "GET";
      }

      if (init?.method) {
        method = init.method.toUpperCase();
      }

      let pathname = urlStr;
      try {
        const parsed = new URL(urlStr, window.location.origin);
        pathname = parsed.pathname + parsed.search;
      } catch {
        // use raw string
      }

      // Extract request headers
      const requestHeaders: Record<string, string> = {};
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((v, k) => {
            requestHeaders[k] = v;
          });
        } else if (Array.isArray(init.headers)) {
          for (const [k, v] of init.headers) {
            requestHeaders[k] = v;
          }
        } else if (typeof init.headers === "object") {
          for (const [k, v] of Object.entries(init.headers)) {
            if (typeof v === "string") requestHeaders[k] = v;
          }
        }
      }

      // Extract request body
      let requestBody: string | null = null;
      if (init?.body) {
        if (typeof init.body === "string") {
          requestBody = init.body;
        } else if (init.body instanceof FormData) {
          requestBody = "[FormData]";
        } else if (init.body instanceof Blob) {
          requestBody = `[Blob ${init.body.type} ${init.body.size} bytes]`;
        } else {
          requestBody = "[Binary / Stream Data]";
        }
      }

      const logItem: CapturedRequestLog = {
        id,
        timestamp,
        startTime,
        method,
        url: urlStr,
        pathname,
        requestHeaders,
        requestBody,
      };

      self.logs.unshift(logItem);
      if (self.logs.length > self.maxLogs) {
        self.logs.pop();
      }
      self.notify();

      try {
        const response = await self.originalFetch!(input, init);
        const endTime = performance.now();
        logItem.endTime = endTime;
        logItem.durationMs = Math.round(endTime - startTime);
        logItem.status = response.status;
        logItem.statusText = response.statusText;

        // Response headers
        const responseHeaders: Record<string, string> = {};
        if (response.headers) {
          response.headers.forEach((v, k) => {
            responseHeaders[k] = v;
          });
        }
        logItem.responseHeaders = responseHeaders;

        // Clone to safely inspect response body
        try {
          const clone = response.clone();
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json") || contentType.includes("text/") || contentType.includes("application/problem+json")) {
            const text = await clone.text();
            logItem.responseBody = text;
          } else if (contentType.includes("text/event-stream")) {
            logItem.responseBody = "[SSE Stream Active]";
          } else {
            logItem.responseBody = `[Binary / Stream ${contentType}]`;
          }
        } catch {
          logItem.responseBody = "[Response body could not be read]";
        }

        self.notify();
        return response;
      } catch (err: unknown) {
        const endTime = performance.now();
        logItem.endTime = endTime;
        logItem.durationMs = Math.round(endTime - startTime);
        logItem.error = err instanceof Error ? err.message : String(err);
        logItem.status = 0;
        logItem.statusText = "Network Error";
        self.notify();
        throw err;
      }
    };

    this.isInstalled = true;
  }
}

export const runtimeLogger = new RuntimeRequestLogger();
