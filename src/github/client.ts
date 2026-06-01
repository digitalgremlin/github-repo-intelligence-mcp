import type { RawRepoPayload, IssueRecord, PullRecord, ContributorRecord } from "../types.js";
import type { RepoRef } from "../repo.js";
import { repoQuery } from "./queries.js";

export type GithubErrorKind = "NOT_FOUND" | "RATE_LIMITED" | "UPSTREAM";
export class GithubError extends Error {
  constructor(public kind: GithubErrorKind, message: string, public resetAt: string | null = null) {
    super(message);
  }
}

type FetchFn = (url: string, init?: any) => Promise<{
  ok: boolean; status: number; json: () => Promise<any>; headers?: { get: (k: string) => string | null };
}>;

export async function fetchRepoPayload(
  repo: RepoRef, token: string | null, windowDays: number, fetchFn: FetchFn = fetch as any,
): Promise<RawRepoPayload> {
  const sinceISO = new Date(Date.now() - Math.max(windowDays, 365) * 86400000).toISOString();
  const headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "repo-intel-mcp" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const gql = await fetchFn("https://api.github.com/graphql", {
    method: "POST", headers, body: repoQuery(repo.owner, repo.name, sinceISO),
  });
  if (gql.status === 403 || gql.status === 429) {
    const reset = gql.headers?.get("x-ratelimit-reset");
    throw new GithubError("RATE_LIMITED", "rate limited", reset ? new Date(Number(reset) * 1000).toISOString() : null);
  }
  if (!gql.ok) throw new GithubError("UPSTREAM", `graphql ${gql.status}`);
  const body = await gql.json();
  const r = body?.data?.repository;
  if (!r) throw new GithubError("NOT_FOUND", "repository not found or private");

  const contributors = await fetchContributors(repo, headers, fetchFn);

  const commitDates: string[] =
    (r.defaultBranchRef?.target?.history?.nodes ?? []).map((n: any) => n.committedDate);
  const releaseDates: string[] =
    (r.releases?.nodes ?? []).map((n: any) => n.publishedAt).filter(Boolean);
  const issues: IssueRecord[] = (r.issues?.nodes ?? []).map((n: any) => ({
    createdAt: n.createdAt, closedAt: n.closedAt, lastActivityAt: n.updatedAt,
    firstResponseAt: n.comments?.nodes?.[0]?.createdAt ?? null,
    state: n.state === "CLOSED" ? "CLOSED" : "OPEN",
  }));
  const pulls: PullRecord[] = (r.pullRequests?.nodes ?? []).map((n: any) => ({
    createdAt: n.createdAt, mergedAt: n.mergedAt, closedAt: n.closedAt,
    state: n.state === "MERGED" ? "MERGED" : n.state === "CLOSED" ? "CLOSED" : "OPEN",
  }));

  return {
    owner: repo.owner, name: repo.name, isPrivate: !!r.isPrivate,
    stars: r.stargazerCount ?? 0, forks: r.forkCount ?? 0,
    commitDates, releaseDates, issues, pulls, contributors,
  };
}

async function fetchContributors(repo: RepoRef, headers: Record<string, string>, fetchFn: FetchFn): Promise<ContributorRecord[]> {
  const res = await fetchFn(
    `https://api.github.com/repos/${repo.owner}/${repo.name}/contributors?per_page=100`, { headers });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((c: any) => ({
    login: c.login ?? "unknown",
    commits: c.contributions ?? 0,
    firstCommitAt: new Date(0).toISOString(),
  }));
}
