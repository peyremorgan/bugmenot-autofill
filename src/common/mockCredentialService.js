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

const BUGMENOT_BASE_URL = "https://bugmenot.com/view/";

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

export function decryptDataS(dataSValue) {
  if (!dataSValue || typeof dataSValue !== "string") {
    return "";
  }

  try {
    const bytes = base64ToBytes(dataSValue);
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
    return [];
  }

  try {
    const parsed = new DOMParser().parseFromString(htmlString, "text/html");
    const nodes = parsed.querySelectorAll("#content .account .account__credentials");
    const credentials = [];

    for (const node of nodes) {
      const encryptedFields = node.querySelectorAll("kbd[data-s]");
      if (encryptedFields.length < 2) {
        continue;
      }

      const username = decryptDataS(encryptedFields[0].getAttribute("data-s"));
      const password = decryptDataS(encryptedFields[1].getAttribute("data-s"));

      if (!username || !password) {
        continue;
      }

      credentials.push({ username, password });
    }

    return credentials;
  } catch (error) {
    console.error("[BugMeNot] Failed to parse credentials from HTML:", error);
    return [];
  }
}

export async function fetchCredentialsForDomain(domain) {
  const url = buildBugMeNotUrl(domain);
  if (!url) {
    return [];
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "omit",
      cache: "no-store"
    });

    if (!response.ok) {
      console.error(`[BugMeNot] Failed to fetch credentials (${response.status}) for ${url}`);
      return [];
    }

    const html = await response.text();
    return parseCredentialsFromHtml(html);
  } catch (error) {
    console.error("[BugMeNot] Failed to fetch credentials:", error);
    return [];
  }
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
