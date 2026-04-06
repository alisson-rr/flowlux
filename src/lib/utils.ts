import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizePhoneBR(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return "";

  // Remove country code 55 if present
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }

  // At this point we should have 10 or 11 digits: DD + 8 or 9 digit number
  if (digits.length === 11 && digits[2] === "9") {
    // Already has 9th digit: DD + 9 + XXXXXXXX → OK
  } else if (digits.length === 10) {
    const firstAfterDDD = digits[2];
    if (["6", "7", "8", "9"].includes(firstAfterDDD)) {
      // Mobile without 9th digit → add it
      digits = digits.slice(0, 2) + "9" + digits.slice(2);
    }
    // Landline (starts with 2-5) stays 10 digits
  } else if (digits.length < 10 || digits.length > 11) {
    return ""; // Invalid
  }

  return "55" + digits;
}

export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  let hasCountryCode = false;
  if (digits.startsWith("55") && digits.length >= 12) {
    hasCountryCode = true;
    digits = digits.slice(2);
  }
  // DD9XXXXXXXX (11 digits, 3rd digit is 9) → DDXXXXXXXX (10 digits)
  if (digits.length === 11 && digits[2] === "9") {
    digits = digits.slice(0, 2) + digits.slice(3);
  }
  if (hasCountryCode) {
    digits = "55" + digits;
  }
  return digits;
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  // 55 + DD + 9XXXX + XXXX (13 digits with country code)
  if (cleaned.length === 13 && cleaned.startsWith("55")) {
    const local = cleaned.slice(2);
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  // 55 + DD + XXXX + XXXX (12 digits with country code)
  if (cleaned.length === 12 && cleaned.startsWith("55")) {
    const local = cleaned.slice(2);
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 13);

  // International format: starts with 55 and has more than 11 digits
  if (digits.startsWith("55") && digits.length > 11) {
    const local = digits.slice(2); // DD + number
    if (local.length <= 2) return `+55 ${local}`;
    if (local.length <= 7) return `+55 (${local.slice(0, 2)}) ${local.slice(2)}`;
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }

  // National format: up to 11 digits
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
