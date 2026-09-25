import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadState, saveState } from "../../src/lib/local.js";
import { createProject, deleteProject, getProject, listProjects } from "../../src/lib/store.js";
import { createTestUser, requireIntegrationConfig, type TestUser } from "./support.js";

/**
 * Exercises the real CLI code path — local session file -> Supabase client
 * -> RLS — against a disposable Supabase project, proving the
 * "projects_*" policies in supabase/schema.sql actually isolate users from
 * each other and from anonymous access. Never run by `npm test`; only
 * `npm run test:integration`, and only once SUPABASE_INTEGRATION_URL and
 * SUPABASE_INTEGRATION_ANON_KEY point at that disposable project. See
 * ./README.md before running this.
 */

// Runs at module load, before any test: fails the whole file loudly and
// immediately if the disposable project isn't configured.
const config = requireIntegrationConfig();

let home: string;
let originalHome: string | undefined;
let originalUrl: string | undefined;
let originalAnonKey: string | undefined;

function loginAs(user: TestUser): void {
  const state = loadState();
  state.session = user.session;
  saveState(state);
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "dcforge-integration-"));
  originalHome = process.env.CLAUDE_CONSOLE_HOME;
  originalUrl = process.env.SUPABASE_URL;
  originalAnonKey = process.env.SUPABASE_ANON_KEY;
  process.env.CLAUDE_CONSOLE_HOME = home;
  // src/lib/store.ts goes through src/lib/supabase.ts, which reads the
  // CLI's normal SUPABASE_URL/SUPABASE_ANON_KEY — funnel the disposable
  // project's credentials into them for the duration of each test only.
  process.env.SUPABASE_URL = config.url;
  process.env.SUPABASE_ANON_KEY = config.anonKey;
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.CLAUDE_CONSOLE_HOME;
  else process.env.CLAUDE_CONSOLE_HOME = originalHome;
  if (originalUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalUrl;
  if (originalAnonKey === undefined) delete process.env.SUPABASE_ANON_KEY;
  else process.env.SUPABASE_ANON_KEY = originalAnonKey;
  rmSync(home, { recursive: true, force: true });
});

describe("projects row-level security", () => {
  it("lets each user read and list only their own projects, and blocks cross-user delete", async () => {
    const userA = await createTestUser(config);
    const userB = await createTestUser(config);

    loginAs(userA);
    const projectA = await createProject(`dcforge-it-a-${Date.now()}`);

    loginAs(userB);
    const projectB = await createProject(`dcforge-it-b-${Date.now()}`);

    try {
      // A can read A; A cannot read B — RLS makes B's row invisible to A,
      // it is not a permission error.
      loginAs(userA);
      expect(await getProject(projectA.id)).toEqual(projectA);
      expect(await getProject(projectB.id)).toBeNull();
      expect((await listProjects()).map((p) => p.id)).toEqual([projectA.id]);

      // B can read B; B cannot read A.
      loginAs(userB);
      expect(await getProject(projectB.id)).toEqual(projectB);
      expect(await getProject(projectA.id)).toBeNull();
      expect((await listProjects()).map((p) => p.id)).toEqual([projectB.id]);

      // A cannot delete B's project: the RLS-filtered DELETE matches zero
      // rows, so deleteProject reports "not found" rather than an error.
      loginAs(userA);
      expect(await deleteProject(projectB.id)).toBe(false);
      loginAs(userB);
      expect(await getProject(projectB.id)).toEqual(projectB);

      // B cannot delete A's project.
      loginAs(userB);
      expect(await deleteProject(projectA.id)).toBe(false);
      loginAs(userA);
      expect(await getProject(projectA.id)).toEqual(projectA);
    } finally {
      loginAs(userA);
      await deleteProject(projectA.id).catch(() => {});
      loginAs(userB);
      await deleteProject(projectB.id).catch(() => {});
    }
  });

  it("hides every project from an anonymous, unauthenticated client", async () => {
    const owner = await createTestUser(config);
    loginAs(owner);
    const project = await createProject(`dcforge-it-anon-${Date.now()}`);

    try {
      const anon = createClient(config.url, config.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await anon.from("projects").select("*").eq("id", project.id).maybeSingle();
      // RLS filters the row out for a session with no auth.uid(): the
      // query itself succeeds, it just matches nothing.
      expect(error).toBeNull();
      expect(data).toBeNull();

      const { data: rows, error: listError } = await anon.from("projects").select("*");
      expect(listError).toBeNull();
      expect(rows).toEqual([]);
    } finally {
      loginAs(owner);
      await deleteProject(project.id).catch(() => {});
    }
  });
});
