# Security design for a future health-data feature

Status: design notes for future work. **Nothing here is implemented.** PR #8
(`claude/conector-saude-tp8crw`, "Add health MCP connector") must not be
merged as submitted — this document explains why and what a redesign needs
to satisfy before it can be.

## Why this needs its own document

Health data is not like a project name or a config value: it identifies a
real person and can reveal medical conditions. It deserves a stricter design
than "another field in the state file", and the CLI's own
[SECURITY.md](../SECURITY.md) and [AGENTS.md](../AGENTS.md) already commit to
treating it that way. This document is that stricter design.

## What PR #8 actually does today (the problem, concretely)

Reviewed directly from the branch, not from its PR description:

1. **Shared state file.** `src/lib/store.ts` on that branch adds
   `healthConnection` and `healthRecords` to the *same* `State` type that
   holds the Supabase session's access and refresh tokens, in the *same*
   `~/.claude-console/state.json`. The CLI's `health` commands and the
   separate `health-mcp-server/` process both read and write it directly (it
   duplicates `src/lib/store.ts`'s `loadState`/`saveState` rather than
   importing them). Two processes now race on one file, and a bug or an
   overly broad backup/sync tool touching that file exposes health records
   and session tokens together.
2. **Weaker file permissions than the session file.**
   `health-mcp-server/src/services/store.ts`'s `saveState` calls
   `writeFileSync(stateFile(), ..., "utf-8")` and `mkdirSync(dir, {
   recursive: true })` with **no mode argument at all** — neither the `0600`
   file nor the `0700` directory this repository's own `src/lib/local.ts`
   enforces for the session file it's colocated with.
3. **No deletion.** `health disconnect` clears the provider connection but
   not the imported records; there is no command to delete them at all.
   There's no data-retention story.
4. **Unrestricted file reads.** `health import <file>` /
   `health_import_records`'s `file_path` reads whatever path it's given with
   `readFileSync(file_path, "utf-8")` — no allow-listed directory, no
   containment check. An MCP client (or a script) can point it at any file
   the OS-level user running the process can read.
5. **No retention or consent model**, no mention of how long records are
   kept or how a user would find out what's stored.

None of this is about the MCP protocol being unsafe in general — it's that
this particular implementation didn't design for data this sensitive.

## Requirements for a future implementation

### 1. Storage isolation

- Health data lives in **its own file**, e.g.
  `~/.claude-console/health/records.json` or a dedicated
  `CLAUDE_CONSOLE_HEALTH_HOME`, never inside `state.json`.
- It reuses `src/lib/local.ts`'s atomic-write and permission-tightening
  logic (or a factored-out version of it) — `0600` file, `0700` directory,
  tightened on every save, not just on creation. No new hand-rolled
  `writeFileSync` with no mode argument, as PR #8's MCP server has today.
- The CLI process and the MCP server process, if both exist, go through the
  **same** storage module (imported, not duplicated) so there is one place
  that enforces the above instead of two that can drift.

### 2. No sharing with session state

- The health store and the session/config store (`src/lib/local.ts`) are
  separate files with separate lifecycles. Deleting one must never affect
  the other. `auth logout` must not touch health data, and clearing health
  data must not touch the session.

### 3. Deletion and retention

- A command to delete **all** imported records (and the provider
  connection) in one step, and, if per-record deletion is offered, by id or
  by type/date range.
- A documented retention default (e.g. "kept until you delete them; nothing
  is deleted automatically") — implicit indefinite retention is a decision,
  so make it an explicit, stated one.
- Uninstalling/removing the tool's data directory should be a single
  documented step (`rm -rf <health data dir>` or a provided command).

### 4. Restricted import, no arbitrary filesystem reads

- `health import <file>` must resolve the path and check it is inside an
  allow-listed directory (e.g. the user's home directory, or a directory the
  user explicitly configured), rejecting `..` traversal and symlinks that
  escape it, rather than accepting any path a caller supplies.
- The MCP tool version of import is the more sensitive surface, since its
  caller is an LLM-driven agent, not necessarily the human at the keyboard:
  it should have the *same* path restriction, or accept only inline
  `records` (already offered as an alternative to `file_path` in PR #8) and
  drop `file_path` entirely for the MCP tool while keeping it for the local
  CLI command where a human is directly in control of the argument.
- No tool should offer a generic "read this file" capability disguised as a
  health import; validate the parsed shape strictly (PR #8's
  `parseHealthImport` already does reasonable shape validation — keep that,
  add the path restriction in front of it).

### 5. Log and error redaction

- Error messages and logs must never include record values (a
  blood-pressure reading, a diagnosis code) or the raw file contents — file
  *paths* and record *counts* are fine, record *values* are not, mirroring
  how this repository's `SECURITY.md` already treats tokens: named, not
  printed.

### 6. Threat model

| Threat | Mitigation |
|---|---|
| Another local user/process on a shared machine reads health data | `0600`/`0700`, enforced on every save |
| The MCP server is pointed at an unintended file via `file_path` | Path allow-listing (§4) |
| Health data leaks into the same backup/sync surface as session tokens because it's in one file | Separate storage (§1, §2) |
| A user can't get their data removed | Deletion command (§3) |
| An agent-facing tool over-collects by reading files nobody asked it to | No generic file-read capability (§4) |
| Sensitive values end up in error output shared for debugging (e.g. pasted into a GitHub issue) | Redaction (§5) |

### 7. MCP trust boundary and least privilege

- The MCP server is a separate OS process with its own capability surface;
  it should request/need nothing beyond read/write access to its own health
  data directory. It must not need or use the Supabase session at all —
  health data in this design has no server-side/Supabase component.
- Each MCP tool's `inputSchema` should stay as strict as PR #8's already are
  (`.strict()` on the zod schemas) — no undocumented extra fields silently
  accepted.
- Treat the MCP client (whatever agent is calling these tools) as making
  requests on behalf of the user, not as the user: destructive operations
  (delete-all) should have a confirmation step or an explicit
  `confirm: true`-style parameter, the same way this repository's `keys`
  command was left disabled rather than shipped half-done.

## What this document is not

It is not a green light to implement Health once these boxes are checked
without further review — a feature handling health data warrants a
dedicated security review at implementation time, not just adherence to a
document written before any of the real code existed. It exists so that
review has a concrete baseline to check against, and so PR #8 in its current
form has a clear, written reason it isn't simply merged.
