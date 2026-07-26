# The Dark Kick — Workflow

> How the three participants (Viktor, Claude, Codex) collaborate, and what each
> doc is for. Read this once; then just follow the loop.

---

## Why this exists

Viktor works on limited Claude + ChatGPT plans, so the economical division is:
**reason with Claude, implement with Codex.** The docs are the *interface*
between the two — a good doc set means a new session reloads from two or three
markdown files instead of re-reading the whole repo.

---

## Doc architecture — one owner, one job, separated by rate of change

| Doc | Rate of change | Audience | Owner |
|---|---|---|---|
| `PROJECT_BRIEF.md` | rarely | humans reasoning | Viktor + Claude |
| `DESIGN.md` | every session | humans reasoning | Viktor + Claude |
| `ROADMAP.md` | every session (verdicts) | humans reasoning | Viktor + Claude |
| `CURRENT_PR.md` | per PR | **Codex** (to build) | Claude writes, Codex reads |
| `README.md` | per PR | anyone | **Codex** (implementation record) |
| `WORKFLOW.md` | rarely | all | Viktor + Claude |

**Reasoning docs** (brief / design / roadmap) are for Viktor and Claude.
**The PR spec** is for Codex. **The README** is Codex's record of what exists.
Keeping these separate is what stops vision fluff from leaking into build specs
and stops build detail from bloating the vision.

---

## The loop

Each participant writes only the artifact they're actually qualified to write.

1. **Plan** — *Viktor + Claude.* Decide the next experiment: its hypothesis and,
   for the current one, a full spec. Claude updates `DESIGN.md` and `ROADMAP.md`,
   then writes a clean `CURRENT_PR.md`.
2. **Build** — *Codex.* Implements the PR and writes the **PR summary** (what it
   actually built, assumptions, surprises). Codex is the only one who knows the
   implementation details, so it owns this record. Codex also updates `README.md`
   and checks off the roadmap item.
3. **Playtest** — *Viktor, alone.* The crucial step no one else can do: proving
   whether it's *fun* is a human judgment. Claude can't feel the game.
4. **Evaluate** — *Viktor + Claude.* Viktor brings raw impressions; Claude helps
   turn them into a **verdict against the original hypothesis** (proved /
   disproved / complicated) and hands back a tight, **paste-able** evaluation for
   the GitHub PR.
5. **Log** — that verdict becomes the one-line entry under the milestone in
   `ROADMAP.md`, and the next experiment gets sharpened. This is what makes the
   next session start sharp.

```
plan (V+C) → build + PR summary (Codex) → playtest (V) → evaluate (V+C) → roadmap verdict
     ▲                                                                          │
     └──────────────────────── next experiment sharpened ◄─────────────────────┘
```

---

## Planning horizon

- **Current PR:** specified in full in `CURRENT_PR.md`.
- **Next 1–2:** sketched in `ROADMAP.md` as a question + rough approach.
- **Beyond:** a loose, ordered parking lot, re-sorted after each session.

We deliberately do **not** sharply plan far-out PRs — each experiment changes
what the next question should be.
