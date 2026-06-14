# How I built this

I work this project **markdown-first**: the durable context lives in the repo as documents, not
in my head or a chat log. The same files that make the codebase legible to a reviewer are the
ones I design and build against — and, deliberately, they double as the context I feed my tooling.

- **`CLAUDE.md`** — the project constitution: stack, conventions, and the hard rules I won't break.
- **`docs/PRD.md`** — what I'm building, and (just as important) what I'm deliberately not.
- **`docs/PLAN.md`** + **`docs/TASKS.md`** — the sequenced build I execute and check off.
- **`docs/decisions/`** — the reasoning, captured so choices survive past the moment I made them.

I built it milestone by milestone (see the git history), spec-first: write the doc, implement
against it test-first, keep `TASKS.md` in sync, and write decisions up as ADRs instead of leaving
them buried. Payments choices were grounded in the current Stripe docs rather than memory.

The takeaway is simple: good documents are good context. Writing the spec down first keeps the
work honest and the intent explicit — equally legible to a teammate, a reviewer, or an assistant.
