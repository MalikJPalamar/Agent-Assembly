# Agent Assembly

> The developer and deployment pipeline that takes implementation plans to production through iterative, autonomous daily cycles.

## What This Is

Agent Assembly is NOT a product — it's the factory. It manages the full orchestration of multiple software projects, each developed autonomously by Claude Code on daily scheduled tasks.

## The Software Factory loop (nightly, unattended)

Agent Assembly is Karpathy's [autoresearch](https://github.com/karpathy/autoresearch) loop
repurposed for software. Every night at 02:00 UTC `.github/workflows/centaurion-daily-builder.yml`
runs **one experiment**:

| Stage | Job | What happens |
|---|---|---|
| Propose | Architect + Builder | pick the first `todo` spec in `centaurion-framework/specs/queue.tsv`; Claude proposes ONE bounded change using `methodology.md` + the last 20 rows of `results.tsv` as memory, and writes/extends `tests/<spec>.test.js` |
| Build | Builder | files land on a throwaway branch `builder/<spec>-<date>-<run_id>` (strict JSON output, path-safety checks, no `.github/` edits, max 25 files) |
| Measure | Reviewer | `jest --json`; **score = passing tests**; red tests make the run ineligible but never break the pipeline |
| Keep / Discard | Reporter | `.github/scripts/decide.sh`: KEEP iff all green **and** score > previous best (global, whole suite) → merged into `main` automatically; otherwise the branch is deleted |
| Log | Reporter | one row in `centaurion-framework/results.tsv` (`date run_id spec change score prev_best verdict`); on KEEP the Builder's *learned* / *next* notes are appended to `methodology.md` so the next run starts smarter |
| Advance | Reporter | when the Builder reports `spec_complete: true` on a KEEP, the queue row becomes `done (run <id>)` and the next spec begins |

Read `results.tsv` top to bottom to see the factory learn; edit `methodology.md` or the queue to steer it.
Add a spec by appending a row to `specs/queue.tsv` and (optionally) a `specs/<id>.md` with acceptance criteria.
`results-legacy.tsv` holds the pre-factory daily reports (Apr–Aug 2026).

Manual run: `gh workflow run "Centaurion Daily Builder" -R MalikJPalamar/Agent-Assembly` (optional input `spec_override=s02`).

## Architecture

```
Agent Assembly (this repo)
│   Orchestrator: plans, pipeline, tracking, deployment
│
├── dispatches → aob-neurowellness (daily 06:00 CET)
│   AOB breathwork + wearable biometrics platform
│   12 specs | 60 tests | 4 milestones
│
├── dispatches → centaurion-framework (daily 06:00 CET)
│   Cognitive Component + Symbiotic Engine
│   7 specs | 35 tests | 2 milestones
│
└── dispatches → [future projects...]
```

## How It Works

### The Pipeline: Plan → Production

```
1. PLAN        Write implementation-plan.md with specs, tests, milestones
2. CONSTITUTE  Write CLAUDE.md — the constitution Claude Code follows
3. SCHEDULE    Set up Cloud scheduled task at claude.ai/code/scheduled
4. ITERATE     Claude Code runs daily: read state → pick spec → TDD → commit → push
5. EVOLVE      Post-milestone: autoresearch loop optimizes methodology
6. DEPLOY      Dokploy on Hostinger VPS deploys passing milestones
7. REVIEW      Human reviews iteration output, approves framework changes
```

### Daily Cycle (per project, all at 06:00 CET parallel)

```
Claude Code wakes up
  → reads CLAUDE.md (constitution)
  → reads methodology.md (current state)
  → selects next unblocked spec from priority queue
  → writes failing tests (TDD)
  → implements minimum code to pass
  → runs test suite
  → commits with spec ID reference
  → updates results.tsv + methodology.md
  → pushes to main
  → exits
```

### Autoresearch Loop (post-milestone)

Adapted from [karpathy/autoresearch](https://github.com/karpathy/autoresearch):

```
Hypothesis → Experiment → Measure → Keep or Discard → Repeat
```

CS = 0.40 x PredictionAccuracy + 0.30 x UserSatisfaction + 0.30 x SystemEfficiency

## Managed Projects

| Project | Repo | Specs | Status |
|---------|------|-------|--------|
| AOB Neurowellness | [aob-neurowellness](https://github.com/MalikJPalamar/aob-neurowellness) | 12 | Active |
| Centaurion Framework | [centaurion-framework](https://github.com/MalikJPalamar/centaurion-framework) | 7 | Active |

## Setting Up a New Project

1. Create repo with `CLAUDE.md` (use `templates/CLAUDE.md.template`)
2. Write `implementation-plan.md` with specs and test cases
3. Add `methodology.md`, `results.tsv`, `changelog.md`, `package.json`
4. Go to `claude.ai/code/scheduled` → create Cloud task pointing at the repo
5. Set schedule: daily at 06:00 CET
6. Prompt: "Read CLAUDE.md and execute the daily protocol"

## Scheduling (Claude Code Max)

All scheduled tasks are Cloud tasks via `claude.ai/code/scheduled`:

| Task | Repo | Schedule | Prompt |
|------|------|----------|--------|
| AOB Builder | aob-neurowellness | Daily 06:00 CET | Read CLAUDE.md and execute the daily protocol |
| Centaurion Builder | centaurion-framework | Daily 06:00 CET | Read CLAUDE.md and execute the daily protocol |

Cloud tasks run on Anthropic infrastructure — no local machine needed.

## Deployment Pipeline

Target: Dokploy on Hostinger VPS (srv1514399.hstgr.cloud)
- Traefik for routing/SSL
- GitHub webhooks trigger deployment on milestone completion
- Each project deploys independently

---

Built by [Malik Palamar](https://centaurion.me) | BuilderBee x AOB x Centaurion
