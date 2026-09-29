# ADR 0001: sibling packages, not npm workspaces

Status: accepted, revisited 2026-09-29.

## Context

The repository now contains two independent shipped tools:

- the root `dcforge` package, a Supabase-backed project registry CLI; and
- `subtitle-forge/`, a local-first subtitle pipeline with its own package,
  lockfile, tests, and CI workflow.

The trigger in the previous version of this ADR has occurred: DCForge now has
multiple independent tools. That does not by itself justify workspace tooling.
They share no runtime imports, state namespace, or dependency-resolution need.

The historical package name and state namespace were migrated to `dcforge` and
`~/.dcforge`. References to the former name are retained only in the one-time
state migration implementation and documentation of that migration.

Last.fm (#10) remains proposed. Health/MCP (#8) is not a candidate package:
its submitted design combines health records and session data, lacks deletion
lifecycle, and needs a security redesign before implementation.

## Decision

Keep independent tools as sibling packages with their own `package.json`,
lockfile, tests, README, and path-scoped CI. Do not introduce npm workspaces
in this round.

This preserves clear isolation while avoiding a shared lockfile and release
policy that the tools do not currently need.

## Revisit when

- two tools need shared code and a stable internal package boundary;
- coordinated dependency resolution becomes a demonstrated maintenance cost;
- releases require common versioning, publishing, or contributor workflows.
