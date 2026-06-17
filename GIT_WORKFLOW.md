# Git workflow (Partho / SJI)

## For humans

1. Work on a feature or fix branch (e.g. `feature/...-v13`, `fix/portal-profession-trigger`).
2. Open a PR into `main`.
3. Merge via GitHub after review.

**Avoid pushing directly to `main`.**

### Install local hook (blocks accidental push to main)

```sh
npm run install-git-hooks
```

This sets `core.hooksPath` to `.githooks/`. Pushes to `main`/`master` are rejected unless you explicitly override:

```sh
ALLOW_MAIN_PUSH=1 git push origin main   # human only — rare
```

### GitHub (recommended)

On the repo **Settings → Branches → Branch protection** for `main`:

- Require a pull request before merging
- Restrict who can push to `main`
- Do not allow bypassing (or limit to admins only)

That stops **everyone** (including AI tools) from pushing to `main` at the server.

---

## For AI agents (Cursor)

**Hard rules:**

- No `git commit` without explicit approval in the same user message.
- No `git push` without explicit approval and a **named branch**.
- No push to `main` unless the user message literally says **"push to main"**.
- Bug fixes: change code locally → show diff → ask → wait.

Rules live in:

- `.cursor/rules/git-never-push-without-approval.mdc` (`alwaysApply: true`)
- `.cursor/rules/git-shell-command-gate.mdc` (`alwaysApply: true`)
- `AGENTS.md`

---

## Approval phrases (examples)

| User says | Agent may |
|-----------|-----------|
| "commit on fix/foo with message …" | Commit on that branch |
| "push branch fix/foo" | Push that branch only |
| "push to main" | Push `main` (exception) |
| "open PR" | Create PR after push (if approved) |
| "fix and push" | **Ask** which branch — not approval |
| "push after fix" | **Ask** which branch — not approval |
