import { describe, expect, it } from "vitest";
import { buildCell, hostMatches, mentionsName, normalizeDomain, visibilityScore } from "./analyze";

describe("analyze", () => {
  it("normalizes domains", () => {
    expect(normalizeDomain("https://www.Acme.com/x?y=1")).toBe("acme.com");
    expect(normalizeDomain("acme.com:8080")).toBe("acme.com");
  });
  it("matches subdomains but not look-alikes", () => {
    expect(hostMatches("https://blog.acme.com/a", "acme.com")).toBe(true);
    expect(hostMatches("https://notacme.com", "acme.com")).toBe(false);
  });
  it("matches brand with word boundaries (latin) and substring (hebrew)", () => {
    expect(mentionsName("Try Acme today", "acme")).toBe(true);
    expect(mentionsName("Acmeology is a field", "acme")).toBe(false);
    expect(mentionsName("אני ממליץ על אקמי", "אקמי")).toBe(true);
  });
  it("detects link, rank and competitor presence", () => {
    const cell = buildCell(
      "perplexity", "q",
      { text: "Rival is great", citations: ["https://x.com/1", "https://www.acme.com/p"] },
      { brand: "Acme", domain: "acme.com" },
      [{ name: "Rival", domain: "rival.com" }],
    );
    expect(cell.me).toEqual({ mentioned: true, linked: true, rank: 2 });
    expect(cell.competitors["rival.com"]).toMatchObject({ mentioned: true, linked: false });
    expect(visibilityScore([cell], "me")).toBe(100);
    expect(visibilityScore([cell], "rival.com")).toBe(60);
  });
});
