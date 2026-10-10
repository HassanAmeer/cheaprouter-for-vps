import pkg from "../../../package.json" with { type: "json" };

export const APP_CONFIG = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "CheapRoute",
  description: "AI Gateway for Multi-Provider LLMs",
  version: pkg.version,
};

export const THEME_CONFIG = {
  storageKey: "theme",
  defaultTheme: "system",
};
