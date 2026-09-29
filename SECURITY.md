# Security policy

Security fixes are applied to the latest code on `main`.

Do not open a public issue for a suspected vulnerability or exposed credential.
Use GitHub's private vulnerability reporting when available; otherwise contact
the maintainer through the GitHub profile. Never include active tokens,
passwords, or personal data in a report.

## DCForge Registry credentials

- DCForge Registry does not implement API-key storage.
- Never provide Supabase service-role keys. The CLI uses only a public project
  URL and anon key; access control relies on row-level security.
- Passwords are never command arguments. They are read from a hidden prompt
  or standard input with `--password-stdin`, sent to Supabase, and not stored.
- Access and refresh tokens are stored in `~/.dcforge/state.json` (or
  `$DCFORGE_HOME/state.json`). Writes are atomic; on supported systems the
  file is `0600` and directory is tightened to `0700`. Windows does not map
  those POSIX modes directly.
- On first use, a legacy state file can be copied into the new namespace only
  if no DCForge state exists. The source is preserved and is never overwritten.
- A malformed state file is moved to `state.json.corrupt-<timestamp>` rather
  than silently overwritten. That backup can contain tokens; delete it when it
  is no longer needed.
- `auth logout` clears the local session and requests remote sign-out.

## Tool isolation

Subtitle Forge has no dependency on Registry state or Supabase credentials.
The proposed Health/MCP feature is intentionally not included until its
storage, deletion, import boundaries, and threat model have been reviewed.
