import { Command } from "commander";
import { loadState, saveState, type Session } from "../lib/local.js";
import { getSupabaseClient } from "../lib/supabase.js";
import { fail } from "../lib/output.js";
import { PromptAbortedError, readFirstLine, readHidden } from "../lib/prompt.js";

interface PasswordOptions {
  passwordStdin?: boolean;
}

/**
 * Passwords are never accepted as command arguments, where they would end up
 * in shell history and process listings. They are read from a hidden
 * terminal prompt, or from standard input with --password-stdin for scripts.
 */
async function readPassword(opts: PasswordOptions, confirm: boolean): Promise<string> {
  let password: string;
  try {
    if (opts.passwordStdin) {
      password = await readFirstLine();
    } else if (!process.stdin.isTTY) {
      fail("no terminal available to prompt for a password. Pipe it in with --password-stdin.");
    } else {
      password = await readHidden("Password: ");
      if (confirm && (await readHidden("Confirm password: ")) !== password) {
        fail("passwords do not match.");
      }
    }
  } catch (err) {
    if (err instanceof PromptAbortedError) {
      console.error("Aborted.");
      process.exit(130);
    }
    throw err;
  }
  if (password === "") {
    fail("password must not be empty.");
  }
  return password;
}

function sessionFromSupabase(
  email: string,
  data: { access_token: string; refresh_token: string; expires_at?: number; user: { id: string; email?: string } },
): Session {
  return {
    email: data.user.email ?? email,
    userId: data.user.id,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at ?? null,
  };
}

export function registerAuthCommands(program: Command): void {
  const auth = program.command("auth").description("manage your Console session");

  auth
    .command("signup")
    .description("create a new Console account")
    .argument("<email>", "account email")
    .option("--password-stdin", "read the password from standard input instead of prompting")
    .allowExcessArguments(false)
    .action(async (email: string, opts: PasswordOptions) => {
      const client = getSupabaseClient();
      const password = await readPassword(opts, true);
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) {
        fail(error.message);
      }
      if (!data.session) {
        console.log(`Account created for ${email}. Check your email to confirm, then run \`auth login\`.`);
        return;
      }
      const state = loadState();
      state.session = sessionFromSupabase(email, data.session);
      saveState(state);
      console.log(`Account created and logged in as ${email}.`);
    });

  auth
    .command("login")
    .description("log in to the Claude Code Console")
    .argument("<email>", "account email")
    .option("--password-stdin", "read the password from standard input instead of prompting")
    .allowExcessArguments(false)
    .action(async (email: string, opts: PasswordOptions) => {
      const client = getSupabaseClient();
      const password = await readPassword(opts, false);
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        fail(error?.message ?? "login failed");
      }
      const state = loadState();
      state.session = sessionFromSupabase(email, data.session);
      saveState(state);
      console.log(`Logged in as ${email}.`);
    });

  auth
    .command("logout")
    .description("clear the local session")
    .action(async () => {
      const state = loadState();
      if (!state.session) {
        console.log("Already logged out.");
        return;
      }
      try {
        const client = getSupabaseClient();
        await client.auth.setSession({
          access_token: state.session.accessToken,
          refresh_token: state.session.refreshToken,
        });
        await client.auth.signOut();
      } catch {
        // best-effort remote sign-out; local session is cleared regardless
      }
      state.session = null;
      saveState(state);
      console.log("Logged out.");
    });

  auth
    .command("whoami")
    .description("show the currently logged-in account")
    .action(() => {
      const state = loadState();
      if (!state.session) {
        fail("not logged in. Run `claude-console auth login <email>`.");
      }
      console.log(state.session.email);
    });
}
