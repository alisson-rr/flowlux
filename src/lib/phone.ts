import { AsYouType, type CountryCode, parsePhoneNumberFromString } from "libphonenumber-js";

const BRAZIL_COUNTRY_CODE = "55";
const MIN_PHONE_DIGITS = 8;
const MAX_PHONE_DIGITS = 15;
const MAX_BRAZIL_PHONE_DIGITS = 11;

export interface PhoneIdentity {
  rawInput: string;
  canonicalDigits: string;
  e164: string;
  countryCode: string;
  nationalNumber: string;
  display: string;
  searchKeys: string[];
  isBrazil: boolean;
  isMobile: boolean;
}

export interface LeadPhoneFields {
  phone: string;
  phone_e164: string;
  phone_country_code: string;
  phone_search_keys: string[];
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (value || "").trim())
        .filter(Boolean)
    )
  );
}

function sanitizePhoneInput(input: string): { normalized: string; digits: string; hasInternationalPrefix: boolean } {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  const hasPlus = trimmed.startsWith("+");
  const hasZeroZeroPrefix = digits.startsWith("00");

  if (hasZeroZeroPrefix) {
    const internationalDigits = digits.slice(2);
    return {
      normalized: `+${internationalDigits}`,
      digits: internationalDigits,
      hasInternationalPrefix: true,
    };
  }

  return {
    normalized: hasPlus ? `+${digits}` : trimmed,
    digits,
    hasInternationalPrefix: hasPlus,
  };
}

function looksLikeBrazilNational(digits: string): boolean {
  if (digits.length !== 10 && digits.length !== 11) return false;
  const ddd = Number(digits.slice(0, 2));
  return Number.isInteger(ddd) && ddd >= 11 && ddd <= 99;
}

function normalizeBrazilNational(national: string): { national: string; isMobile: boolean } | null {
  if (!/^\d{10,11}$/.test(national)) return null;

  if (national.length === 11 && national[2] === "9") {
    return { national, isMobile: true };
  }

  if (national.length === 10) {
    const firstSubscriberDigit = national[2];
    if (/^[6-9]$/.test(firstSubscriberDigit)) {
      return {
        national: `${national.slice(0, 2)}9${national.slice(2)}`,
        isMobile: true,
      };
    }

    if (/^[2-5]$/.test(firstSubscriberDigit)) {
      return { national, isMobile: false };
    }
  }

  return null;
}

function buildBrazilIdentity(rawInput: string, digits: string): PhoneIdentity | null {
  const national = digits.startsWith(BRAZIL_COUNTRY_CODE) ? digits.slice(2) : digits;
  const normalized = normalizeBrazilNational(national);
  if (!normalized) return null;

  const canonicalDigits = `${BRAZIL_COUNTRY_CODE}${normalized.national}`;
  const e164 = `+${canonicalDigits}`;
  const nationalWithoutNinthDigit = normalized.isMobile
    ? `${normalized.national.slice(0, 2)}${normalized.national.slice(3)}`
    : normalized.national;
  const canonicalWithoutNinthDigit = normalized.isMobile
    ? `${BRAZIL_COUNTRY_CODE}${nationalWithoutNinthDigit}`
    : canonicalDigits;
  const parsed = parsePhoneNumberFromString(e164);
  const display = parsed?.formatInternational() || `+55 ${normalized.national}`;

  const searchKeys = uniqueValues([
    canonicalDigits,
    e164,
    normalized.national,
    canonicalWithoutNinthDigit,
    nationalWithoutNinthDigit,
  ]);

  return {
    rawInput,
    canonicalDigits,
    e164,
    countryCode: BRAZIL_COUNTRY_CODE,
    nationalNumber: normalized.national,
    display,
    searchKeys,
    isBrazil: true,
    isMobile: normalized.isMobile,
  };
}

