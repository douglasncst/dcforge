import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Session } from "../../src/lib/local.js";

// Deliberately different names from SUPABASE_URL/SUPABASE_ANON_KEY (which
// the CLI itself reads) so that having those set for everyday `claude-console`
// use can never make this suite silently point at a real project.
const REQUIRED_VARS = ["SUPABASE_INTEGRATION_URL", "SUPABASE_INTEGRATION_ANON_KEY"] as const;

export interface IntegrationConfig {
  url: string;
  anonKey: string;
}

/**
 * Throws immediately (call it at module scope, not inside a hook) if the
 * disposable project isn't configured, so `npm run test:integration` fails
 * fast with an actionable message instead of hanging on network calls or,
 * worse, silently reporting an empty suite as passing.
 */
export function requireIntegrationConfig(): IntegrationConfig {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Supabase integration tests require ${REQUIRED_VARS.join(" and ")}, set to a ` +
        `DISPOSABLE Supabase project — never production. Missing: ${missing.join(", ")}. ` +
        "See test/integration/README.md.",
    );
  }
  return {
    url: process.env.SUPABASE_INTEGRATION_URL as string,
    anonKey: process.env.SUPABASE_INTEGRATION_ANON_KEY as string,
  };
}

export interface TestUser {
  email: string;
  userId: string;
  session: Session;
}

/**
 * Signs up a fresh, randomly named user against the disposable project and
 * returns their session in the shape src/lib/local.ts's saveState() expects,
 * so tests can log in as them through the real local-state code path.
 *
 * Requires email confirmation to be OFF on that project — the default for
 * `supabase start`, and for a throwaway hosted project turn off
 * Authentication > Providers > Email > "Confirm email". Otherwise signUp
 * returns no session and this throws saying so.
 */
export async function createTestUser({ url, anonKey }: IntegrationConfig): Promise<TestUser> {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const email = `dcforge-integration-${randomUUID()}@example.test`;
  const password = randomUUID();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) {
    throw new Error(`signUp failed for ${email}: ${error.message}`);
  }
  if (!data.session || !data.user) {
    throw new Error(
      `signUp for ${email} returned no session. Disable email confirmation on this ` +
        'disposable project (Authentication > Providers > Email > "Confirm email") — ' +
        "see test/integration/README.md.",
    );
  }
  return {
    email,
    userId: data.user.id,
    session: {
      email: data.user.email ?? email,
      userId: data.user.id,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? null,
    },
  };
}
