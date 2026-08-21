export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
}

export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.slice(-10);
}

export function isValidUsername(raw: string) {
  return /^[a-z][a-z0-9_]{2,19}$/.test(normalizeUsername(raw));
}

export function isValidPhone(raw: string) {
  return /^[6-9]\d{9}$/.test(normalizePhone(raw));
}

export function isValidEmail(raw: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim().toLowerCase());
}

export type IdentifierKind = "email" | "phone" | "username";

export function classifyIdentifier(raw: string): { kind: IdentifierKind; value: string } {
  const trimmed = raw.trim();
  if (trimmed.includes("@")) return { kind: "email", value: trimmed.toLowerCase() };
  const phone = normalizePhone(trimmed);
  if (isValidPhone(phone) && !/[a-zA-Z]/.test(trimmed)) return { kind: "phone", value: phone };
  return { kind: "username", value: normalizeUsername(trimmed) };
}

export function handleDocId(kind: "username" | "phone", value: string) {
  return kind === "phone" ? `p_${value}` : `u_${value}`;
}

export function displayNameFrom(firstName: string, lastName: string, fallback = "") {
  const name = `${firstName.trim()} ${lastName.trim()}`.trim();
  return name || fallback;
}
