import type { UserRole } from "@/lib/types";

export function parseRole(raw: unknown): UserRole {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "admin") return "admin";
  if (value === "staff") return "staff";
  return "customer";
}

export function mergeRole(input?: UserRole | null, previous?: string | null): UserRole {
  const prev = parseRole(previous);
  if (prev === "admin") return "admin";
  if (input === "admin") return "admin";
  if (input === "staff") return "staff";
  if (prev === "staff") return "staff";
  return "customer";
}

export function isDeskRole(role: UserRole | null | undefined) {
  return role === "admin" || role === "staff";
}
