import { DomainError } from "./errors";
import { DateTime } from "luxon";
import type { PreviewReadingRequest } from "./types";
import { UNKNOWN_BIRTH_TIME_REFERENCE } from "./birth-time";
import { birthDateIssue } from "@/lib/validation/birth-date-policy";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DomainError("VALIDATION_ERROR", `${field} is required`, 400, { field });
  }

  return value.trim();
}

function requireNumber(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DomainError("VALIDATION_ERROR", `${field} must be a valid number`, 400, { field });
  }

  return value;
}

export function validatePreviewRequest(input: unknown): PreviewReadingRequest {
  if (!isObject(input)) {
    throw new DomainError("VALIDATION_ERROR", "Request body must be an object", 400);
  }

  const birthDate = requireString(input, "birthDate");
  if (input.birthTimeUnknown !== undefined && typeof input.birthTimeUnknown !== "boolean") {
    throw new DomainError("VALIDATION_ERROR", "birthTimeUnknown must be a boolean", 400);
  }
  const birthTimeLocal = input.birthTimeUnknown ? UNKNOWN_BIRTH_TIME_REFERENCE : requireString(input, "birthTimeLocal");
  const locationName = requireString(input, "locationName");
  const latitude = requireNumber(input, "latitude");
  const longitude = requireNumber(input, "longitude");

  if (!DATE_PATTERN.test(birthDate) || !DateTime.fromISO(birthDate, { zone: "UTC" }).isValid) {
    throw new DomainError("VALIDATION_ERROR", "birthDate must be YYYY-MM-DD", 400, { field: "birthDate" });
  }

  if (!TIME_PATTERN.test(birthTimeLocal)) {
    throw new DomainError("VALIDATION_ERROR", "birthTimeLocal must be HH:mm or HH:mm:ss", 400, {
      field: "birthTimeLocal",
    });
  }

  if (latitude < -90 || latitude > 90) {
    throw new DomainError("VALIDATION_ERROR", "latitude must be between -90 and 90", 400, { field: "latitude" });
  }

  if (longitude < -180 || longitude > 180) {
    throw new DomainError("VALIDATION_ERROR", "longitude must be between -180 and 180", 400, { field: "longitude" });
  }

  const timezone = typeof input.timezone === "string" && input.timezone.trim().length > 0 ? input.timezone.trim() : undefined;
  const dateIssue = birthDateIssue(birthDate, timezone || "");
  if (dateIssue) {
    throw new DomainError(dateIssue, "출생 날짜와 IANA 시간대를 확인해 주세요.", 422);
  }
  const dstFoldRaw = input.dstFold;

  if (dstFoldRaw !== undefined && dstFoldRaw !== 0 && dstFoldRaw !== 1) {
    throw new DomainError("VALIDATION_ERROR", "dstFold must be 0 or 1", 400, { field: "dstFold" });
  }

  return {
    birthDate,
    birthTimeLocal,
    birthTimeUnknown: input.birthTimeUnknown as boolean | undefined,
    timezone,
    dstFold: dstFoldRaw as 0 | 1 | undefined,
    locationName,
    latitude,
    longitude,
  };
}
