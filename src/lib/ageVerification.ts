/**
 * Age gate + pluggable age-verification providers.
 *
 * IMPORTANT: the default provider is a SELF-DECLARATION ("I am 18+") only.
 * It is NOT formal age verification and does not by itself satisfy laws that
 * require verified age checks in some jurisdictions (for example certain US
 * states, the UK Online Safety Act, France, and others). To comply there,
 * add a provider below that performs a real check and verifies the result
 * SERVER-SIDE (e.g. a Cloudflare Pages Function or Supabase Edge Function
 * that validates the provider's signed token and sets an HttpOnly cookie).
 * Deciding WHICH visitors need formal verification should also happen
 * server-side (e.g. using Cloudflare's CF-IPCountry / region headers).
 */

export interface AgeCheckResult {
  method: string;
  /** true only when a provider performed a real, server-verified check */
  formallyVerified: boolean;
  acceptedAt: number;
  expiresAt: number;
}

export interface AgeVerificationProvider {
  id: string;
  label: string;
  /** Does this provider perform a real age check (not just a click)? */
  isFormalVerification: boolean;
  /** Run when the visitor chooses "Yes, I am 18+". */
  confirm(): Promise<AgeCheckResult>;
}

const DAY = 24 * 60 * 60 * 1000;

function rememberDays(): number {
  const n = Number(import.meta.env.VITE_AGE_GATE_DAYS ?? 30);
  return Number.isFinite(n) && n > 0 && n <= 365 ? n : 30;
}

/** Default: visitor declares they are an adult. Not formal verification. */
export const selfDeclarationProvider: AgeVerificationProvider = {
  id: 'self_declaration',
  label: 'Self-declaration',
  isFormalVerification: false,
  async confirm() {
    const now = Date.now();
    return { method: 'self_declaration', formallyVerified: false, acceptedAt: now, expiresAt: now + rememberDays() * DAY };
  },
};

/**
 * Register real providers here (for example a third-party age-assurance
 * service). Keep their secrets server-side; the browser should only ever
 * receive a short-lived, server-verified result.
 */
const PROVIDERS: Record<string, AgeVerificationProvider> = {
  [selfDeclarationProvider.id]: selfDeclarationProvider,
};

export function getAgeProvider(): AgeVerificationProvider {
  const id = import.meta.env.VITE_AGE_VERIFICATION_PROVIDER || 'self_declaration';
  return PROVIDERS[id] ?? selfDeclarationProvider;
}

// ---------------------------------------------------------------------------
// Local persistence (per browser). Wrapped in try/catch: private windows or
// blocked storage fall back to an in-memory flag for this tab only.
// ---------------------------------------------------------------------------
const KEY = 'onlyfap:age-gate:v1';
let memory: AgeCheckResult | null = null;

export function readAgeAcceptance(): AgeCheckResult | null {
  let value: AgeCheckResult | null = memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) value = JSON.parse(raw) as AgeCheckResult;
  } catch {
    /* storage unavailable */
  }
  if (!value || typeof value.expiresAt !== 'number' || value.expiresAt < Date.now()) return null;
  return value;
}

export function saveAgeAcceptance(result: AgeCheckResult) {
  memory = result;
  try {
    localStorage.setItem(KEY, JSON.stringify(result));
  } catch {
    /* in-memory only */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('onlyfap:age-gate'));
}

export function revokeAgeAcceptance() {
  memory = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('onlyfap:age-gate'));
}

/** Paths that stay reachable without passing the gate (non-explicit pages). */
export function isGateExempt(pathname: string): boolean {
  return pathname === '/exit' || pathname.startsWith('/legal/');
}
