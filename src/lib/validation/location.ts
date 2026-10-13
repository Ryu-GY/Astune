import { z } from "zod";

export const resolveLocationSchema = z.object({
  q: z.string().trim().min(1).max(100)
});

export const resolveLocationBodySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  countryCode: z.string().regex(/^[A-Za-z]{2}$/).transform(value => value.toUpperCase()).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  allowExternal: z.boolean().optional().default(false),
}).strict().superRefine((input, context) => {
  if ((input.latitude === undefined) !== (input.longitude === undefined)) {
    context.addIssue({code: "custom", message: "위도와 경도를 함께 입력해 주세요."});
  }
  if (input.latitude === undefined && !input.q) {
    context.addIssue({code: "custom", message: "도시명 또는 좌표가 필요합니다."});
  }
});

export type ResolveLocationBody = z.infer<typeof resolveLocationBodySchema>;
