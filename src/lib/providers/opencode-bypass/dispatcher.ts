import { type Dispatcher, ProxyAgent } from "undici";
import { createProxyDispatcher } from "@cheaproute/open-sse/utils/proxyDispatcher.ts";

let cachedDispatcher: Dispatcher | null = null;
let cachedProxyUrl: string | null = null;
let overrideDispatcherForTest: Dispatcher | null = null;

/**
 * Returns a Dispatcher (via WARP or configured proxy) to prevent Cloudflare datacenter IP 429 blocks.
 */
export function getBypassDispatcher(customProxyUrl?: string): Dispatcher | undefined {
  if (overrideDispatcherForTest) {
    return overrideDispatcherForTest;
  }

  if (process.env.OPENCODE_BYPASS_NO_PROXY === "true" || process.env.DISABLE_WARP === "true") {
    return undefined;
  }

  const proxyUrl =
    customProxyUrl ||
    process.env.OPENCODE_BYPASS_PROXY_URL ||
    process.env.WARP_PROXY_URL ||
    process.env.OPENCODE_WARP_PROXY ||
    process.env.WARP_PROXY ||
    process.env.CHEAPROUTE_WARP_PROXY ||
    "socks5://127.0.0.1:40000";

  if (!proxyUrl) {
    return undefined;
  }

  if (cachedDispatcher && cachedProxyUrl === proxyUrl) {
    return cachedDispatcher;
  }

  try {
    cachedDispatcher = createProxyDispatcher(proxyUrl);
    cachedProxyUrl = proxyUrl;
    return cachedDispatcher;
  } catch {
    try {
      cachedDispatcher = new ProxyAgent(proxyUrl);
      cachedProxyUrl = proxyUrl;
      return cachedDispatcher;
    } catch (err) {
      console.warn(`[opencode-bypass] Failed to create WARP proxy dispatcher for ${proxyUrl}:`, err);
      return undefined;
    }
  }
}

export function setBypassDispatcherForTest(dispatcher: Dispatcher | null): void {
  overrideDispatcherForTest = dispatcher;
}
