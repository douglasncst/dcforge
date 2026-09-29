# Security policy

Security fixes are applied to the latest code on `main`.

Do not open a public issue for a suspected vulnerability or exposed credential.
Use GitHub's private vulnerability reporting for this repository when
available. If it is unavailable, contact the maintainer through the contact
method listed on the GitHub profile. Do not include active tokens, passwords,
or personal data in a report.

## How the CLI handles credentials

- `claude-console` does not implement API-key storage.
- Supabase service-role keys must never be provided to the CLI. Only the
  public project URL and anon key are used; access control relies on
  row-level security.
- Passwords are never accepted as command arguments. They are read from a
  hidden terminal prompt or, with `--password-stdin`, from standard input.
  Passwords are sent to Supabase and never stored.
- The Supabase access and refresh tokens are stored in
  `~/.claude-console/state.json` (or `$CLAUDE_CONSOLE_HOME/state.json`). The
  file is always written atomically as `0600`, and the directory is
  tightened to `0700` on every save, including one left over from an older
  version of the CLI or created some other way with looser permissions.
  These permissions are not enforced on Windows.
- A state file that cannot be parsed is moved aside to
  `state.json.corrupt-<timestamp>` rather than overwritten. Such a backup may
  still contain tokens: delete it once you no longer need it.
- `auth logout` clears the local session and asks Supabase to sign out.
