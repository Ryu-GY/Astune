import countryNames from "./countries.json";

// A shared snapshot avoids hydration differences between server and browser ICU versions.
export const countries = countryNames;
const normalize = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
const aliases: Record<string, string> = { 한국: "KR", 남한: "KR", "republic of korea": "KR", "korea, republic of": "KR", usa: "US", "united states of america": "US", uk: "GB", 영국: "GB" };
export function countryCodeFor(value: string): string | undefined {
  const query = normalize(value);
  return aliases[query] ?? countries.find(country => [country.code, country.name, country.englishName].some(name => normalize(name) === query))?.code;
}
export function countryNameFor(code: string | null) {
  return countries.find(country => country.code === code)?.name ?? code ?? "";
}
