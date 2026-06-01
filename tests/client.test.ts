// tests/client.test.ts
import { describe, it, expect } from "vitest";
import { fetchRepoPayload, GithubError } from "../src/github/client.js";

const graphqlOk = {
  data: { repository: {
    isPrivate: false, stargazerCount: 100, forkCount: 10,
    defaultBranchRef: { target: { history: { nodes: [{ committedDate: "2026-05-30T00:00:00Z" }] } } },
    releases: { nodes: [{ publishedAt: "2026-05-01T00:00:00Z" }] },
    issues: { nodes: [] }, pullRequests: { nodes: [] },
  } } };

function fakeFetch(graphqlBody: unknown, restContributors: unknown, calls?: string[]) {
  return async (url: string): Promise<any> => {
    calls?.push(url);
    if (url.includes("/graphql")) return { ok: true, status: 200, json: async () => graphqlBody };
    return { ok: true, status: 200, json: async () => restContributors };
  };
}

describe("fetchRepoPayload", () => {
  it("assembles a payload from GraphQL + REST", async () => {
    const p = await fetchRepoPayload({ owner: "o", name: "n" }, null, 90,
      fakeFetch(graphqlOk, [{ login: "a", contributions: 50 }]) as any);
    expect(p.stars).toBe(100);
    expect(p.commitDates).toContain("2026-05-30T00:00:00Z");
    expect(p.contributors[0].login).toBe("a");
    expect(p.contributors[0].commits).toBe(50);
  });

  it("sources contributors from the /contributors list endpoint, not /stats", async () => {
    const calls: string[] = [];
    const p = await fetchRepoPayload({ owner: "o", name: "n" }, null, 90,
      fakeFetch(graphqlOk, [{ login: "a", contributions: 50 }, { login: "b", contributions: 20 }], calls) as any);
    const restCall = calls.find((u) => !u.includes("/graphql"))!;
    expect(restCall).toContain("/repos/o/n/contributors");
    expect(restCall).not.toContain("/stats/");
    expect(p.contributors).toHaveLength(2);
    expect(p.contributors[1]).toMatchObject({ login: "b", commits: 20 });
  });

  it("fetches commit history over at least 365 days even with a short analysis window", async () => {
    let gqlBody: any;
    const f = async (url: string, init?: any): Promise<any> => {
      if (url.includes("/graphql")) {
        gqlBody = JSON.parse(init.body);
        return { ok: true, status: 200, json: async () => graphqlOk };
      }
      return { ok: true, status: 200, json: async () => [] };
    };
    await fetchRepoPayload({ owner: "o", name: "n" }, null, 90, f as any);
    const sinceDaysAgo = (Date.now() - new Date(gqlBody.variables.since).getTime()) / 86400000;
    expect(sinceDaysAgo).toBeGreaterThanOrEqual(365);
  });

  it("returns an empty contributor list when the REST call fails", async () => {
    const f = async (url: string): Promise<any> =>
      url.includes("/graphql")
        ? { ok: true, status: 200, json: async () => graphqlOk }
        : { ok: false, status: 404, json: async () => ({}) };
    const p = await fetchRepoPayload({ owner: "o", name: "n" }, null, 90, f as any);
    expect(p.contributors).toEqual([]);
  });

  it("throws NOT_FOUND when GraphQL returns a null repository", async () => {
    const body = { data: { repository: null } };
    await expect(
      fetchRepoPayload({ owner: "o", name: "n" }, null, 90, fakeFetch(body, []) as any),
    ).rejects.toMatchObject({ kind: "NOT_FOUND" });
  });

  it("throws RATE_LIMITED on a 403 with rate-limit headers", async () => {
    const f = async () => ({ ok: false, status: 403, headers: { get: () => "0" }, json: async () => ({}) });
    await expect(
      fetchRepoPayload({ owner: "o", name: "n" }, null, 90, f as any),
    ).rejects.toMatchObject({ kind: "RATE_LIMITED" });
  });
});
