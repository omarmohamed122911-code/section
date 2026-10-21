export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function bodyString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function emailString(value) {
  return bodyString(value).toLowerCase();
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function requireFields(fields, body) {
  const missing = fields.filter((f) => bodyString(body?.[f]) === "");
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }
}

export function numberInRange(value, name, min, max, fallback = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    if (fallback !== null) return fallback;
    throw new Error(`${name} must be a number`);
  }
  if (n < min || n > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return n;
}

export function isPositiveInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}
