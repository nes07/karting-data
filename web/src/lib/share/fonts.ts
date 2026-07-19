import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface ShareFont {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: "normal";
}

let cached: Promise<ShareFont[]> | null = null;

/** Fonts for satori/ImageResponse, loaded once per lambda instance. */
export function loadShareFonts(): Promise<ShareFont[]> {
  if (!cached) {
    const dir = join(process.cwd(), "assets", "fonts");
    cached = Promise.all([
      readFile(join(dir, "microgramma-d-extended-bold.otf")),
      readFile(join(dir, "inter-regular.ttf")),
      readFile(join(dir, "inter-bold.ttf")),
    ]).then(([micro, inter, interBold]) => [
      { name: "Microgramma", data: micro, weight: 700 as const, style: "normal" as const },
      { name: "Inter", data: inter, weight: 400 as const, style: "normal" as const },
      { name: "Inter", data: interBold, weight: 700 as const, style: "normal" as const },
    ]);
  }
  return cached;
}
