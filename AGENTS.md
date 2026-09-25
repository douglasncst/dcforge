# Codex Workflow

## Scope and branches

- Treat `main` as the base branch and the stable integration branch.
- Never commit or push directly to `main`.
- Start every task from an up-to-date `main` branch and use a dedicated branch named `codex/<short-task-description>`.
- Keep each branch and pull request focused on one task. Do not change files unrelated to that task.
- Never merge a pull request without the user's explicit request.

## Validation

- Before changing code, run the existing relevant checks when the environment supports them and report any pre-existing failures separately.
- This repository's standard checks are:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- After making changes, run all applicable standard checks and any focused checks relevant to the changed code.
- Fix failures caused by the current task. Do not remove or weaken tests merely to make the suite pass.

## Security

- Do not modify, expose, commit, or add secrets, tokens, credentials, or real user data.
- Do not change credential-handling behavior unless that is the explicitly requested task.

## Git and pull requests

- Make small, descriptive commits.
- At the end of a completed task, push the task branch and open a pull request targeting `main`.
- Create the pull request as a draft when the work still needs review or follow-up.
- In the handoff, clearly list changed files, checks run and their results, any checks that could not run, and the pull request link.
