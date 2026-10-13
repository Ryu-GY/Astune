import policies from "../../../data/contracts/error-policy.json";

export function errorPolicy(code: string) {
  return Object.hasOwn(policies, code) ? policies[code as keyof typeof policies] : undefined;
}

// Responses carry corrective field names, never the submitted values or exception text.
export function safeErrorDetails(details: unknown): { fields?: string[]; availableFolds?: number[] } | null {
  if (!details || typeof details !== "object") return null;
  const input = details as Record<string, unknown>;
  const fields = Array.isArray(input.fields) ? input.fields.filter((field): field is string =>
    typeof field === "string" && /^[A-Za-z][A-Za-z0-9_.]{0,79}$/.test(field)).slice(0, 20) : [];
  const folds = input.availableFolds ?? input.available_folds;
  const availableFolds = Array.isArray(folds) ? folds.filter(value => value === 0 || value === 1) : [];
  return fields.length || availableFolds.length ? {
    ...(fields.length ? { fields } : {}), ...(availableFolds.length ? { availableFolds } : {}),
  } : null;
}

export function publicError(code: string, details?: unknown) {
  const policy = errorPolicy(code) ?? policies.INTERNAL_SERVER_ERROR;
  return {
    status: policy.status,
    error: {
      code: errorPolicy(code) ? code : "INTERNAL_SERVER_ERROR",
      message: `${policy.message} ${policy.recovery}`,
      category: policy.category, recovery: policy.recovery,
      details: safeErrorDetails(details),
    },
  };
}
