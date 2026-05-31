import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __resetCredentialCacheForTesting,
  buildBugMeNotUrl,
  decryptDataS,
  extractDomainFromUrl,
  fetchCredentialsForDomain,
  normalizeDomain
} from "../../src/common/bmnCredentialService.js";

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
  __resetCredentialCacheForTesting();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("bmnCredentialService", () => {
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

  it("caches credentials for repeated requests to the same domain", async () => {
    const html = `
      <div id="content">
        <div class="account">
          <div class="account__credentials">
            <kbd data-s="${encodeDataS("cached-user@example.com")}"></kbd>
            <kbd data-s="${encodeDataS("cached-pass-123")}"></kbd>
          </div>
        </div>
      </div>
    `;

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => html
    });
    vi.stubGlobal("fetch", fetchSpy);

    const first = await fetchCredentialsForDomain("example.com");
    const second = await fetchCredentialsForDomain("example.com");

    expect(first).toEqual([{ username: "cached-user@example.com", password: "cached-pass-123" }]);
    expect(second).toEqual(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("caches empty credential results", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<div id='content'></div>"
    });
    vi.stubGlobal("fetch", fetchSpy);

    const first = await fetchCredentialsForDomain("empty.example");
    const second = await fetchCredentialsForDomain("empty.example");

    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not cache failed fetch responses", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchSpy);

    const first = await fetchCredentialsForDomain("failing.example");
    const second = await fetchCredentialsForDomain("failing.example");

    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("deduplicates simultaneous requests for the same domain", async () => {
    const html = `
      <div id="content">
        <div class="account">
          <div class="account__credentials">
            <kbd data-s="${encodeDataS("parallel-user@example.com")}"></kbd>
            <kbd data-s="${encodeDataS("parallel-pass-123")}"></kbd>
          </div>
        </div>
      </div>
    `;

    let resolveFetch;
    const fetchSpy = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const firstPromise = fetchCredentialsForDomain("parallel.example");
    const secondPromise = fetchCredentialsForDomain("parallel.example");

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    resolveFetch({
      ok: true,
      text: async () => html
    });

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first).toEqual([{ username: "parallel-user@example.com", password: "parallel-pass-123" }]);
    expect(second).toEqual(first);
  });

  it("expires cache entries after the TTL window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const html = `
      <div id="content">
        <div class="account">
          <div class="account__credentials">
            <kbd data-s="${encodeDataS("ttl-user@example.com")}"></kbd>
            <kbd data-s="${encodeDataS("ttl-pass-123")}"></kbd>
          </div>
        </div>
      </div>
    `;

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => html
    });
    vi.stubGlobal("fetch", fetchSpy);

    await fetchCredentialsForDomain("ttl.example");
    await fetchCredentialsForDomain("ttl.example");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-01-01T01:00:00.001Z"));
    await fetchCredentialsForDomain("ttl.example");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
