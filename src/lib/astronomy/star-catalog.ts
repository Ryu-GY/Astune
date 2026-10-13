import fs from "node:fs";
import path from "node:path";
import type { CatalogStar } from "@/lib/astronomy/types";

let cachedCatalog: CatalogStar[] | null = null;

export const ASTRO_SOURCE_LABEL = "ESA Hipparcos bright subset (starter sample)";
export const ASTRO_CATALOG_VERSION = "hip-bright-starter-v1";
export const ASTRO_ENGINE_NAME = "local-horizontal-transform-v1";

function loadCatalog(): CatalogStar[] {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const filePath = path.join(process.cwd(), "data", "astro", "bright-stars.json");
  const raw = fs.readFileSync(filePath, "utf8");
  cachedCatalog = JSON.parse(raw) as CatalogStar[];
  return cachedCatalog;
}

export function getBrightStarCatalog(maxMagnitude = 2) {
  return loadCatalog()
    .filter((star) => star.magnitude <= maxMagnitude)
    .sort((a, b) => a.magnitude - b.magnitude);
}
