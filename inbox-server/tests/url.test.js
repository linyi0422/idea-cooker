import { describe, expect, it } from "vitest";
import { canonicalize } from "../src/url.js";

describe("canonicalize", () => {
  it("removes tracking params and hash", () => {
    expect(canonicalize("https://a.com/p?utm_source=1&x=2#intro")).toBe(
      "https://a.com/p?x=2"
    );
  });

  it("removes known non-utm tracking params", () => {
    expect(canonicalize("https://a.com/p?from=feed&source=abc&spm=x&si=1&k=v")).toBe(
      "https://a.com/p?k=v&source=abc"
    );
  });

  it("normalizes parameter order", () => {
    expect(canonicalize("https://a.com/p?b=2&a=1")).toBe("https://a.com/p?a=1&b=2");
  });

  it("keeps url without query unchanged", () => {
    expect(canonicalize("https://a.com/p")).toBe("https://a.com/p");
  });

  it("removes hash-only fragment", () => {
    expect(canonicalize("https://a.com/p#topic")).toBe("https://a.com/p");
  });
});
