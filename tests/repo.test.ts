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
});
