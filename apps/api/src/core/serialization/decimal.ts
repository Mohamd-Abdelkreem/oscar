export class DecimalSerializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecimalSerializationError";
  }
}

const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u;

const isObject = (value: unknown): value is object =>
  value !== null && typeof value === "object";

const readDecimalString = (value: unknown): string | null => {
  if (!isObject(value) || value instanceof Date || Array.isArray(value)) {
    return null;
  }
  const stringify: unknown = Reflect.get(value, "toString") as unknown;
  if (typeof stringify !== "function") return null;
  try {
    const result: unknown = Reflect.apply(
      stringify as (this: object) => unknown,
      value,
      [],
    );
    return typeof result === "string" && DECIMAL_PATTERN.test(result)
      ? result
      : null;
  } catch {
    return null;
  }
};

const canonicalDecimal = (raw: string): string => {
  if (!DECIMAL_PATTERN.test(raw)) {
    throw new DecimalSerializationError("Invalid Decimal string.");
  }
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [integer = "0", fraction] = unsigned.split(".");
  const trimmedFraction = fraction?.replace(/0+$/u, "") ?? "";
  const zero = /^0+$/u.test(integer) && trimmedFraction.length === 0;
  return `${negative && !zero ? "-" : ""}${integer}${
    trimmedFraction.length === 0 ? "" : `.${trimmedFraction}`
  }`;
};

export const isPrismaDecimal = (value: unknown): boolean =>
  readDecimalString(value) !== null;

export const serializeDecimalToString = (value: unknown): string => {
  const raw =
    typeof value === "string" && DECIMAL_PATTERN.test(value)
      ? value
      : readDecimalString(value);
  if (raw === null) {
    throw new DecimalSerializationError(
      "Cannot serialize a non-Decimal value.",
    );
  }
  return canonicalDecimal(raw);
};

const isPlainObject = (value: object): value is Record<string, unknown> => {
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
};

export const serializeDecimalsDeep = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serializeDecimalsDeep);
  if (isPrismaDecimal(value)) return serializeDecimalToString(value);
  if (value instanceof Date) return value;
  if (isObject(value) && isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        serializeDecimalsDeep(item),
      ]),
    );
  }
  return value;
};

export const assertNoPrismaDecimal = (value: unknown, path = "value"): void => {
  if (value === null || value === undefined) return;
  if (isPrismaDecimal(value)) {
    throw new DecimalSerializationError(
      `Prisma Decimal leaked into response at ${path}.`,
    );
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertNoPrismaDecimal(item, `${path}[${String(index)}]`);
    });
    return;
  }
  if (isObject(value) && isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      assertNoPrismaDecimal(item, `${path}.${key}`);
    }
  }
};
