import { z } from "zod";

export const resolveLocationSchema = z.object({
  q: z.string().trim().min(1).max(100)
});

export const resolveLocationBodySchema = z.object({
  query: z.string().trim().min(1).max(100).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  countryCode: z.string().regex(/^[A-Za-z]{2}$/).transform(value => value.toUpperCase()).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  allowExternal: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(10).default(5),
}).strict().superRefine((input, context) => {
  if (input.query && input.q && input.query !== input.q) {
    context.addIssue({code: "custom", message: "query와 q에는 같은 도시명을 입력해 주세요."});
  }
  if ((input.latitude === undefined) !== (input.longitude === undefined)) {
    context.addIssue({code: "custom", message: "위도와 경도를 함께 입력해 주세요."});
  }
  if (input.latitude === undefined && !input.query && !input.q) {
    context.addIssue({code: "custom", message: "도시명 또는 좌표가 필요합니다."});
  }
}).transform(({q, ...input}) => ({...input, query: input.query ?? q}));

export type ResolveLocationBody = z.infer<typeof resolveLocationBodySchema>;
