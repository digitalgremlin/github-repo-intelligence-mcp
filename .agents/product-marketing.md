# Product Marketing Context

*Last updated: 2026-06-11*
*Source: github-repo-intelligence-mcp launch content (2026-06-05) + marketing pipeline design spec (2026-06-10). Competitive Landscape + Customer Language sections are provisional pending Bright Data research (Task 5 Steps 2–3).*

## Product Overview
**One-liner:** An Apify MCP actor that gives AI agents an opinionated verdict on whether a GitHub repo is actively maintained or quietly dying.
**What it does:** Point it at any `owner/name` or GitHub URL and it returns one of four verdicts — **Actively maintained / Slowing / At-risk / Likely abandoned** — backed by the raw metrics and pinned thresholds that produced it. Five MCP tools (headline verdict + drill-downs on activity, issues, PRs, contributors) run over a single cached GitHub GraphQL fetch.
**Product category:** Repository-health / dependency-maintainability intelligence for AI agents (MCP developer tool).
**Product type:** Apify Store actor running as a Standby MCP server (always-warm Streamable HTTP `/mcp` endpoint).
**Business model:** Apify usage-based (Standby compute); free to try from the Store listing; distributed via the MCP configurator flow.

## Target Audience
**Target companies:** Dev teams and indie developers building agentic coding workflows; anyone wiring MCP servers into Claude / Cursor / agent stacks.
**Decision-makers:** The developer / AI engineer themselves (bottoms-up dev tool — user IS the buyer).
**Primary use case:** "Before my agent (or I) build on this dependency, is the project still alive?"
**Jobs to be done:**
- Tell me if a dependency is still maintained *before* it reaches production
- Let my AI agent audit repo health with a defensible verdict instead of guessing
- Alert me when a repo I already depend on starts slowing down
**Use cases:**
- Agent dependency vetting mid-coding-task (recommend a live lib, not a dead one)
- Pre-adoption due diligence on an open-source package
- Scheduled monitoring of critical dependencies for maintenance decay

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| AI/agent builder (User + Buyer) | Agents that don't recommend dead libs | LLM can't tell thriving from dying repos | A verdict the agent can act on + audit |
| Senior dev evaluating deps | Not betting prod on an abandoned project | "Last commit" + stars are noisy proxies | Transparent, deterministic maintainability read |
| Platform/DX team | Composable, testable MCP tools | Raw GitHub wrappers dump data, not judgment | Focused tool that ships the conclusion |

## Problems & Pain Points
**Core problem:** AI agents have no sense of project vitality — they treat a vibrant repo and an abandoned one as equally safe, so stale dependencies sneak into production.
**Why alternatives fall short:**
- Raw GitHub MCP/API wrappers hand the model a pile of data and leave the conclusion to guesswork
- Stars / last-commit-date are misleading single-signal proxies
- Security-focused dependency tools answer "is it vulnerable?", not "is it still maintained?"
**What it costs them:** Rework, surprise migrations, and risk when a dependency turns out to be dead after it's already in the codebase.
**Emotional tension:** The quiet dread of "is this thing still maintained, or am I building on sand?"

## Competitive Landscape
*(Validated via WebSearch 2026-06-11 → full analysis in [[github-repo-intelligence-mcp-positioning-brief]]. Bright Data deep-scrape deferred — CLI unauthenticated this session.)*
**Direct:** **None found.** No maintainability-verdict MCP server surfaced across Glama (34k+ servers), mcp.so, or PulseMCP. The actor occupies an unoccupied square: MCP-native + agent-callable + multi-dimensional verdict + deterministic + transparent.
**Secondary:** `github/github-mcp-server` (official) and other raw GitHub MCP/Octokit wrappers — agent-callable but expose API data, no verdict (leaves the conclusion to guesswork).
**Indirect (scoring):** gh-repo-health, repo-health-check, repocheck.com, **isitmaintained.com** (closest in spirit: high/fair/borderline read, but web service + Chrome extension, single-dimension issue-close-time, not agent-callable), repostatus.org (self-declared badges).
**Indirect (security/staleness):** deps.dev, OWASP Dependency-Check, Snyk, Dependabot, depcheck, stale-deps, npm-check — answer "is it vulnerable/unused?", not "is it still maintained?" Wrong surface.

