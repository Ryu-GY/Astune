import type { AstroResult, InterpretationRule, TemplateContext } from "./types";

function toFixedString(value: number, digits = 1): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return value.toFixed(digits);
}

function getBrightnessTier(magnitude: number): string {
  if (magnitude <= 1) return "매우 밝은";
  if (magnitude <= 2.5) return "밝은";
  if (magnitude <= 4) return "선명한";
  return "잔잔한";
}

export function buildTemplateContext(astro: AstroResult, rules: InterpretationRule[]): TemplateContext {
  const focusKeywords = [...new Set((rules.flatMap((rule) => rule.keywords ?? [])).filter(Boolean))];

  return {
    starId: String(astro.selectedStar.id),
    starName: astro.selectedStar.displayName,
    magnitude: toFixedString(astro.selectedStar.magnitude, 2),
    constellationId: astro.selectedConstellation.id ? String(astro.selectedConstellation.id) : "",
    constellationCode: astro.selectedConstellation.code,
    constellationNameKo: astro.selectedConstellation.nameKo,
    constellationNameEn: astro.selectedConstellation.nameEn ?? "",
    altitudeDeg: toFixedString(astro.metrics.altitudeDeg, 3),
    azimuthDeg: toFixedString(astro.metrics.azimuthDeg, 3),
    zenithDistanceDeg: toFixedString(astro.metrics.zenithDistanceDeg, 3),
    brightnessTier: getBrightnessTier(astro.selectedStar.magnitude),
    focusKeywords: focusKeywords.length > 0 ? focusKeywords.join(", ") : "균형감",
    sourceLabel: astro.astronomyMeta?.sourceLabel ?? "",
    catalogVersion: astro.astronomyMeta?.catalogVersion ?? "",
    engineName: astro.astronomyMeta?.engineName ?? "",
  };
}

export function renderTemplate(template: string, context: TemplateContext): string {
  const rendered = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: keyof TemplateContext) => {
    const value = context[key];
    return value ?? "";
  });

  return rendered.replace(/\r\n?/g, "\n").split(/\n\s*\n/)
    .map(paragraph => paragraph.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n\n");
}
