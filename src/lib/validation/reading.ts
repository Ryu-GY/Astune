import { z } from "zod";
import { DateTime } from "luxon";

export const previewReadingInputSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  birthAtLocal: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
    .refine(value => DateTime.fromISO(value, { zone: "UTC" }).isValid, "유효한 출생 날짜가 필요합니다."),
  timezone: z.string().trim().min(3).refine(value => DateTime.now().setZone(value).isValid, "유효한 시간대가 필요합니다."),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationName: z.string().trim().max(120).optional(),
  maxMagnitude: z.number().min(-2).max(8).optional().default(2),
  dstFold: z.union([z.literal(0), z.literal(1)]).optional()
});

export const createReadingSchema = previewReadingInputSchema.extend({
  birthProfileId: z.string().trim().optional(),
  saveBirthProfile: z.boolean().optional().default(false),
  profileLabel: z.string().trim().max(80).optional()
});

export type PreviewReadingInputSchema = z.infer<typeof previewReadingInputSchema>;
export type CreateReadingSchema = z.infer<typeof createReadingSchema>;
