/**
 * Global Type Declarations for OmniRoute
 *
 * Ambient declarations for modules and globals that don't ship their own types.
 */

/* ─── Environment Variables ─────────────────────────────── */
declare namespace NodeJS {
  interface ProcessEnv {
    JWT_SECRET?: string;
    INITIAL_PASSWORD?: string;
    AUTH_COOKIE_SECURE?: string;
    API_KEY_SECRET?: string;
    CLOUD_URL?: string;
    BASE_URL?: string;
    NEXT_PUBLIC_BASE_URL?: string;
    PROMPT_CACHE_MAX_SIZE?: string;
    PROMPT_CACHE_TTL_MS?: string;
    NEXT_PUBLIC_CLOUD_URL?: string;
    API_PORT?: string;
    PORT?: string;
    API_HOST?: string;
    DASHBOARD_PORT?: string;
    OMNIROUTE_PUBLIC_BASE_URL?: string;
    OMNIROUTE_BASE_URL?: string;
    OMNIROUTE_DISABLE_BACKGROUND_SERVICES?: string;
    OMNIROUTE_PORT?: string;
    PRICING_SYNC_ENABLED?: string;
    NODE_ENV?: "development" | "production" | "test";
  }
}

/* ─── Untyped Modules ───────────────────────────────────── */
declare module "node-machine-id" {
  export function machineIdSync(original?: boolean): string;
  export function machineId(original?: boolean): Promise<string>;
}

declare module "yazl" {
  export class ZipFile {
    addFile(realPath: string, metadataPath: string): void;
    addBuffer(buffer: Buffer, metadataPath: string): void;
    end(options?: Record<string, unknown>, callback?: () => void): void;
    outputStream: NodeJS.ReadableStream;
  }
}

interface Window {
  electronAPI?: {
    isElectron?: boolean;
    platform?: string;
    getDataDir?: () => Promise<string>;
    checkForUpdates?: () => Promise<any>;
    onUpdateStatus?: (callback: (data: any) => void) => () => void;
    downloadUpdate?: () => Promise<any>;
    installUpdate?: () => Promise<any>;
    getAutostartStatus?: () => Promise<boolean>;
    enableAutostart?: () => Promise<boolean>;
    disableAutostart?: () => Promise<boolean>;
    minimizeWindow?: () => void;
    maximizeWindow?: () => void;
    closeWindow?: () => void;
    openExternal?: (url: string) => Promise<void>;
    restartServer?: () => Promise<any>;
    onServerStatus?: (callback: (status: any) => void) => () => void;
    onPortChanged?: (callback: (port: number) => void) => () => void;
    [key: string]: any;
  };
}
