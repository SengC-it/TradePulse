function canonicalError(path: string, message: string): Error {
  return new Error(`Observation payload at ${path} is not canonical JSON: ${message}`);
}

function compareKeys(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function canonicalize(value: unknown, path: string, ancestors: ReadonlySet<object>): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw canonicalError(path, "numbers must be finite");
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw canonicalError(path, `${typeof value} is not supported`);
  }
  if (ancestors.has(value)) throw canonicalError(path, "circular values are not supported");

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);

  if (Array.isArray(value)) {
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw canonicalError(path, "symbol properties are not supported");
    }
    const ownNames = Object.getOwnPropertyNames(value);
    for (const name of ownNames) {
      const index = Number(name);
      if (name !== "length"
        && (!Number.isInteger(index) || index < 0 || index >= value.length || String(index) !== name)) {
        throw canonicalError(`${path}.${name}`, "array properties are not supported");
      }
    }
    const items: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !("value" in descriptor)) {
        throw canonicalError(`${path}[${index}]`, "array holes and accessors are not supported");
      }
      items.push(canonicalize(descriptor.value, `${path}[${index}]`, nextAncestors));
    }
    return `[${items.join(",")}]`;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw canonicalError(path, "only plain objects are supported");
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw canonicalError(path, "symbol properties are not supported");
  }

  const entries = Object.keys(value as Record<string, unknown>)
    .sort(compareKeys)
    .map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) {
        throw canonicalError(`${path}.${key}`, "accessor properties are not supported");
      }
      return `${JSON.stringify(key)}:${canonicalize(descriptor.value, `${path}.${key}`, nextAncestors)}`;
    });
  return `{${entries.join(",")}}`;
}

export function canonicalJson(value: unknown): string {
  return canonicalize(value, "$", new Set());
}

export function isCanonicalJsonValue(value: unknown): boolean {
  try {
    canonicalJson(value);
    return true;
  } catch {
    return false;
  }
}
