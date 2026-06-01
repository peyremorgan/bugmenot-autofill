import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __resetCredentialCacheForTesting,
  buildBugMeNotUrl,
  decryptValue,
  extractDecryptionParams,
  extractDomainFromUrl,
  fetchCredentialsForDomain,
  normalizeDomain
} from "../../src/common/bmnCredentialService.js";

// Default fixture key/attribute mimicking the live shape: two number arrays
// concatenated, plus a randomized attribute suffix.
const DEFAULT_KEY_PARTS = [
  [119, 166, 92, 105, 28, 173, 47, 207, 249, 203, 255, 136, 153, 90, 130, 253],
  [39, 33, 110, 148, 234, 71, 192, 246, 5, 243, 90, 247, 27, 15, 245, 46]
];
const DEFAULT_ATTR = "u";

function encodeWithKey(value, key) {
  const encrypted = [];
  for (let index = 0; index < value.length; index += 1) {
    encrypted.push(
      String.fromCharCode(value.charCodeAt(index) ^ key[index % key.length])
    );
  }
  return btoa(encrypted.join(""));
}

/**
 * Build an inline decryption script that mirrors the obfuscated one served by
 * bugmenot.com. Variable names are randomized to ensure the extractor is not
 * coupled to a specific name.
 */
function buildDecryptionScript({
  attr = DEFAULT_ATTR,
  keyParts = DEFAULT_KEY_PARTS,
  prefix = "v"
} = {}) {
  const partNames = keyParts.map((_, idx) => `${prefix}Part${idx}_${Math.floor(Math.random() * 1e6)}`);
  const concatName = `${prefix}Key_${Math.floor(Math.random() * 1e6)}`;
  const iterName = `${prefix}Iter_${Math.floor(Math.random() * 1e6)}`;
  const elsName = `${prefix}Els_${Math.floor(Math.random() * 1e6)}`;

  const partDecls = keyParts
    .map((part, idx) => `var ${partNames[idx]} = [${part.join(",")}];`)
    .join("\n");

  const concatExpr =
    partNames.length === 1
      ? partNames[0]
      : `${partNames[0]}${partNames
          .slice(1)
          .map((n) => `.concat(${n})`)
          .join("")}`;

  return `<script>(function(){
    ${partDecls}
    var ${concatName} = ${concatExpr};
    var ${elsName} = document.querySelectorAll('[data-${attr}]');
    for (var ${iterName} = 0; ${iterName} < ${elsName}.length; ${iterName}++) {
      var raw = atob(${elsName}[${iterName}].getAttribute('data-${attr}'));
      var out = '';
      var i = 0;
      while (i < raw.length) {
        var c = raw.charCodeAt(i) ^ ${concatName}[i % ${concatName}.length];
        out += String.fromCharCode(c);
        i++;
      }
      ${elsName}[${iterName}].textContent = out;
      ${elsName}[${iterName}].removeAttribute('data-${attr}');
    }
  })();</script>`;
}

function flatKey(keyParts = DEFAULT_KEY_PARTS) {
  return keyParts.flat();
}

/**
 * Build a bugmenot-shaped HTML page with the inline decryption script and one
 * .account__credentials block per credential pair.
 */
