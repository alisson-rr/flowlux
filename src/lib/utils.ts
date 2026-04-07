import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normaliza qualquer telefone (BR ou internacional) para formato canônico de armazenamento.
 * - BR: sempre "55" + DD + 9 + XXXXXXXX (13 dígitos celular) ou "55" + DD + XXXXXXXX (12 fixo)
 * - Internacional: código do país + número (somente dígitos)
 * Retorna "" se inválido.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits || digits.length < 7) return "";

  // --- Detectar se é BR ---
  // Caso 1: já tem código 55 e comprimento compatível (12-13 dígitos)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return normalizeBR(digits.slice(2));
  }
  // Caso 2: número nacional sem código de país (10-11 dígitos, DDD entre 11-99)
  const ddd = parseInt(digits.slice(0, 2), 10);
  if ((digits.length === 10 || digits.length === 11) && ddd >= 11 && ddd <= 99) {
    return normalizeBR(digits);
  }

  // --- Internacional ---
  return digits;
}

/** Normaliza parte nacional BR (sem o 55). Retorna "55" + resultado ou "" se inválido. */
function normalizeBR(national: string): string {
  if (national.length === 11 && national[2] === "9") {
    // Celular completo: DD + 9 + XXXXXXXX → OK
    return "55" + national;
  }
  if (national.length === 10) {
    const firstAfterDDD = national[2];
    if (["6", "7", "8", "9"].includes(firstAfterDDD)) {
      // Celular sem 9º dígito → adicionar
      return "55" + national.slice(0, 2) + "9" + national.slice(2);
    }
    // Fixo (começa com 2-5) fica com 10 dígitos
    return "55" + national;
  }
  return "";
}

/**
 * Converte telefone normalizado para o formato remote_jid da Evolution API / WhatsApp.
 * - BR celular (13 dígitos, 55+DD+9XXXXXXXX): remove o 9º dígito → 55+DD+XXXXXXXX
 * - Demais: mantém como está
 * Retorna o JID completo com @s.whatsapp.net
 */
export function phoneToJid(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // BR celular: 13 dígitos, começa com 55, 5º char é "9"
  if (digits.length === 13 && digits.startsWith("55") && digits[4] === "9") {
    return digits.slice(0, 4) + digits.slice(5) + "@s.whatsapp.net";
  }
  return digits + "@s.whatsapp.net";
}

/**
 * Gera todas as variantes de um telefone para busca/comparação robusta.
 * Útil para encontrar leads independentemente do formato armazenado.
 */
export function phoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return [];
  const result = new Set<string>([digits]);

  // Variantes com/sem código de país 55
  if (digits.startsWith("55") && digits.length > 11) {
    result.add(digits.slice(2));
  }
  if (!digits.startsWith("55") && digits.length <= 11) {
    result.add("55" + digits);
  }

  // Variantes do 9º dígito brasileiro
  const withCC = digits.startsWith("55") ? digits : "55" + digits;
  if (withCC.length >= 12) {
    const ddd = withCC.substring(2, 4);
    const subscriber = withCC.substring(4);
    if (subscriber.length === 9 && subscriber.startsWith("9")) {
      // Com 9º dígito → gerar sem
      const without9 = "55" + ddd + subscriber.substring(1);
      result.add(without9);
      result.add(without9.slice(2));
    } else if (subscriber.length === 8) {
      // Sem 9º dígito → gerar com
      const with9 = "55" + ddd + "9" + subscriber;
      result.add(with9);
      result.add(with9.slice(2));
    }
  }

  return Array.from(result);
}

/**
 * Formata telefone para exibição ao usuário.
 * Suporta BR (com +55) e internacional (com +código).
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  // BR celular: 55 + DD + 9XXXX + XXXX (13 dígitos)
  if (cleaned.length === 13 && cleaned.startsWith("55")) {
    const local = cleaned.slice(2);
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  // BR fixo: 55 + DD + XXXX + XXXX (12 dígitos)
  if (cleaned.length === 12 && cleaned.startsWith("55")) {
    const local = cleaned.slice(2);
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  // Nacional sem código de país
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  // Internacional genérico
  if (cleaned.length > 6) {
    return `+${cleaned}`;
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

/**
 * Máscara de input para telefone. Aceita BR (com ou sem +55) e internacional (com +).
 * Máximo 15 dígitos (padrão E.164).
 */
export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 15);

  // BR com código de país: 55...
  if (digits.startsWith("55") && digits.length > 11) {
    const local = digits.slice(2);
    if (local.length <= 2) return `+55 ${local}`;
    if (local.length <= 7) return `+55 (${local.slice(0, 2)}) ${local.slice(2)}`;
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }

  // Nacional BR (até 11 dígitos, DDD >= 11)
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (digits.length <= 11 && ddd >= 11 && ddd <= 99) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  // Internacional genérico: +código + número
  if (digits.length > 0) return `+${digits}`;
  return "";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