## Differentiation
**Key differentiators:**
- **Judgment, not raw access** — returns a verdict, not a data dump. The verdict is the product.
- **Deterministic** — same repo state + same config → same verdict, every time. No per-call heuristic drift.
- **Transparent** — ships the pinned thresholds + raw metrics behind every verdict, so the agent can audit the *why*.
- **Efficient architecture** — one GitHub GraphQL fetch, cached and shared across all five tools; drill-downs cost zero extra upstream calls.
**How we do it differently:** We do the synthesis (cadence, issue response, PR merge rate/backlog, contributor bus-factor) into a single four-way verdict instead of leaving it to the model.
**Why that's better:** Agents make defensible decisions; humans can audit them; results are reproducible.
**Why customers choose us:** It answers the exact question devs feel instantly ("is this dependency still maintained?") with a transparent, reproducible verdict — and runs always-warm as Standby MCP.

## Objections
| Objection | Response |
|-----------|----------|
| "I can just check last commit / stars myself" | Single signals mislead; this synthesizes 4 dimensions into a defensible, reproducible verdict — and your *agent* can't eyeball a repo page. |
| "Why does it need a GitHub token?" | GraphQL rejects anon requests and Apify's shared egress burns the anon quota instantly; the input schema walks you through it. One-time setup. |
| "Is the verdict trustworthy / a black box?" | Every verdict ships its pinned thresholds + raw metrics — it's transparent and deterministic, not an opaque score. |

**Anti-persona:** Someone who wants raw GitHub API access to build their own logic (they want data, not a verdict), or security/CVE scanning (wrong surface).

## Switching Dynamics
**Push:** Agents recommending dead libs; stale deps reaching prod; stars/last-commit being unreliable.
**Pull:** A drop-in MCP tool that returns an actionable, transparent maintainability verdict.
**Habit:** Manually skimming the GitHub repo page; trusting the model's unguarded recommendation.
**Anxiety:** "Another tool to configure" + the GitHub-token step. Mitigated by Standby (always warm, configurator flow) and the schema's token walkthrough.

## Customer Language
*(Harvested via WebSearch 2026-06-11; verbatim forum quotes flagged to deepen w/ Bright Data — see [[github-repo-intelligence-mcp-positioning-brief]] §4.)*
**How they describe the problem (near-verbatim from DEV/blog titles + snippets):**
- "is this dependency still maintained, or should I worry?"
- "npm outdated won't tell you if a package is abandoned" (so devs hand-build tools like stale-deps)
- "How do you tell if a project is maintained?"
- "Should the quality of GitHub projects be evaluated by their star count?" (star count = bad proxy)
- "stale and potentially vulnerable packages silently lurking in codebases"
- "key man risk" / "one person's side project" (→ bus factor)
- Nuance: "distinguishing between unmaintained and feature-complete packages is not an easy task" (stable ≠ dead)
**How they describe us:** *(pre-traction — no review corpus yet)*
**Words to use:** maintained, abandoned, active, dying, verdict, judgment, transparent, deterministic, repo health, dependency health, bus factor, key-man risk, "still maintained?"
**Words to avoid:** "score" alone (implies black box + collides with the scoring-tool bucket), "vulnerability/CVE" framing (wrong surface = security scanners), bare "AI-powered"
**Glossary:**
| Term | Meaning |
|------|---------|
| Verdict | One of: Actively maintained / Slowing / At-risk / Likely abandoned |
| Bus factor | Contributor-concentration risk (how few people hold the project up) |
| Standby actor | Always-warm Apify actor exposing an MCP `/mcp` endpoint |
| Pinned thresholds | The fixed cutoffs that map metrics → verdict (source of determinism) |

## Brand Voice
**Tone:** Clear, credible, technical — not flashy, not corporate, not jargon-heavy.
**Style:** Direct, opinionated, evidence-backed. Short sentences. Shows the work behind a claim.
**Personality:** Clarity-from-complexity, judgment-forward, honest about gotchas (e.g. leads with the token caveat rather than hiding it). (Joe Slade brand → [[project-joe-slade-brand]].)

## Proof Points
**Metrics:** Apify validator score **1.00** (portfolio's strongest); deterministic verdicts; one-fetch / five-tool shared-cache architecture.
**Customers:** New launch (2026-06-05) — no usage logos yet.
**Testimonials:** None yet (pre-traction).
**Value themes:**
| Theme | Proof |
|-------|-------|
| Judgment, not raw access | Returns a 4-way verdict + rationale, not API JSON |
| Reproducible | Same repo + config → same verdict (pinned thresholds) |
| Transparent | Every verdict ships the metrics + thresholds behind it |
| Efficient | One cached GraphQL fetch shared across 5 tools |

## Goals
**Business goal:** Establish the actor as a known/cited MCP dev tool and drive Store installs/runs (portfolio credibility for Brock Lobster Sauce).
**Conversion action:** Run the actor / add it via the MCP configurator from the Store listing.
**Current metrics:** Newly launched; usage baseline ~0 — first traction push (dev.to + demo, positioning, Store SEO, directories) is this pipeline.
