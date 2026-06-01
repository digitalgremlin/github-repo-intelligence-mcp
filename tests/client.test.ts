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

function fakeFetch(graphqlBody: unknown, restContributors: unknown) {
  return async (url: string): Promise<any> => {
    if (url.includes("/graphql")) return { ok: true, status: 200, json: async () => graphqlBody };
    return { ok: true, status: 200, json: async () => restContributors };
  };
}

describe("fetchRepoPayload", () => {
  it("assembles a payload from GraphQL + REST", async () => {
    const p = await fetchRepoPayload({ owner: "o", name: "n" }, null, 90,
      fakeFetch(graphqlOk, [{ author: { login: "a" }, total: 50, weeks: [] }]) as any);
    expect(p.stars).toBe(100);
    expect(p.commitDates).toContain("2026-05-30T00:00:00Z");
    expect(p.contributors[0].login).toBe("a");
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
