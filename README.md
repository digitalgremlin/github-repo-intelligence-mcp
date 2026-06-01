**GitHub Repo Intelligence** is a persistent [MCP server](https://modelcontextprotocol.io) that gives AI assistants an **opinionated health read on any GitHub repository** — *Actively maintained*, *Slowing*, *At-risk*, or *Likely abandoned* — backed by transparent, inspectable metrics. Point it at `owner/name` (or a GitHub URL) and it returns a verdict your agent can act on, plus the raw numbers behind it so the agent can see *why*.

It runs as a [Standby Actor](https://docs.apify.com/platform/actors/development/programming-interface/standby) on the [Apify platform](https://docs.apify.com/platform), so it's always warm and reachable over the [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http) — no cold starts, with API access, scheduling, monitoring, and rate-limit handling handled for you.

## Why use GitHub Repo Intelligence?

Most GitHub tools hand an agent raw API access and leave the *judgment* to the model — which means inconsistent, hand-rolled heuristics on every call. This server does the synthesis for you:

- **Decide whether to adopt a dependency** — is this library still maintained, or quietly abandoned?
- **Triage a list of repos** — rank candidates by health before a human looks at them.
- **Due diligence** — flag bus-factor risk, stale issue backlogs, and stalled PR queues.
- **Monitor projects you depend on** — schedule a recurring check and alert when a repo starts slowing.

The differentiator is **judgment, not raw access**: every verdict ships alongside the transparent metrics and pinned thresholds that produced it, so the agent (and you) can audit the reasoning.

## How to use GitHub Repo Intelligence

1. **Start the server** — run this Actor in Standby mode. It boots with no input required.
2. **Connect your MCP client** to the Standby endpoint (`https://<your-standby-url>/mcp`) using the Streamable HTTP transport.
3. **Call a tool** — start with `get_repo_health` for the headline verdict, then drill into a dimension (`get_activity_metrics`, `get_issue_health`, `get_pr_health`, `get_contributor_insights`) when you need detail.
4. **(Optional) Add a GitHub token** to raise the rate limit and analyze private repos — see [Input](#input).

## The five tools

All tools take a single `repo` argument — either `"owner/name"` or any `https://github.com/owner/name[/...]` URL (lookups are case-insensitive).

### `get_repo_health` — the headline

Returns the overall verdict, a per-dimension breakdown, and a one-line rationale.

```jsonc
{
  "repo": "honojs/hono",
  "overallVerdict": "Actively maintained",
  "dimensions": {
    "activity":      { "verdict": "Healthy",  "lastCommitDaysAgo": 1, "commits90d": 412 },
    "issues":        { "verdict": "Healthy",  "medianFirstResponseDays": 2.4, "staleOpenRatio": 0.12 },
    "pullRequests":  { "verdict": "Healthy",  "mergeRate": 0.88, "oldestOpenPrDaysAgo": 14 },
    "contributors":  { "verdict": "Healthy",  "totalContributors": 312, "busFactorFlag": false }
  },
  "rationale": "Actively maintained: recent commits, healthy across all dimensions.",
  "stars": 21000,
  "forks": 640,
  "fetchedAt": "2026-06-01T00:00:00.000Z",
  "authenticated": true
}
```

### `get_activity_metrics`

Commit cadence, momentum, and release activity.

```jsonc
{
  "repo": "honojs/hono",
  "verdict": "Healthy",
  "lastCommitDaysAgo": 1,
  "commits30d": 140,
  "commits90d": 412,
  "commits365d": 1680,
  "releaseCount365d": 48,
  "lastReleaseDaysAgo": 3,
  "momentumTrend": "steady",
  "fetchedAt": "2026-06-01T00:00:00.000Z"
}
```

`momentumTrend` is `accelerating` / `steady` / `declining`, derived from the 30-day commit rate versus the 90-day rate. Repos that tag instead of cutting GitHub Releases report `releaseCount365d: 0` and `lastReleaseDaysAgo: null` — this does **not** by itself degrade the verdict.

### `get_issue_health`

Issue responsiveness and backlog hygiene.

```jsonc
{
  "repo": "honojs/hono",
  "verdict": "Healthy",
  "openIssues": 32,
  "closedIssues": 1840,
  "openClosedRatio": 0.017,
  "medianFirstResponseDays": 2.4,
  "medianTimeToCloseDays": 5.1,
  "staleOpenIssues": 4,
  "staleOpenRatio": 0.12,
  "fetchedAt": "2026-06-01T00:00:00.000Z"
}
```

An open issue is **stale** if untouched for more than 90 days. Medians are `null` when there are no qualifying events in the window (absence ≠ zero).

### `get_pr_health`

Pull-request throughput and queue age.

```jsonc
{
  "repo": "honojs/hono",
  "verdict": "Healthy",
  "openPrs": 6,
  "mergedPrs": 220,
  "closedUnmergedPrs": 30,
  "mergeRate": 0.88,
  "medianTimeToMergeDays": 1.2,
  "oldestOpenPrDaysAgo": 14,
  "fetchedAt": "2026-06-01T00:00:00.000Z"
}
```

`mergeRate` excludes still-open PRs from the denominator; it is `null` when no PRs have been decided in the window.

### `get_contributor_insights`

Contributor concentration and bus-factor risk.

```jsonc
{
  "repo": "honojs/hono",
  "verdict": "Healthy",
  "totalContributors": 312,
  "topContributorShare": 0.28,
  "topTwoContributorShare": 0.41,
  "busFactorFlag": false,
  "fetchedAt": "2026-06-01T00:00:00.000Z"
}
```

`busFactorFlag` is `true` when the top contributor owns more than 50% of commits, or the top two own more than 80%. `totalContributors` is the repository's **all-time** contributor count (sourced from GitHub's `/contributors` list), not a 90-day-active count.

## Verdict thresholds

Verdicts come from **pinned, transparent thresholds** — same repo state + same config always yields the same verdict.

| Dimension | `Healthy` | `Moderate` | `At-Risk` | Extra |
|---|---|---|---|---|
| **Activity** | last commit ≤ 30d | 30–180d | 180–365d | `Likely abandoned` if > 365d |
| **Issues** | median first response ≤ 7d **and** staleOpenRatio ≤ 0.40 | ≤ 30d **and** ≤ 0.60 | otherwise | null median → judged on staleOpenRatio alone |
| **Pull requests** | mergeRate ≥ 0.60 **and** oldestOpenPr ≤ 30d | mergeRate ≥ 0.30 **or** oldestOpenPr ≤ 90d | otherwise | null mergeRate → judged on oldestOpenPr alone |
| **Contributors** | totalContributors ≥ 3 **and** not bus-factor | ≥ 2 **or** not bus-factor | otherwise | solo active maintainer → at most `Moderate` |

**Overall verdict** is activity-dominant, evaluated top-down (first match wins):

1. **Likely abandoned** — activity is `Likely abandoned` (no commits in > 365 days).
2. **At-risk** — activity is `At-Risk`, *or* any two of {issues, PRs, contributors} are `At-Risk`.
3. **Actively maintained** — activity is `Healthy` *and* no dimension is `At-Risk`.
4. **Slowing** — everything else (e.g. activity `Moderate`, or `Healthy` activity with one `At-Risk` dimension).

## Input

The server boots with **no input required**. All fields are optional Standby configuration:

| Field | Type | Default | Description |
|---|---|---|---|
| `githubToken` | string (secret) | — | Personal access or fine-grained token. Raises the GitHub API rate limit to **5,000 req/hour** and enables **private-repo** analysis. Leave blank to use the lower unauthenticated limit on public repos. |
| `cacheTtlMinutes` | integer | `20` | How long a repo's fetched payload is reused before refetching. Lower = fresher; higher = fewer API calls. |
| `analysisWindowDays` | integer | `90` | Trailing window over which issue and PR activity is measured. |

> **GitHub token (optional but recommended).** Without a token, GitHub allows only ~60 requests/hour per IP, which is fine for occasional checks but will rate-limit a busy agent. A read-only token lifts this to 5,000/hour and unlocks private repositories you have access to. Paste it into the `githubToken` field; it's stored as a secret.

## Output

Each tool returns a single structured JSON object (shown above). Responses are deterministic and include a `fetchedAt` timestamp reflecting when the underlying payload was pulled from GitHub — a cached read returns the same data as a fresh fetch for the same repo state.

## Data fields

| Field | Meaning |
|---|---|
| `overallVerdict` | Actively maintained / Slowing / At-risk / Likely abandoned |
| `lastCommitDaysAgo` | Days since the most recent commit (`null` if none) |
| `commits30d` / `commits90d` / `commits365d` | Commit counts over trailing windows |
| `momentumTrend` | accelerating / steady / declining |
| `medianFirstResponseDays` | Median time to first response on issues |
| `staleOpenRatio` | Share of open issues untouched > 90d |
| `mergeRate` | Merged ÷ (merged + closed-unmerged) PRs |
| `oldestOpenPrDaysAgo` | Age of the oldest still-open PR |
| `totalContributors` | All-time contributor count |
| `busFactorFlag` | Contribution over-concentrated on 1–2 people |

## Pricing

This Actor runs in Standby mode and is billed for the compute it uses while warm and serving requests. Health reads are lightweight — each repo's GitHub data is fetched once and cached (default 20 minutes) and shared across all five tools, so drilling into multiple dimensions for the same repo costs a single upstream fetch. Using your own GitHub token keeps you clear of GitHub's rate limits at no extra Apify cost.

## Tips

- **Lead with `get_repo_health`**, then call a dimension tool only when you need the detail — they all read from the same cached payload.
- **Raise `cacheTtlMinutes`** when triaging many repos in a batch to minimize GitHub calls; **lower it** when you need up-to-the-minute reads.
- **Always supply a `githubToken`** for any agent that checks repos at scale.
- **Tune `analysisWindowDays`** (30–365) to match how recent you want issue/PR signals to be.

## Works well with

Part of a small slate of agent-focused Apify Actors:

- **Apify Actor Idea Validator** — validates an Actor idea against the Apify Store and returns a GO/REFINE/NO-GO verdict with comparable Actors.
- **SERP Topic Gap Monitor** — finds topic gaps in search-result coverage and produces scored gap reports.
- **Docs MCP Server** — an MCP server giving AI assistants queryable access to framework documentation (Next.js, React, Tailwind, TypeScript, Prisma).

## FAQ and support

**Does it work on private repositories?** Yes — supply a `githubToken` with access to the repo.

**Is the verdict subjective?** No. Every verdict comes from the pinned thresholds documented above. The same repo state always yields the same verdict, and the raw metrics are returned alongside it so you can audit the call.

**Why is `totalContributors` not a 90-day number?** GitHub's per-period contributor stats endpoint is unreliable on a cold cache (it returns `202` and rarely warms), so contributors are sourced from the stable all-time `/contributors` list instead.

**Found a bug or want a feature?** Open an issue on the Actor's **Issues** tab. Custom variations are available on request.
