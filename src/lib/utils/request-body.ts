import { AppError } from "@/lib/errors/app-error";

export async function readJsonBody(request: Request): Promise<unknown> {
  try { return await request.json(); }
  catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new AppError("JSON 요청을 확인해 주세요.", { code: "VALIDATION_ERROR", statusCode: 400 });
  }
}
