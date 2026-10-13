import { DateTime, IANAZone } from "luxon";

export function birthDateIssue(birthDate: string, timezone: string, now: DateTime = DateTime.utc()) {
  if (!IANAZone.isValidZone(timezone)) return "TIMEZONE_NOT_FOUND" as const;
  // Compare calendar dates in the birthplace zone. Today's unknown/noon reference
  // is valid even before noon; this policy intentionally does not compare times.
  if (birthDate > now.setZone(timezone).toISODate()!) return "BIRTH_DATE_IN_FUTURE" as const;
  return undefined;
}
