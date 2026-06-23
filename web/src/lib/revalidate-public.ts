import { revalidatePath } from "next/cache";

/** Public routes that depend on loadSiteData(). */
export const PUBLIC_CACHE_PATHS = [
  "/",
  "/vuelta-rapida",
  "/standings/pilotos",
  "/standings/equipos",
  "/resultados",
] as const;

export function revalidatePublicSite() {
  for (const path of PUBLIC_CACHE_PATHS) {
    revalidatePath(path);
  }
}
