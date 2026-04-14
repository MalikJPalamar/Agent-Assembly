# Agent Assembly Pipeline

## From Implementation Plan to Production

### Phase 1: Plan
- Define specs with test cases (5 tests per spec minimum)
- Order specs by dependency graph
- Group into milestones with target dates
- Write CLAUDE.md constitution for the project

### Phase 2: Bootstrap
- Create GitHub repo with standard structure
- Push CLAUDE.md, implementation-plan.md, methodology.md, results.tsv
- Initialize package.json with test framework
- Create Cloud scheduled task at claude.ai/code/scheduled

### Phase 3: Iterate
- Claude Code runs daily at 06:00 CET
- Reads CLAUDE.md → picks next spec → TDD → commit → push
- Tracks progress in results.tsv
- Updates methodology.md with current state

### Phase 4: Evolve (post-milestone)
- Autoresearch loop activates
- One experiment per 3-cycle window
- Measure Composite Score
- Keep or discard based on CS delta

### Phase 5: Deploy
- Milestone passing triggers deployment pipeline
- Dokploy on Hostinger VPS
- Traefik handles routing and SSL
- Health checks validate deployment

### Phase 6: Review
- Human reviews iteration output weekly
- Approves/rejects framework-level changes via GitHub issues
- Adjusts priorities if needed
