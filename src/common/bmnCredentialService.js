const BUGMENOT_BASE_URL = "https://bugmenot.com/view/";
const CACHE_TTL_MS = 60 * 60 * 1000;
const EMPTY_CACHE_TTL_MS = 60 * 1000;

const credentialCache = new Map();
const inFlightRequests = new Map();

function cloneCredentials(credentials) {
  return credentials.map((credential) => ({
    username: credential.username,
    password: credential.password
  }));
}

function getCachedCredentials(domain) {
  const entry = credentialCache.get(domain);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    credentialCache.delete(domain);
    return null;
  }

  return cloneCredentials(entry.credentials);
}

function setCachedCredentials(domain, credentials, ttl = CACHE_TTL_MS) {
  credentialCache.set(domain, {
    credentials: cloneCredentials(credentials),
    expiresAt: Date.now() + ttl
  });
}

async function requestCredentialsFromBugMeNot(url) {
  try {
    console.debug(`[BugMeNot] Making fetch request to: ${url}`);
    const response = await fetch(url, {
      method: "GET",
      credentials: "omit",
      cache: "no-store"
    });

    console.debug(`[BugMeNot] Fetch response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`[BugMeNot] Failed to fetch credentials (${response.status}) for ${url}`);
      return null;
    }

    const html = await response.text();
    console.debug(`[BugMeNot] Received HTML (${html.length} chars), parsing...`);
    const credentials = parseCredentialsFromHtml(html);
    console.debug(`[BugMeNot] Parsed ${credentials.length} credentials from HTML`);
    return credentials;
  } catch (error) {
    console.error("[BugMeNot] Failed to fetch credentials:", error);
    return null;
  }
}

function base64ToBytes(input) {
  const decoded = atob(input);
  const bytes = [];
  for (let index = 0; index < decoded.length; index += 1) {
    bytes.push(decoded.charCodeAt(index));
  }
  return bytes;
}

function bytesToText(bytes) {
  return String.fromCharCode(...bytes);
}

/**
 * Decrypt a base64-encoded value using an XOR key (array of byte values).
 * Returns "" on invalid input or on decode error.
 */
export function decryptValue(encodedValue, xorKey) {
  if (!encodedValue || typeof encodedValue !== "string") {
    return "";
  }
  if (!Array.isArray(xorKey) || xorKey.length === 0) {
    return "";
  }

  try {
    const bytes = base64ToBytes(encodedValue);
    const decrypted = [];

    for (let index = 0; index < bytes.length; index += 1) {
      decrypted.push(bytes[index] ^ xorKey[index % xorKey.length]);
    }

    return bytesToText(decrypted).trim();
  } catch (error) {
    console.error("[BugMeNot] Failed to decrypt credential value:", error);
    return "";
  }
}

/**
 * Parse an inline obfuscated decryption script (as served by bugmenot.com)
 * and extract the data attribute name and XOR key bytes.
 *
 * The script roughly looks like:
 *
 *   var A = [ n, n, n, ... ];
 *   var B = [ n, n, n, ... ];
 *   var K = A.concat(B);
 *   var els = document.querySelectorAll('[data-X]');
 *   ... atob(el.getAttribute('data-X')) ... ^ K[i % K.length] ...
 *
 * Variable names, the attribute suffix (`X`), and the number/size of arrays
 * are randomized between requests.
 *
 * Returns `{ attrName, key }` on success, or `null` if the script does not
 * match the expected shape.
 */
export function extractDecryptionParams(scriptText) {
  if (!scriptText || typeof scriptText !== "string") {
    return null;
  }

  const attrSuffixMatch = scriptText.match(
    /querySelectorAll\s*\(\s*['"]\[data-([A-Za-z0-9_-]+)\]['"]\s*\)/
  );
  if (!attrSuffixMatch) {
    return null;
  }
  const attrName = `data-${attrSuffixMatch[1]}`;

  // Identifier used as the XOR key inside the decryption loop:
  //   var X = a.charCodeAt(i) ^ KEYVAR[i % KEYVAR.length];
  const xorKeyVarMatch = scriptText.match(/\^\s*([A-Za-z_$][\w$]*)\s*\[/);
  if (!xorKeyVarMatch) {
    return null;
  }
  const xorKeyVarName = xorKeyVarMatch[1];

  // Collect every `var NAME = [ ...numbers... ];` declaration in the script.
  const arrayDecls = new Map();
  const arrayDeclRegex =
    /var\s+([A-Za-z_$][\w$]*)\s*=\s*\[\s*([\d\s,]+?)\s*\]\s*;/g;
  let match;
  while ((match = arrayDeclRegex.exec(scriptText)) !== null) {
    const name = match[1];
    const nums = match[2]
      .split(",")
      .map((token) => Number.parseInt(token.trim(), 10))
      .filter((value) => Number.isInteger(value));
    if (nums.length > 0) {
      arrayDecls.set(name, nums);
    }
  }

  // Direct array declaration.
  if (arrayDecls.has(xorKeyVarName)) {
    return { attrName, key: arrayDecls.get(xorKeyVarName) };
  }

  // Otherwise expect a concat chain: `var K = A.concat(B).concat(C)...;`
  const concatDeclRegex = new RegExp(
    `var\\s+${xorKeyVarName}\\s*=\\s*([A-Za-z_$][\\w$]*(?:\\s*\\.\\s*concat\\s*\\(\\s*[A-Za-z_$][\\w$]*\\s*\\))+)\\s*;`
  );
  const concatMatch = scriptText.match(concatDeclRegex);
  if (!concatMatch) {
    return null;
  }

  const chain = concatMatch[1];
  const firstVarMatch = chain.match(/^([A-Za-z_$][\w$]*)/);
  if (!firstVarMatch) {
    return null;
  }

  const partNames = [firstVarMatch[1]];
  const concatPartRegex = /\.\s*concat\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g;
  let partMatch;
  while ((partMatch = concatPartRegex.exec(chain)) !== null) {
    partNames.push(partMatch[1]);
  }

  const key = [];
  for (const name of partNames) {
    const arr = arrayDecls.get(name);
    if (!arr) {
      return null;
    }
    key.push(...arr);
  }

  return { attrName, key };
}

function findDecryptionParamsInDocument(doc) {
  const scripts = doc.querySelectorAll("script");
  for (const script of scripts) {
    const params = extractDecryptionParams(script.textContent || "");
    if (params) {
      return params;
    }
  }
  return null;
}

export function buildBugMeNotUrl(domain) {
  const normalized = normalizeDomain(domain);
  return normalized ? `${BUGMENOT_BASE_URL}${normalized}` : "";
}

export function parseCredentialsFromHtml(htmlString) {
  if (!htmlString || typeof htmlString !== "string") {
    console.error("[BugMeNot] parseCredentialsFromHtml: invalid input");
    return [];
  }

  try {
    const parsed = new DOMParser().parseFromString(htmlString, "text/html");

    const accountNodes = parsed.querySelectorAll(
      "#content .account .account__credentials"
    );
    console.debug(
      `[BugMeNot] Found ${accountNodes.length} .account__credentials nodes`
    );
    if (accountNodes.length === 0) {
      return [];
    }

    const params = findDecryptionParamsInDocument(parsed);
    if (!params) {
      console.error(
        "[BugMeNot] Could not locate decryption script in HTML response"
      );
      return [];
    }
    console.debug(
      `[BugMeNot] Extracted decryption params: attr=${params.attrName}, keyLen=${params.key.length}`
    );

    const selector = `[${params.attrName}]`;
    const credentials = [];

    for (const node of accountNodes) {
      const encryptedFields = node.querySelectorAll(selector);
      console.debug(
        `[BugMeNot] Found ${encryptedFields.length} ${selector} elements in node`
      );

      if (encryptedFields.length < 2) {
        console.debug("[BugMeNot] Skipping node - insufficient encrypted fields");
        continue;
      }

      const username = decryptValue(
        encryptedFields[0].getAttribute(params.attrName),
        params.key
      );
      const password = decryptValue(
        encryptedFields[1].getAttribute(params.attrName),
        params.key
      );

      console.debug(
        `[BugMeNot] Decrypted: username="${username}", password="${password ? "***" : "(empty)"}"`
      );

      if (!username || !password) {
        console.debug("[BugMeNot] Skipping node - empty username or password");
        continue;
      }

      credentials.push({ username, password });
    }

    console.debug(
      `[BugMeNot] Successfully parsed ${credentials.length} credentials`
    );
    return credentials;
  } catch (error) {
    console.error("[BugMeNot] Failed to parse credentials from HTML:", error);
    return [];
  }
}

export async function fetchCredentialsForDomain(domain) {
  console.debug(`[BugMeNot] fetchCredentialsForDomain called with: "${domain}"`);

  const normalizedDomain = normalizeDomain(domain);
  console.debug(`[BugMeNot] Normalized domain: "${normalizedDomain}"`);

  const url = buildBugMeNotUrl(normalizedDomain);
  console.debug(`[BugMeNot] BugMeNot URL: ${url}`);
  if (!url) {
    console.error("[BugMeNot] Failed to build URL, returning empty array");
    return [];
  }

  const cachedCredentials = getCachedCredentials(normalizedDomain);
  if (cachedCredentials !== null) {
    console.debug(`[BugMeNot] Returning ${cachedCredentials.length} cached credentials`);
    return cachedCredentials;
  }

  const existingRequest = inFlightRequests.get(normalizedDomain);
  if (existingRequest) {
    console.debug("[BugMeNot] Returning existing in-flight request");
    return existingRequest;
  }

  const requestPromise = (async () => {
    console.debug(`[BugMeNot] Fetching credentials from: ${url}`);
    const credentials = await requestCredentialsFromBugMeNot(url);

    if (credentials === null) {
      console.error("[BugMeNot] requestCredentialsFromBugMeNot returned null");
      return [];
    }

    console.debug(`[BugMeNot] Fetched ${credentials.length} credentials`);
    const ttl = credentials.length === 0 ? EMPTY_CACHE_TTL_MS : CACHE_TTL_MS;
    setCachedCredentials(normalizedDomain, credentials, ttl);
    return cloneCredentials(credentials);
  })();

  inFlightRequests.set(normalizedDomain, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightRequests.delete(normalizedDomain);
  }
}

export function __resetCredentialCacheForTesting() {
  credentialCache.clear();
  inFlightRequests.clear();
}

export function normalizeDomain(input) {
  if (!input || typeof input !== "string") {
    return "";
  }

  const value = input.trim().toLowerCase();
  return value.startsWith("www.") ? value.slice(4) : value;
}

export function extractDomainFromUrl(url) {
  try {
    const parsed = new URL(url);
    return normalizeDomain(parsed.hostname);
  } catch {
    return "";
  }
}
