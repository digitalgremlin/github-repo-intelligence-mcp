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

**Codex scope guard (NON-NEGOTIABLE):** Every Codex prompt MUST include an explicit "Do NOT modify `.actor/actor.json` or any file other than `<target files>`" instruction. Left unguarded, Codex follows the AGENTS.md `generatedBy` directive and rewrites `.actor/actor.json` → `meta.generatedBy` (flips it to "Codex with GPT-5") on unrelated tasks. These projects are Claude-Code-orchestrated, so `generatedBy` must stay "Claude Code …" and never churn per-task. After every Codex run, `git status --short` and revert any stray edits before committing — stage only the intended files. (Caught on Task 9; see project memory `feedback_codex_generatedby_guard.md`.)

## Standing rules (NON-NEGOTIABLE)

- **PAUSE after every task** for Joe's manual review — not just 🔵 gates. Do not roll into the next task.
- **NEVER `git push`** — Joe pushes manually. Commit when a task is done.
- **Standby: ALL input fields optional**, boots with no INPUT.json (no crash loop). `usesStandbyMode: true` — never disable.
- **Standby is enabled LAST**, after the final push (every `apify push` disables it).
- **Determinism is sacred** — no randomness, no time-based behavior, no network in tests; clocks/`now` injected into pure modules.
- **Lean deps:** `apify` is the only runtime dep until Task 9 (the exact MCP SDK package is confirmed/added there). Dev: `tsx`, `typescript`, `vitest`, `@types/node`. Node >=20.
- **`overrides.file-type` `^21.3.2` (in package.json):** forces the transitive `file-type` past `@crawlee/utils`'s declared `^20.0.0` to clear 3 moderate advisories (ASF infinite-loop + ZIP decompression-bomb DoS) that `npm audit fix` could not resolve in-range. Safe here — the actor never exercises crawlee's `file-type` path (no crawling; GitHub JSON only) — and the full suite + Standby boot pass on `file-type@21.3.x`. **Re-check this override whenever `apify`/crawlee is bumped:** if upstream moves to a patched `file-type`, drop the override.
- **Multi-stage Dockerfile** on `apify/actor-node:24` with a builder stage running `npm run build` (Changelog Triage `tsc not found` lesson — do not collapse to single-stage `--omit=dev`). Dockerfile changes: ask first.
- **`input_schema.json` must include `prefill`** for any field used in QA (SERP Topic Gap Monitor "Under Maintenance" lesson).

## Current state (verify against `git log` — authoritative)

As of the last session: **Tasks 0–13 committed + a pre-deploy hardening pass** (last commit `00b59d0`). Resume at **Task 14 (Deploy — all 🔵 Joe gates: `git push`, `apify push`, enable Standby LAST)**. Full suite green at last test run: **63/63 across 10 files**; `npm audit` = **0 vulnerabilities**. Working tree clean.

The full **pure-core + I/O-shell + Standby server** is built and wired end to end:
- Tasks 0–7 (pure core) — scaffold, `types.ts`, `repo.ts`, `config.ts` (`DEFAULTS`/`THRESHOLDS`), `metrics.ts` (`median`/`momentumTrend` + dimension computers), `verdicts.ts` (solo maintainer caps at Moderate), `health.ts` (`composeOverall`/`rationale`).
- Task 8 — `src/cache.ts` `TtlLruCache` (clock-injected) + tests.
- Task 9 — `src/github/queries.ts` + `src/github/client.ts` `fetchRepoPayload` (GraphQL primary + REST contributors; `GithubError` NOT_FOUND/RATE_LIMITED/UPSTREAM; `fetchFn` injected).
- Task 10 — `src/tools.ts` pure builders (`buildRepoHealth` + 4 dimension builders).
- Task 11 — `src/main.ts` Standby MCP server (node:http; readiness probe; stateless `StreamableHTTPServerTransport` per request; 5 tools). **MCP SDK dep added** (`@modelcontextprotocol/sdk@^1.29.0`, `zod@^4.4.3`). `.actor/actor.json` input props populated. `main.ts` is now the real bootstrap, NOT a stub.
- Task 12 — `tests/fixtures/{active,slowing,abandoned}.json` (real payloads: honojs/hono, chalk/chalk, request/request; `NOW` pinned 2026-06-01) + `tests/integration.test.ts`. Scratch capture tool was removed; regen recipe is in the "Test fixtures" section below.
- Task 13 (`00b59d0`) — product `README.md` (what it does, 5 tools with verified example I/O, verdict thresholds table + overall composition, token setup, `totalContributors` all-time-proxy note, "Works well with" cross-links). SEO title/description/categories are set in the Apify Console at publish (NOT committed to `actor.json`); drafted strings live in the session log, not the repo.

