import { z } from "zod";

export const resolveLocationSchema = z.object({
  q: z.string().trim().min(1).max(100)
});
