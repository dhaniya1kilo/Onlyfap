/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Public origin used for canonical URLs, Open Graph and share links, e.g. https://onlyfap.example */
  readonly VITE_SITE_URL?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  readonly VITE_LEGAL_ENTITY_NAME?: string;
  readonly VITE_BUSINESS_ADDRESS?: string;
  readonly VITE_JURISDICTION_COUNTRY?: string;
  readonly VITE_DMCA_AGENT?: string;
  /** Days an age-gate confirmation is remembered (default 30). */
  readonly VITE_AGE_GATE_DAYS?: string;
  /** Optional external URL visitors are sent to after choosing "No, exit". */
  readonly VITE_AGE_GATE_EXIT_URL?: string;
  /** 'self_declaration' (default). Other providers plug in via src/lib/ageVerification.ts. */
  readonly VITE_AGE_VERIFICATION_PROVIDER?: string;
  /** 'true' lets visitors like posts via a Supabase anonymous session (enable Anonymous sign-ins in Supabase). */
  readonly VITE_ENABLE_ANONYMOUS_LIKES?: string;
  /** 'true' once the `removal-email` Edge Function is deployed with an email provider configured. */
  readonly VITE_EMAIL_FUNCTION_ENABLED?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
