import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | undefined | null): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleString();
  } catch {
    return date;
  }
}

export function truncateId(id: string | null | undefined, len = 8): string {
  if (id == null || id === "") return "—";
  const s = String(id);
  if (s.length <= len) return s;
  return s.slice(0, len) + "…";
}