function buildInternationalIdentity(rawInput: string, candidate: string): PhoneIdentity | null {
  const parsed = parsePhoneNumberFromString(candidate);
  if (!parsed?.isValid()) return null;

  const canonicalDigits = parsed.number.replace(/\D/g, "");
  const e164 = parsed.number;
  const searchKeys = uniqueValues([
    canonicalDigits,
    e164,
    parsed.nationalNumber,
  ]);

  return {
    rawInput,
    canonicalDigits,
    e164,
    countryCode: parsed.countryCallingCode,
    nationalNumber: parsed.nationalNumber,
    display: parsed.formatInternational(),
    searchKeys,
    isBrazil: parsed.country === "BR",
    isMobile: parsed.getType() === "MOBILE" || parsed.getType() === "FIXED_LINE_OR_MOBILE",
  };
}

export function getPhoneIdentity(input: string, defaultCountry: CountryCode = "BR"): PhoneIdentity | null {
  const { normalized, digits, hasInternationalPrefix } = sanitizePhoneInput(input);

  if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
    return null;
  }

  if (digits.startsWith(BRAZIL_COUNTRY_CODE) || looksLikeBrazilNational(digits)) {
    const brazilIdentity = buildBrazilIdentity(input, digits);
    if (brazilIdentity) return brazilIdentity;
  }

  if (hasInternationalPrefix) {
    return buildInternationalIdentity(input, normalized.startsWith("+") ? normalized : `+${digits}`);
  }

  const localized = parsePhoneNumberFromString(normalized, defaultCountry);
  if (localized?.isValid()) {
    return buildInternationalIdentity(input, localized.number);
  }

  if (digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS) {
    return buildInternationalIdentity(input, `+${digits}`);
  }

  return null;
}

export function normalizePhoneToE164(input: string, defaultCountry: CountryCode = "BR"): string {
  return getPhoneIdentity(input, defaultCountry)?.e164 || "";
}

export function normalizePhone(input: string, defaultCountry: CountryCode = "BR"): string {
  return getPhoneIdentity(input, defaultCountry)?.canonicalDigits || "";
}

export function getPhoneSearchKeys(input: string, defaultCountry: CountryCode = "BR"): string[] {
  return getPhoneIdentity(input, defaultCountry)?.searchKeys || [];
}

export function buildLeadPhoneFields(input: string, defaultCountry: CountryCode = "BR"): LeadPhoneFields | null {
  const identity = getPhoneIdentity(input, defaultCountry);
  if (!identity) return null;

  return {
    phone: identity.canonicalDigits,
    phone_e164: identity.e164,
    phone_country_code: identity.countryCode,
    phone_search_keys: identity.searchKeys,
  };
}

export function formatPhoneInputValue(value: string, defaultCountry: CountryCode = "BR"): string {
  const { digits, hasInternationalPrefix } = sanitizePhoneInput(value);
  if (!digits) return "";

  if (hasInternationalPrefix) {
    return new AsYouType().input(`+${digits.slice(0, MAX_PHONE_DIGITS)}`);
  }

  if (defaultCountry === "BR") {
    const nationalDigits = digits.startsWith(BRAZIL_COUNTRY_CODE) ? digits.slice(2) : digits;
    return new AsYouType(defaultCountry).input(nationalDigits.slice(0, MAX_BRAZIL_PHONE_DIGITS));
  }

  return new AsYouType(defaultCountry).input(digits);
}

export function formatPhoneValue(value: string, defaultCountry: CountryCode = "BR"): string {
  const identity = getPhoneIdentity(value, defaultCountry);
  return identity?.display || value;
}

export function phoneToWhatsappDigits(value: string, defaultCountry: CountryCode = "BR"): string {
  const identity = getPhoneIdentity(value, defaultCountry);
  if (!identity) return value.replace(/\D/g, "");

  if (identity.isBrazil && identity.isMobile && identity.nationalNumber.length === 9) {
    return `${identity.countryCode}${identity.nationalNumber.slice(0, 2)}${identity.nationalNumber.slice(3)}`;
  }

  return identity.canonicalDigits;
}
