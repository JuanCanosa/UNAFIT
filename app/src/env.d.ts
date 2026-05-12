/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SUPABASE_URL:              string;
  readonly SUPABASE_ANON_KEY:         string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly RESEND_API_KEY:            string;
  readonly FROM_EMAIL:                string;
  readonly SITE:                      string;
  readonly PUBLIC_APP_URL:            string;
  readonly ASAAS_API_KEY:             string;
  readonly ASAAS_SANDBOX:             string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    supabase: import('@supabase/supabase-js').SupabaseClient;
    user:     import('@supabase/supabase-js').User | null;
  }
}
