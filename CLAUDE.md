@AGENTS.md

# CLAUDE.md — github-repo-intelligence-mcp

Build context for resuming this Actor from a fresh session. The generic Apify dev guide is imported above (`@AGENTS.md`); this file adds the project-specific contract, workflow, and constraints.

## What this is

A **Standby MCP server** on Apify that returns an opinionated **health read** on any GitHub repository (Actively maintained / Slowing / At-risk / Likely abandoned), backed by transparent, inspectable metrics. #4 in the launch slate, top validator score (1.00). Differentiator is **judgment, not raw access** — it synthesizes GitHub data into verdicts an agent can act on, alongside the raw metrics so the agent can see the *why*.

Exposes 5 MCP tools: `get_repo_health` (headline), `get_activity_metrics`, `get_issue_health`, `get_pr_health`, `get_contributor_insights`.

## Canonical docs (read these first when resuming)

- **Spec (v1, approved):** `../apify-actor-idea-validator/docs/github-repo-intelligence-mcp-spec.md`
- **Implementation plan (14 tasks, TDD):** `../apify-actor-idea-validator/docs/github-repo-intelligence-mcp-plan.md`
- **Workflow brief:** `../enhanced-ai-development-workflow.md`

The plan is the source of truth for task contents (it embeds the exact test specs and reference implementations per task).

## Architecture (pure-core / I/O-shell)

All metric derivation + threshold verdicts are **pure, clock-injected** functions (unit-tested without network). One GitHub client (GraphQL-primary + REST for contributor stats) fetches one raw payload per repo, cached by repo (LRU + TTL), shared across all 5 tools. `src/main.ts` is the **only** module doing I/O / Standby bootstrap.

Module map (per plan): `types.ts`, `repo.ts`, `config.ts`, `metrics.ts`, `verdicts.ts`, `health.ts`, `cache.ts`, `github/queries.ts`, `github/client.ts`, `tools.ts`, `main.ts`. Tests in `tests/*.test.ts` (vitest).

## Development workflow (two-tier — Joe operates the gates)

- 🟣 **Claude Code (Tier 1):** architecture, write the failing test (the contract), generate Codex prompts, review, docs.
- 🟢 **Codex (Tier 2):** bounded implementation against the test (≤200 lines, ≤3 files/task).
- 🔵 **Joe:** template/architecture approval, editorial, publishing, `git push`, Standby enable.

**Per 🟣→🟢 task rhythm:** write red test → spawn a subagent to drive Codex headless → review + verify → commit → **STOP for Joe**.

**Codex headless invocation (validated):** Codex CLI 0.135.0, defaults to gpt-5.5.
```
codex exec --cd <actor-dir> --sandbox workspace-write "<bounded prompt>"
```
The subagent runs this, verifies (`npm run lint:types` + `npm test -- <module>`), reports the file + `git status` WITHOUT committing. Claude Code reviews and commits. **Do not hand-write Tier-2 impl** — preserve the tier split. Pure-data / types-only tasks (no test) are written directly by Claude Code.

## Standing rules (NON-NEGOTIABLE)

- **PAUSE after every task** for Joe's manual review — not just 🔵 gates. Do not roll into the next task.
- **NEVER `git push`** — Joe pushes manually. Commit when a task is done.
- **Standby: ALL input fields optional**, boots with no INPUT.json (no crash loop). `usesStandbyMode: true` — never disable.
- **Standby is enabled LAST**, after the final push (every `apify push` disables it).
- **Determinism is sacred** — no randomness, no time-based behavior, no network in tests; clocks/`now` injected into pure modules.
- **Lean deps:** `apify` is the only runtime dep until Task 9 (the exact MCP SDK package is confirmed/added there). Dev: `tsx`, `typescript`, `vitest`, `@types/node`. Node >=20.
- **Multi-stage Dockerfile** on `apify/actor-node:24` with a builder stage running `npm run build` (Changelog Triage `tsc not found` lesson — do not collapse to single-stage `--omit=dev`). Dockerfile changes: ask first.
- **`input_schema.json` must include `prefill`** for any field used in QA (SERP Topic Gap Monitor "Under Maintenance" lesson).

## Current state (verify against `git log` — authoritative)

As of the last session: **Tasks 0–7 committed** (last commit `cd32244`). Resume at **Task 8 (`TtlLruCache`, `src/cache.ts` + `tests/cache.test.ts`)** — 🟣→🟢: write the failing test verbatim, confirm red, drive Codex for the impl (clock injected for determinism), then STOP for review. Full suite green at pause: **46/46 across 6 files**.

The **pure-core layer is complete** (config → metrics → verdicts → health composition):
- Task 0 — scaffold (`ts-mcp-empty`, lean deps, standalone tsconfig, minimal node:http Standby stub in `main.ts`, actor.json categories `AI_GPT_AND_LLMS`/`DEVELOPER_TOOLS` + MCP tags).
- Task 1 — `src/types.ts` (shared types).
- Task 2 — `src/repo.ts` + `tests/repo.test.ts` (repo parser; Codex).
- Task 3 — `src/config.ts` (`DEFAULTS` + `THRESHOLDS`; pure data, Claude Code).
- Task 4 — `src/metrics.ts` `median` + `momentumTrend` (Codex).
- Task 5 — `src/metrics.ts` dimension computers `activityMetrics`/`issueMetrics`/`prMetrics`/`contributorMetrics` (Codex).
- Task 6 — `src/verdicts.ts` dimension verdicts (Codex; used the plan's Step-5 corrected `contributorVerdict` — solo maintainer caps at Moderate, not At-Risk).
- Task 7 — `src/health.ts` `composeOverall` + `rationale` (Codex).

**Codex headless gotcha (cost ~30 min this session):** `codex exec` blocks forever on non-TTY stdin (`Reading additional input from stdin...`). ALWAYS invoke with `< /dev/null`. Run with `RUST_LOG=info` teed to a log for visibility. Do NOT bake a `pkill -f "codex…"` cleanup into the same command line that launches codex — the pattern self-matches and kills the new run. See project memory `feedback_codex_headless_stdin.md`.

Next after Task 8: **Task 9** begins the I/O shell (GitHub client, GraphQL+REST) and is where the **MCP SDK runtime dep is confirmed/added** — ask before installing.

Progress is tracked by the plan's `- [ ]` checkboxes and `git log`. `src/main.ts` is a placeholder stub until **Task 14** (full MCP server bootstrap).

## Open items to resolve before first `apify push`

- Dockerfile builder + final stages run `RUN npm ls @crawlee/core apify puppeteer playwright`; `puppeteer`/`playwright` are not deps and may not be on the base image — could fail a real `docker build` (not exercised by local `npm run build`). Decide whether to trim that line.
- Task 14's MCP handler must validate the `repo` arg type at the boundary (spec §6) — `parseRepo` is typed `(input: string)` and has no runtime non-string guard.

## Commands

```bash
npm install
npm run build        # tsc -> dist/ (Task 0 baseline gate)
npm run lint:types   # tsc --noEmit
npm test             # vitest run
npm test -- <name>   # run one module's tests
npm start            # tsx src/main.ts (local Standby)
```
