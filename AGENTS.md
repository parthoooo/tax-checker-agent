# Agent instructions (Cursor / AI)

## Git — highest priority (Partho)

**Do not commit, push, merge, or open PRs without explicit approval in the user's current message.**

| Rule | Detail |
|------|--------|
| Default | Feature branch + PR; never assume `main` |
| Push to `main` | Forbidden unless user literally says **"push to main"** |
| Urgency | Never bypass approval for bugs or production issues |
| Implied approval | "fix and push", "push after fix" → **ask which branch first** |

Before `git commit` or `git push`, complete the checklist in `.cursor/rules/git-never-push-without-approval.mdc`.

Human workflow doc: [GIT_WORKFLOW.md](./GIT_WORKFLOW.md)

---

## Skill routing

See [CLAUDE.md](./CLAUDE.md) for skill routing (plan, review, QA, ship, etc.).

**Note:** `/ship` and `/land-and-deploy` skills still require explicit user approval before any git push in this repo.
