export type ApiResponse<T> = {
  success: true;
  data: T;
  meta: { requestId: string };
} | {
  success: false;
  error: { code: string; message: string; details: unknown; category: string; recovery: string };
  meta: { requestId: string };
};
