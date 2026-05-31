import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildBugMeNotUrl,
  decryptDataS,
  extractDomainFromUrl,
  fetchCredentialsForDomain,
  normalizeDomain
} from "../../src/common/mockCredentialService.js";

const XOR_KEY = Object.freeze([
  27,
  135,
  200,
  32,
  166,
  10,
  34,
  210,
  111,
  231,
  13,
  146,
  119,
  158,
  23,
  136,
  231,
  28,
  196,
  42,
  111,
  138,
  180,
  248,
  182,
  233,
  254,
  141,
  8,
  81,
  139,
  226
]);

function encodeDataS(value) {
  const encryptedChars = [];
  for (let index = 0; index < value.length; index += 1) {
    encryptedChars.push(String.fromCharCode(value.charCodeAt(index) ^ XOR_KEY[index % XOR_KEY.length]));
  }

  return btoa(encryptedChars.join(""));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("mockCredentialService", () => {
  it("normalizes domains", () => {
    expect(normalizeDomain(" WWW.Example.com ")).toBe("example.com");
  });

  it("extracts domain from URL", () => {
    expect(extractDomainFromUrl("https://www.example.com/path")).toBe("example.com");
  });

  it("builds the bugmenot URL for a domain", () => {
    expect(buildBugMeNotUrl(" WWW.Example.com ")).toBe("https://bugmenot.com/view/example.com");
  });

  it("decrypts data-s values", () => {
    const encoded = encodeDataS("reader@example.com");
    expect(decryptDataS(encoded)).toBe("reader@example.com");
  });

  it("fetches and parses credentials from bugmenot HTML", async () => {
    const html = `
      <div id="content">
        <div class="account">
          <div class="account__credentials">
            <kbd data-s="${encodeDataS("reader@example.com")}"></kbd>
            <kbd data-s="${encodeDataS("example-pass-123")}"></kbd>
          </div>
        </div>
        <div class="account">
          <div class="account__credentials">
            <kbd data-s="${encodeDataS("trial@example.com")}"></kbd>
            <kbd data-s="${encodeDataS("trial-pass-456")}"></kbd>
          </div>
        </div>
      </div>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => html
      })
    );

    const credentials = await fetchCredentialsForDomain("example.com");
    expect(credentials).toEqual([
      { username: "reader@example.com", password: "example-pass-123" },
      { username: "trial@example.com", password: "trial-pass-456" }
    ]);
  });

  it("returns empty array for domains with no credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "<div id='content'></div>"
      })
    );

    const credentials = await fetchCredentialsForDomain("no-results.example");
    expect(credentials).toEqual([]);
  });

  it("returns empty array when fetch fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const credentials = await fetchCredentialsForDomain("example.com");
    expect(credentials).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns empty array for non-ok HTTP responses", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => ""
      })
    );

    const credentials = await fetchCredentialsForDomain("example.com");
    expect(credentials).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns empty array for invalid domain input", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const credentials = await fetchCredentialsForDomain("");
    expect(credentials).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
