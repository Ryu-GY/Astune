import fs from "node:fs";
import path from "node:path";

export type LocalCity = {
  name: string;
  country: string;
  timezone: string;
  latitude: number;
  longitude: number;
  aliases?: string[];
};

let cachedCities: LocalCity[] | null = null;

function loadCities(): LocalCity[] {
  if (cachedCities) {
    return cachedCities;
  }

  const filePath = path.join(process.cwd(), "data", "locations", "cities.json");
  const raw = fs.readFileSync(filePath, "utf8");
  cachedCities = JSON.parse(raw) as LocalCity[];
  return cachedCities;
}

export function resolveCities(query: string) {
  const q = query.trim().toLowerCase();
  const cities = loadCities();

  return cities
    .filter((city) => {
      const haystacks = [city.name, city.country, ...(city.aliases || [])]
        .join(" ")
        .toLowerCase();
      return haystacks.includes(q);
    })
    .slice(0, 10);
}
