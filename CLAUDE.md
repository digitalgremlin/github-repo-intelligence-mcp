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

As of this session: **Tasks 0–14 COMPLETE — the Actor is deployed, Standby-enabled, smoke-tested green in production, and PUBLISHED to the Apify Store** (last commit `45b4b37`, shipped 2026-06-05). Full suite green: **64/64 across 10 files**; `npm audit` = **0 vulnerabilities**. Working tree clean. Live Standby endpoint: `https://joeslade--github-repo-intelligence-mcp.apify.actor/mcp`. **This build is shipped — there is no "next task"; future work is maintenance/iteration only (see "Deployment notes" below for optional follow-ups).**

The full **pure-core + I/O-shell + Standby server** is built and wired end to end:
- Tasks 0–7 (pure core) — scaffold, `types.ts`, `repo.ts`, `config.ts` (`DEFAULTS`/`THRESHOLDS`), `metrics.ts` (`median`/`momentumTrend` + dimension computers), `verdicts.ts` (solo maintainer caps at Moderate), `health.ts` (`composeOverall`/`rationale`).
- Task 8 — `src/cache.ts` `TtlLruCache` (clock-injected) + tests.
- Task 9 — `src/github/queries.ts` + `src/github/client.ts` `fetchRepoPayload` (GraphQL primary + REST contributors; `GithubError` NOT_FOUND/RATE_LIMITED/UPSTREAM; `fetchFn` injected).
- Task 10 — `src/tools.ts` pure builders (`buildRepoHealth` + 4 dimension builders).
- Task 11 — `src/main.ts` Standby MCP server (node:http; readiness probe; stateless `StreamableHTTPServerTransport` per request; 5 tools). **MCP SDK dep added** (`@modelcontextprotocol/sdk@^1.29.0`, `zod@^4.4.3`). `.actor/actor.json` input props populated. `main.ts` is now the real bootstrap, NOT a stub.
- Task 12 — `tests/fixtures/{active,slowing,abandoned}.json` (real payloads: honojs/hono, chalk/chalk, request/request; `NOW` pinned 2026-06-01) + `tests/integration.test.ts`. Scratch capture tool was removed; regen recipe is in the "Test fixtures" section below.
- Task 13 (`00b59d0`) — product `README.md` (what it does, 5 tools with verified example I/O, verdict thresholds table + overall composition, token setup, `totalContributors` all-time-proxy note, "Works well with" cross-links). SEO title/description/categories are set in the Apify Console at publish (NOT committed to `actor.json`); drafted strings live in the session log, not the repo.
- Task 14 (`45b4b37`, shipped 2026-06-05) — **DEPLOYED + PUBLISHED.** `git push` → `apify push` → Standby enabled → smoke-tested green in prod (`get_repo_health honojs/hono` → Actively maintained, `authenticated: true`; bad-arg + NOT_FOUND paths returned clean structured errors). `GITHUB_TOKEN` set as a secret env var. Editorial-polish pass on README + `actor.json` listing copy (`45b4b37`) — accuracy-verified against source before commit; fixed a real `rationale`-string bug in the example and tightened the contributors threshold row to match `verdicts.ts`. Failure alert enabled (no run-duration alert). Published to the Apify Store; Console SEO fields set.

**Pre-deploy hardening pass (after Task 12, all committed):** three real production bugs found during fixture capture + the npm audit, all fixed TDD/tier-split:
- **Bug A** (`6c8468a`) — contributors now sourced from the REST `/contributors` list endpoint, NOT `/stats/contributors` (which returns 202 on a cold cache and rarely warms → empty contributors in prod).
- **Bug C** (`ee6ada9`) — commit history fetched over `max(windowDays, 365)` days so the activity Moderate/At-Risk bands are reachable (was using the 90d analysis window).
- **Bug B** (`b66164b`) — renamed `activeContributors90d`→`totalContributors` (it was a raw count, never 90d-active); dropped `newContributors90d` (unfeedable after Bug A). Verdict thresholds unchanged.
- **Vulns** (`d81bb4d`) — `overrides.file-type ^21.3.2` clears 3 moderate transitive advisories → 0 vulns (see Lean-deps rule for the re-check-on-bump caveat).

