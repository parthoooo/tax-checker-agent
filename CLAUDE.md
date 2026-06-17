
## Git — HARD STOP (read first)

**Partho: never `git commit`, `git push`, or open/merge PRs without explicit approval in the user's current message.**

- Never push to `main` unless the user literally says **"push to main"**.
- "fix and push" / "push after fix" → ask which branch; not approval.
- Urgency does not override this.

See `.cursor/rules/git-never-push-without-approval.mdc`, `AGENTS.md`, `GIT_WORKFLOW.md`.

---

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
