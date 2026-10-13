import { z } from "zod";
import type { TemplateContext } from "@/lib/readings/types";

const templateKeys = new Set<keyof TemplateContext>([
  "starId", "starName", "magnitude", "constellationId", "constellationCode", "constellationNameKo",
  "constellationNameEn", "altitudeDeg", "azimuthDeg", "zenithDistanceDeg", "brightnessTier",
  "focusKeywords", "sourceLabel", "catalogVersion", "engineName"
]);
const template = z.string().trim().max(4000).superRefine((value, ctx) => {
  for (const match of value.matchAll(/\{([^{}]+)\}/g)) {
    if (!templateKeys.has(match[1] as keyof TemplateContext)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `지원하지 않는 템플릿 변수: ${match[1]}` });
    }
  }
});

export const interpretationRuleInputSchema = z.object({
  scopeType: z.enum(["global", "constellation", "star"]).optional(),
  constellationCode: z.string().trim().nullable().optional(),
  starId: z.number().int().positive().max(2147483647).nullable().optional(),
  priority: z.number().int().min(-32768).max(32767).default(100),
  title: z.string().trim().min(1).max(200),
  keywords: z.array(z.string().trim().min(1).max(50).regex(/^[^,]+$/)).max(20).default([]),
  templates: z.object({
    overview: template.optional(), personality: template.optional(), love: template.optional(),
    career: template.optional(), money: template.optional()
  }).strict().optional(),
  generalText: template.optional(), personalityText: template.optional(), loveText: template.optional(),
  careerText: template.optional(), moneyText: template.optional()
}).transform(input => ({
  scopeType: input.scopeType ?? (input.constellationCode === "default" ? "global" : input.starId != null ? "star" : "constellation"),
  constellationCode: input.constellationCode === "default" ? null : input.constellationCode ?? null,
  starId: input.starId ?? null,
  priority: input.priority,
  title: input.title,
  keywords: input.keywords,
  templates: {
    overview: input.templates?.overview ?? input.generalText ?? "",
    personality: input.templates?.personality ?? input.personalityText ?? "",
    love: input.templates?.love ?? input.loveText ?? "",
    career: input.templates?.career ?? input.careerText ?? "",
    money: input.templates?.money ?? input.moneyText ?? ""
  }
})).superRefine((rule, ctx) => {
  const validScope = rule.scopeType === "global" ? rule.constellationCode === null && rule.starId === null
    : rule.scopeType === "star" ? rule.starId !== null && rule.constellationCode === null
    : rule.constellationCode !== null && /^[A-Z][A-Za-z]{2}$/.test(rule.constellationCode) && rule.starId === null;
  if (!validScope) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scopeType"], message: "범위에 맞는 별 ID 또는 성좌 코드를 지정해 주세요." });
  if (!Object.values(rule.templates).some(Boolean)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["templates"], message: "하나 이상의 해석 문구가 필요합니다." });
  }
});