**Pre-deploy hardening pass (after Task 12, all committed):** three real production bugs found during fixture capture + the npm audit, all fixed TDD/tier-split:
- **Bug A** (`6c8468a`) — contributors now sourced from the REST `/contributors` list endpoint, NOT `/stats/contributors` (which returns 202 on a cold cache and rarely warms → empty contributors in prod).
- **Bug C** (`ee6ada9`) — commit history fetched over `max(windowDays, 365)` days so the activity Moderate/At-Risk bands are reachable (was using the 90d analysis window).
- **Bug B** (`b66164b`) — renamed `activeContributors90d`→`totalContributors` (it was a raw count, never 90d-active); dropped `newContributors90d` (unfeedable after Bug A). Verdict thresholds unchanged.
- **Vulns** (`d81bb4d`) — `overrides.file-type ^21.3.2` clears 3 moderate transitive advisories → 0 vulns (see Lean-deps rule for the re-check-on-bump caveat).

**Codex headless gotchas (learned the hard way):** `codex exec` blocks forever on non-TTY stdin — ALWAYS invoke with `< /dev/null`, `RUST_LOG=info` teed to a log; never bake a self-matching `pkill -f "codex…"` into the launch line (`feedback_codex_headless_stdin.md`). When driving Codex via a subagent against a red test, do NOT tell the subagent to "revert all but the impl file" — it wipes the intentional uncommitted red test; whitelist the test or have it report-without-reverting (`feedback_codex_subagent_revert_test.md`).

Next: **Task 14** (deploy, all 🔵 Joe gates: `git push` → `apify push` → verify build + 0 vulns + README renders → enable Standby LAST, every push disables it → smoke-test `get_repo_health` → failure alert (no run-duration alert) → publish + set Console SEO fields). Progress tracked by the plan's `- [ ]` checkboxes and `git log`.

## Open items to resolve before first `apify push`

- Dockerfile builder + final stages run `RUN npm ls @crawlee/core apify puppeteer playwright`; `puppeteer`/`playwright` are not deps and may not be on the base image — could fail a real `docker build` (not exercised by local `npm run build`). Decide whether to trim that line.
- Task 14's MCP handler must validate the `repo` arg type at the boundary (spec §6) — `parseRepo` is typed `(input: string)` and has no runtime non-string guard.

## Test fixtures (regenerating)

`tests/fixtures/{active,slowing,abandoned}.json` are real captured `RawRepoPayload`s (honojs/hono, chalk/chalk, request/request) with `NOW` pinned to 2026-06-01. No capture tool ships — to regenerate: fetch a repo payload via `fetchRepoPayload`, then source contributors from the GitHub REST `/repos/{owner}/{name}/contributors` list endpoint (NOT `/stats/contributors`, which returns 202 on a cold cache and rarely warms — that was Bug A). Map each to `{login, commits: contributions, firstCommitAt}` and trim nodes to <100. Keep `NOW` aligned to the capture date if real commit dates shift a verdict.

## Commands

```bash
npm install
npm run build        # tsc -> dist/ (Task 0 baseline gate)
npm run lint:types   # tsc --noEmit
npm test             # vitest run
npm test -- <name>   # run one module's tests
npm start            # tsx src/main.ts (local Standby)
```