**Codex headless gotchas (learned the hard way):** `codex exec` blocks forever on non-TTY stdin — ALWAYS invoke with `< /dev/null`, `RUST_LOG=info` teed to a log; never bake a self-matching `pkill -f "codex…"` into the launch line (`feedback_codex_headless_stdin.md`). When driving Codex via a subagent against a red test, do NOT tell the subagent to "revert all but the impl file" — it wipes the intentional uncommitted red test; whitelist the test or have it report-without-reverting (`feedback_codex_subagent_revert_test.md`).

## Deployment notes (Task 14 — DONE, shipped 2026-06-05)

The Actor is **live and published**. Hard-won deploy lessons (reusable for the next Standby MCP actor):

- **GitHub token is effectively REQUIRED, not optional** — verified by prod smoke test. The GraphQL-primary client rejects unauthenticated requests, and Apify Standby containers egress from shared IPs whose anonymous REST quota (~60/hr per IP) is exhausted on arrival. Without a token the Actor returns only `RATE_LIMITED` errors, never verdicts. README + `actor.json` input copy reframed accordingly (`4b3f629`, `0f2cbbd`). Provide via a `GITHUB_TOKEN` secret env var (preferred for Standby — `main.ts:25` reads it as the fallback) or the `githubToken` input field. A classic token with NO scopes is enough for public repos (5,000 req/hr).
- **Adding a secret env var via the Console required a rebuild** before it took effect.
- **`apify push` disables Standby every time** AND reset the Standby request tuning to defaults (Max/Desired reverted to `4/3`). After every push: re-enable Standby and re-apply Max/Desired (~50/35 keeps requests on one warm container so the per-container in-memory cache actually hits). Keep **"Validate and pass Actor input" OFF** — the MCP body is read from the POST; on-validation can mangle JSON-RPC.
- **`apify push --force`** is the correct override when a Console rebuild bumped the platform's `modifiedAt` ("modified on platform since modified locally"). It preserves Actor-level secret env vars — none are declared in `actor.json`, so the token survives the force-push.
- **Stateless MCP smoke recipe (curl):** POST to `…/mcp?token=…` with `Accept: application/json, text/event-stream` (BOTH — else 406) and `Content-Type: application/json`. **No `initialize` handshake needed** — `sessionIdGenerator: undefined` makes the SDK's `validateSession` return early, so a lone `tools/call` is accepted. Responses are SSE-framed (`data: {…}`); the verdict is in `result.content[0].text` (double-encoded JSON). Without `jq`: `... | sed -n 's/^data: //p'`.

**No remaining plan tasks.** Optional follow-ups noted this session (none blocking): (1) refresh README example I/O to a real live multi-tool snapshot — current examples are the illustrative 2026-06-01 fixture snapshot (all-`Healthy`), but live honojs/hono shows a `Moderate` dimension + `busFactorFlag: true`, a more compelling demo; (2) cosmetic `commits90d` node-cap check on extremely active repos (doesn't move the verdict); (3) competitor comparison table / perf-cost benchmarks once there's real run data. Progress is recorded by `git log` (authoritative) and the plan's `- [ ]` checkboxes.

## Open items to resolve before first `apify push`

Both pre-push open items are now **RESOLVED** (committed `9b55e8a`, `84745ce`):

- ✅ **Dockerfile `npm ls` diagnostic** (`84745ce`) — both `RUN npm ls @crawlee/core apify puppeteer playwright` lines trimmed to `RUN npm ls @crawlee/core apify || true`. `puppeteer`/`playwright` (not deps, absent from `apify/actor-node:24`) made `npm ls` exit non-zero → a real `docker build` would fail on that `RUN`. `|| true` makes the diagnostic non-fatal (matches the existing final-stage `npm list … || true` pattern).
- ✅ **`repo` arg boundary guard** (`9b55e8a`) — `parseRepo` now starts with `if (typeof input !== "string") return null;`, making it total so a stray non-string returns a clean "Invalid repo argument" error instead of throwing on `.trim()` and crashing the handler (spec §6). The MCP layer's `z.string()` already validates upstream; this is defense-in-depth. Covered by a new red→green test in `tests/repo.test.ts`.

No open items remain before `apify push`.

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
