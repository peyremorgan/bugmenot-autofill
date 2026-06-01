const XOR_KEY = Object.freeze([
  119,
  166,
  92,
  105,
  28,
  173,
  47,
  207,
  249,
  203,
  255,
  136,
  153,
  90,
  130,
  253,
  39,
  33,
  110,
  148,
  234,
  71,
  192,
  246,
  5,
  243,
  90,
  247,
  27,
  15,
  245,
  46
]);

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

export function decryptDataU(dataUValue) {
  if (!dataUValue || typeof dataUValue !== "string") {
    return "";
  }

  try {
    const bytes = base64ToBytes(dataUValue);
    const decrypted = [];

    for (let index = 0; index < bytes.length; index += 1) {
      decrypted.push(bytes[index] ^ XOR_KEY[index % XOR_KEY.length]);
    }

    return bytesToText(decrypted).trim();
  } catch (error) {
    console.error("[BugMeNot] Failed to decrypt credential value:", error);
    return "";
  }
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
    const nodes = parsed.querySelectorAll("#content .account .account__credentials");
    console.debug(`[BugMeNot] Found ${nodes.length} .account__credentials nodes`);
    
    const credentials = [];

    for (const node of nodes) {
      const encryptedFields = node.querySelectorAll("kbd[data-u]");
      console.debug(`[BugMeNot] Found ${encryptedFields.length} kbd[data-u] elements in node`);
      
      if (encryptedFields.length < 2) {
        console.debug("[BugMeNot] Skipping node - insufficient encrypted fields");
        continue;
      }

      const username = decryptDataU(encryptedFields[0].getAttribute("data-u"));
      const password = decryptDataU(encryptedFields[1].getAttribute("data-u"));
      
      console.debug(`[BugMeNot] Decrypted: username="${username}", password="${password ? '***' : '(empty)'}"`);

      if (!username || !password) {
        console.debug("[BugMeNot] Skipping node - empty username or password");
        continue;
      }

      credentials.push({ username, password });
    }

    console.debug(`[BugMeNot] Successfully parsed ${credentials.length} credentials`);
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
