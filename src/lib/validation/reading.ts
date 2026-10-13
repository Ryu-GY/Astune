import { z } from "zod";
import { DateTime } from "luxon";
import { UNKNOWN_BIRTH_TIME_REFERENCE } from "@/lib/readings/birth-time";
import { birthDateIssue } from "./birth-date-policy";
import { errorPolicy } from "@/lib/errors/error-policy";

const readingFields = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  birthAtLocal: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}(T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?)?$/)
    .refine(value => DateTime.fromISO(value, { zone: "UTC" }).isValid, "유효한 출생 날짜가 필요합니다."),
  birthTimeUnknown: z.boolean().optional(),
  timezone: z.string().trim().min(1).max(80),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationName: z.string().trim().max(120).optional(),
  maxMagnitude: z.number().min(-2).max(5.5).optional().default(2),
  dstFold: z.union([z.literal(0), z.literal(1)]).optional()
});

function requireKnownTime(input: z.infer<typeof readingFields>, context: z.RefinementCtx) {
  if (!input.birthTimeUnknown && !input.birthAtLocal.includes("T")) {
    context.addIssue({code: z.ZodIssueCode.custom, path: ["birthAtLocal"], message: "출생 시간을 입력하거나 시간 모름을 선택해 주세요."});
  }
  const code = birthDateIssue(input.birthAtLocal.split("T")[0], input.timezone);
  if (code) context.addIssue({ code: z.ZodIssueCode.custom,
    path: [code === "TIMEZONE_NOT_FOUND" ? "timezone" : "birthAtLocal"],
    message: errorPolicy(code)!.message, params: { errorCode: code },
  });
}

function useReferenceTime<T extends z.infer<typeof readingFields>>(input: T): T {
  return input.birthTimeUnknown
    ? { ...input, birthAtLocal: input.birthAtLocal.split("T")[0] + "T" + UNKNOWN_BIRTH_TIME_REFERENCE, dstFold: undefined }
    : input;
}

export const previewReadingInputSchema = readingFields.superRefine(requireKnownTime).transform(useReferenceTime);

export const createReadingSchema = readingFields.extend({
  birthProfileId: z.string().trim().optional(),
  saveBirthProfile: z.boolean().optional().default(false),
  profileLabel: z.string().trim().max(80).optional()
}).superRefine(requireKnownTime).superRefine((input, context) => {
  if (input.birthTimeUnknown && (input.saveBirthProfile || input.birthProfileId)) {
    context.addIssue({code: z.ZodIssueCode.custom, path: ["saveBirthProfile"], message: "시간 모름 리딩은 출생 프로필에 연결하지 않고 저장해 주세요."});
  }
}).transform(useReferenceTime);

export type PreviewReadingInputSchema = z.infer<typeof previewReadingInputSchema>;
export type CreateReadingSchema = z.infer<typeof createReadingSchema>;