function buildBmnHtml(credentialPairs, options = {}) {
  const attr = options.attr ?? DEFAULT_ATTR;
  const keyParts = options.keyParts ?? DEFAULT_KEY_PARTS;
  const key = flatKey(keyParts);
  const script = buildDecryptionScript({ attr, keyParts });

  const accounts = credentialPairs
    .map(
      ({ username, password }) => `
        <div class="account">
          <div class="account__credentials">
            <kbd data-${attr}="${encodeWithKey(username, key)}"></kbd>
            <kbd data-${attr}="${encodeWithKey(password, key)}"></kbd>
          </div>
        </div>`
    )
    .join("");

  return `<html><body>
    <div id="content">${accounts}</div>
    ${script}
  </body></html>`;
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

  it("decryptValue XORs a base64 value against the supplied key", () => {
    const key = flatKey();
    const encoded = encodeWithKey("reader@example.com", key);
    expect(decryptValue(encoded, key)).toBe("reader@example.com");
  });

  it("decryptValue returns empty string on bad input", () => {
    expect(decryptValue("", [1, 2, 3])).toBe("");
    expect(decryptValue("abc", [])).toBe("");
    expect(decryptValue(null, [1])).toBe("");
  });

  describe("extractDecryptionParams", () => {
    it("extracts attribute name and concatenated key from a randomized script", () => {
      const keyParts = [
        [1, 2, 3, 4],
        [10, 20, 30, 40]
      ];
      const scriptHtml = buildDecryptionScript({ attr: "n", keyParts });
      // strip the <script> wrappers for the unit test
      const scriptText = scriptHtml.replace(/^<script>/, "").replace(/<\/script>$/, "");

      const params = extractDecryptionParams(scriptText);
      expect(params).toEqual({
        attrName: "data-n",
        key: [1, 2, 3, 4, 10, 20, 30, 40]
      });
    });

    it("extracts a single-array key (no concat)", () => {
      const scriptText = `
        var only = [5, 6, 7, 8];
        var els = document.querySelectorAll('[data-x]');
        var c = raw.charCodeAt(0) ^ only[0 % only.length];
      `;
      expect(extractDecryptionParams(scriptText)).toEqual({
        attrName: "data-x",
        key: [5, 6, 7, 8]
      });
    });

    it("handles arrays with numbers > 255 by applying modulo 256", () => {
      const scriptText = `
        var part1 = [121, 220, 280, 305];
        var part2 = [10, 256, 257];
        var key = part1.concat(part2);
        var els = document.querySelectorAll('[data-y]');
        var c = raw.charCodeAt(0) ^ key[0 % key.length];
      `;
      expect(extractDecryptionParams(scriptText)).toEqual({
        attrName: "data-y",
        key: [121, 220, 24, 49, 10, 0, 1] // 280%256=24, 305%256=49, 256%256=0, 257%256=1
      });
    });

    it("handles transformation loops (e.g. subtract operation)", () => {
      const scriptText = `
        var K7y = [121, 220, 240, 65, 280, 305];
        var _iF3 = [];
        for (var mb1 = 0; mb1 < K7y.length; mb1++) _iF3.push(K7y[mb1] - 55);
        var els = document.querySelectorAll('[data-t]');
        var c = raw.charCodeAt(0) ^ _iF3[0 % _iF3.length];
      `;
      // Expected: each value from K7y - 55, then mod 256
      // 121-55=66, 220-55=165, 240-55=185, 65-55=10, 280-55=225, 305-55=250
      expect(extractDecryptionParams(scriptText)).toEqual({
        attrName: "data-t",
        key: [66, 165, 185, 10, 225, 250]
      });
    });

    it("handles transformation loops with addition", () => {
      const scriptText = `
        var src = [10, 20, 30];
        var key = [];
        for (var i = 0; i < src.length; i++) key.push(src[i] + 100);
        var els = document.querySelectorAll('[data-z]');
        var c = raw.charCodeAt(0) ^ key[0];
      `;
      expect(extractDecryptionParams(scriptText)).toEqual({
        attrName: "data-z",
        key: [110, 120, 130]
      });
    });

    it("returns null when the script does not match", () => {
      expect(extractDecryptionParams("console.log('hi')")).toBeNull();
      expect(extractDecryptionParams("")).toBeNull();
      expect(extractDecryptionParams(null)).toBeNull();
    });
  });

  it("fetches and parses credentials from bugmenot HTML", async () => {
    const html = buildBmnHtml([
      { username: "reader@example.com", password: "example-pass-123" },
      { username: "trial@example.com", password: "trial-pass-456" }
    ]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => html })
    );

    const credentials = await fetchCredentialsForDomain("example.com");
    expect(credentials).toEqual([
      { username: "reader@example.com", password: "example-pass-123" },
      { username: "trial@example.com", password: "trial-pass-456" }
    ]);
  });

  it("works when the site uses a different randomized key and attribute", async () => {
    const keyParts = [
      [33, 221, 176, 14, 165, 61, 189, 148],
      [120, 61, 67, 87, 195, 83, 16, 205]
    ];
    const html = buildBmnHtml(
      [{ username: "site2-user@example.com", password: "site2-pass" }],
      { attr: "n", keyParts }
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => html })
    );

    const credentials = await fetchCredentialsForDomain("other.example");
    expect(credentials).toEqual([
      { username: "site2-user@example.com", password: "site2-pass" }
    ]);
  });

  it("returns empty array when the decryption script is missing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const html = `
      <div id="content">
        <div class="account">
          <div class="account__credentials">
            <kbd data-u="anything"></kbd>
            <kbd data-u="anything"></kbd>
          </div>
        </div>
      </div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => html })
    );

    const credentials = await fetchCredentialsForDomain("noscript.example");
    expect(credentials).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
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
    const html = buildBmnHtml([
      { username: "cached-user@example.com", password: "cached-pass-123" }
    ]);
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => html });
    vi.stubGlobal("fetch", fetchSpy);

    const first = await fetchCredentialsForDomain("example.com");
    const second = await fetchCredentialsForDomain("example.com");

    expect(first).toEqual([
      { username: "cached-user@example.com", password: "cached-pass-123" }
    ]);
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
    const html = buildBmnHtml([
      { username: "parallel-user@example.com", password: "parallel-pass-123" }
    ]);

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

    resolveFetch({ ok: true, text: async () => html });

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first).toEqual([
      { username: "parallel-user@example.com", password: "parallel-pass-123" }
    ]);
    expect(second).toEqual(first);
  });

  it("expires cache entries after the TTL window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const html = buildBmnHtml([
      { username: "ttl-user@example.com", password: "ttl-pass-123" }
    ]);

    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => html });
    vi.stubGlobal("fetch", fetchSpy);

    await fetchCredentialsForDomain("ttl.example");
    await fetchCredentialsForDomain("ttl.example");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-01-01T01:00:00.001Z"));
    await fetchCredentialsForDomain("ttl.example");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("expires empty cache entries after 1 minute", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<div id='content'></div>"
    });
    vi.stubGlobal("fetch", fetchSpy);

    await fetchCredentialsForDomain("empty.example");
    await fetchCredentialsForDomain("empty.example");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-01-01T00:01:00.001Z"));
    await fetchCredentialsForDomain("empty.example");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
