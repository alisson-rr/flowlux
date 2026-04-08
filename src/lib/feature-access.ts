const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeHost(input?: string | null) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];
}

export function isLocalhostHost(input?: string | null) {
  const host = normalizeHost(input);
  if (!host) return false;
  return LOCALHOST_HOSTS.has(host) || host.endsWith(".localhost");
}

export function isPreCheckoutLabEnabledForHost(input?: string | null) {
  if (process.env.NEXT_PUBLIC_ENABLE_PRECHECKOUT_LAB === "true") return true;
  return isLocalhostHost(input);
}

export function isPreCheckoutLabEnabledInBrowser() {
  if (typeof window === "undefined") return false;
  return isPreCheckoutLabEnabledForHost(window.location.host);
}
