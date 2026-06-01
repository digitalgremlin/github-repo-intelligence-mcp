import { describe, it, expect } from "vitest";
import { buildRepoHealth } from "../src/tools.js";
import active from "./fixtures/active.json";
import slowing from "./fixtures/slowing.json";
import abandoned from "./fixtures/abandoned.json";
import type { RawRepoPayload } from "../src/types.js";

const NOW = new Date("2026-06-01T00:00:00Z");

describe("archetype health verdicts", () => {
  it("active repo -> Actively maintained", () => {
    expect(buildRepoHealth(active as RawRepoPayload, NOW, true).overallVerdict).toBe("Actively maintained");
  });
  it("slowing repo -> Slowing", () => {
    expect(buildRepoHealth(slowing as RawRepoPayload, NOW, true).overallVerdict).toBe("Slowing");
  });
  it("abandoned repo -> Likely abandoned", () => {
    expect(buildRepoHealth(abandoned as RawRepoPayload, NOW, true).overallVerdict).toBe("Likely abandoned");
  });
});
