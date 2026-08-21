# Centaurion Methodology v2.0 — Software Factory

This file is the evolving *program* of the factory (the analogue of Karpathy's
`program.md` in autoresearch). The Builder reads it every night; the Reporter
appends to **Learned / Next** after every KEEP. Humans edit it to steer.

## The loop (one experiment per nightly run)

1. **Propose** — Builder reads the current spec (`specs/queue.tsv`, first row
   with status `todo`), this file, and the last 20 rows of `results.tsv`, then
   proposes ONE bounded change that moves the spec forward.
2. **Build** — the change is applied on a throwaway branch
   `builder/<spec>-<date>-<run_id>` together with jest tests
   (`tests/<spec>.test.js` are the acceptance tests for that spec).
3. **Measure** — Reviewer runs `jest --json`; **score = number of passing
   tests**; a run is only eligible if zero tests fail.
4. **Keep / Discard** — `.github/scripts/decide.sh`:
   KEEP iff all green AND score > previous best across the whole suite (global, so each run must add net new passing tests) AND ≤ 25 files
   changed. KEEP merges the branch into `main` unattended; DISCARD deletes it.
5. **Log** — one row per run in `results.tsv`
   (`date run_id spec change score prev_best verdict`), and on KEEP the
   Builder's `learned` / `next` notes are appended below.
6. **Advance** — when the Builder reports `spec_complete: true` and the run is
   a KEEP, the queue row becomes `done (run <id>)` and the next spec starts.

## Constraints the Builder must respect
- CommonJS, Node 20, jest 29, no network at test time, no runtime deps beyond Node built-ins.
- Never touch `.github/`; never delete existing tests; keep changes small enough to review in results.tsv.
- Prefer making one more acceptance test pass over broad refactors.

## Scoring (post-M1, not yet active)
CS = 0.40 x PA + 0.30 x US + 0.30 x SE

## Learned / Next
<!-- Reporter appends entries below on every KEEP. Newest last. -->
- **32428580868 / s01 / score 17** - Add Supabase schema SQL, validateReading/loadSchemaSql module, and full jest test suite for s01. 
  - learned: A concrete schema.sql plus small pure-function validator is enough to satisfy s01's acceptance criteria without any runtime deps. 
  - next: Consider adding a migration runner stub or a JSON-schema export for downstream Terra ingestion once s01 is kept. 
- **32441762179 / s02 / score 37** - Add s02 Terra sandbox client (connect/disconnect users, webhook validation/normalization) with full jest coverage. 
  - learned: A pure in-memory sandbox client plus payload validators/normalizers is enough to model Terra's connect+webhook flow without network deps. 
  - next: Add a fixtures file with realistic Terra webhook payloads and a sandbox event replay/history log for downstream ingestion testing. 
