export function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  Object.freeze(value);
  return value;
}

function stableValue(value: unknown): unknown {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("Research serialization rejects non-finite numbers.");
  }
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]),
  );
}

export function stableStringify(value: unknown): string {
  const serialized = JSON.stringify(stableValue(value));
  if (serialized === undefined) throw new Error("Research value is not serializable.");
  return serialized;
}

export function requireFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

export function requireSafeTimestamp(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer.`);
}

export function isPlainScalar(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}
