import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  formatPhoneInputValue,
  formatPhoneValue,
  getPhoneSearchKeys,
  normalizePhone as normalizePhoneCanonical,
  phoneToWhatsappDigits,
} from "@/lib/phone";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizePhone(phone: string): string {
  return normalizePhoneCanonical(phone);
}

export function phoneToJid(phone: string): string {
  return phoneToWhatsappDigits(phone) + "@s.whatsapp.net";
}

export function phoneVariants(phone: string): string[] {
  return getPhoneSearchKeys(phone).map((value) => value.replace(/\D/g, ""));
}

export function formatPhone(phone: string): string {
  return formatPhoneValue(phone);
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
  return formatPhoneInputValue(value);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
