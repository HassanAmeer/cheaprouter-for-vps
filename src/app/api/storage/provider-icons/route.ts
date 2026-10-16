import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface IconItem {
  id: string;
  name: string;
  filename: string;
  url: string;
}

function formatIconName(baseName: string): string {
  return baseName
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET() {
  try {
    const cwd = process.cwd();
    // Primary storage folder in public/storage/providers
    const storageDir = path.join(cwd, "public", "storage", "providers");
    const fallbackDir = path.join(cwd, "public", "providers");

    let targetDir = storageDir;
    let urlPrefix = "/storage/providers";

    if (!fs.existsSync(storageDir)) {
      if (fs.existsSync(fallbackDir)) {
        targetDir = fallbackDir;
        urlPrefix = "/providers";
      } else {
        return NextResponse.json({ icons: [], total: 0 });
      }
    }

    const files = await fs.promises.readdir(targetDir);
    const validExtensions = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif"]);

    const icons: IconItem[] = [];

    for (const filename of files) {
      const ext = path.extname(filename).toLowerCase();
      if (!validExtensions.has(ext)) continue;

      const baseName = path.basename(filename, ext);
      icons.push({
        id: baseName,
        name: formatIconName(baseName),
        filename,
        url: `${urlPrefix}/${filename}`,
      });
    }

    // Sort alphabetically by name
    icons.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      icons,
      total: icons.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load provider icons";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
