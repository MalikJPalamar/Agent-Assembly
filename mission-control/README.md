# Mission Control

> Multi-agent orchestration dashboard for the Centaurion Framework

## Purpose

Mission Control is the unified command center for agentic, iterative development across all Centaurion components. It tracks spec status, agent schedules, dependency graphs, and milestone progress — and after Milestone 1, drives the autoresearch self-improvement loop.

## What It Tracks

- **19 specs** across 3 components (Neurowellness, Cognitive Component, Symbiotic Engine)
- **95 tests** (TDD-first: every feature starts as a failing test)
- **5 milestones** (M0 Foundation → M5 Autoresearch)
- **5 agent roles** (Architect, Builder, Reviewer, Researcher, Reporter)
- **Dependency graph** with auto-blocked detection
- **Daily cycle** (09:00–21:00 CET agent schedule)

## Agent Roles

| Agent | Role | Schedule |
|-------|------|----------|
| Architect | Spec decomposition, integration design | On-demand |
| Builder | TDD implementation of specs | Daily 09:30–12:00 |
| Reviewer | Code review, test validation, security | Daily 14:00 |
| Researcher | Market/tech signal scanning | Weekly |
| Reporter | Progress reporting, push to repo | Daily 21:00 |

## Autoresearch Loop (Post-Milestone 1)

Adapted from [karpathy/autoresearch](https://github.com/karpathy/autoresearch):

```
Hypothesis -> Experiment -> Measure -> Keep or Discard -> Repeat
```

**Composite Score** = 0.40 x Prediction Accuracy + 0.30 x User Satisfaction + 0.30 x System Efficiency

One experiment per 3-cycle window. Keep if CS improves, discard if not. Format/source changes auto-evolve; framework changes require approval.

## Connected Components

- [centaurion-framework/](../centaurion-framework/) — Specs, methodology, and implementation
- [situational-awareness-lens](https://github.com/MalikJPalamar/situational-awareness-lens) — SA stock analysis (same autoresearch methodology)

## Interactive Dashboard

The full interactive Mission Control dashboard (React, with persistent state) is rendered as a Claude artifact. The stub JSX is included here for reference.

---

Built by [Malik Palamar](https://centaurion.me)
