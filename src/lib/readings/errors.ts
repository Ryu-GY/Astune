export type DomainErrorCode =
  | "VALIDATION_ERROR"
  | "RULE_VERSION_NOT_FOUND"
  | "CALCULATION_FAILED"
  | "TIMEZONE_NOT_FOUND"
  | "LOCAL_TIME_AMBIGUOUS"
  | "LOCAL_TIME_NONEXISTENT";

export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(code: DomainErrorCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
