import { describe, expect, it } from "vitest";
import { isAllowedByRobots, parseRobots } from "./linkcheck";
import { assertPublicUrl, isPrivateIp } from "./ssrf";

const robots = `
User-agent: *
Disallow: /private
Allow: /private/ok

User-agent: GPTBot
Disallow: /
`;

describe("robots", () => {
  const g = parseRobots(robots);
  it("blocks GPTBot entirely", () => expect(isAllowedByRobots(g, "GPTBot", "/")).toBe(false));
  it("uses * group for other bots with longest match", () => {
    expect(isAllowedByRobots(g, "ClaudeBot", "/")).toBe(true);
    expect(isAllowedByRobots(g, "ClaudeBot", "/private/x")).toBe(false);
    expect(isAllowedByRobots(g, "ClaudeBot", "/private/ok")).toBe(true);
  });
});

describe("ssrf", () => {
  it("flags private ips", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.1", "169.254.169.254", "172.16.0.1", "::1"])
      expect(isPrivateIp(ip)).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
  });
  it("rejects internal URLs", async () => {
    await expect(assertPublicUrl("http://localhost:3000")).rejects.toThrow();
    await expect(assertPublicUrl("http://169.254.169.254/latest")).rejects.toThrow();
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow();
  });
});
