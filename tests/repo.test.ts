import { describe, it, expect } from "vitest";
import { parseRepo } from "../src/repo.js";

describe("parseRepo", () => {
  it("parses owner/name", () => {
    expect(parseRepo("facebook/react")).toEqual({ owner: "facebook", name: "react" });
  });
  it("parses a full GitHub URL", () => {
    expect(parseRepo("https://github.com/facebook/react")).toEqual({ owner: "facebook", name: "react" });
  });
  it("parses a URL with trailing path", () => {
    expect(parseRepo("https://github.com/facebook/react/tree/main")).toEqual({ owner: "facebook", name: "react" });
  });
  it("strips a trailing .git", () => {
    expect(parseRepo("https://github.com/facebook/react.git")).toEqual({ owner: "facebook", name: "react" });
  });
  it("rejects a bare string", () => {
    expect(parseRepo("react")).toBeNull();
  });
  it("rejects an empty string", () => {
    expect(parseRepo("")).toBeNull();
  });
  it("rejects non-string input without throwing", () => {
    // The MCP boundary passes a zod-validated string, but parseRepo must be
    // total so a stray non-string never crashes the request handler (spec §6).
    expect(parseRepo(undefined as unknown as string)).toBeNull();
    expect(parseRepo(null as unknown as string)).toBeNull();
    expect(parseRepo(42 as unknown as string)).toBeNull();
    expect(parseRepo({ owner: "facebook", name: "react" } as unknown as string)).toBeNull();
  });
});
