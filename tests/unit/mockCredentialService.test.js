import { describe, expect, it } from "vitest";

import {
  extractDomainFromUrl,
  getMockCredentialsForDomain,
  normalizeDomain
} from "../../src/common/mockCredentialService.js";

describe("mockCredentialService", () => {
  it("normalizes domains", () => {
    expect(normalizeDomain(" WWW.Example.com ")).toBe("example.com");
  });

  it("extracts domain from URL", () => {
    expect(extractDomainFromUrl("https://www.example.com/path")).toBe("example.com");
  });

  it("returns override credentials when domain is known", () => {
    const result = getMockCredentialsForDomain("example.com");
    expect(result.length).toBe(2);
    expect(result[0].username).toContain("@example.com");
  });

  it("returns default credentials when domain is unknown", () => {
    const result = getMockCredentialsForDomain("unknown-site.test");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("username");
    expect(result[0]).toHaveProperty("password");
  });
});
