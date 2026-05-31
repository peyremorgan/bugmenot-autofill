const DEFAULT_CREDENTIALS = Object.freeze([
  { username: "demo_user_1", password: "demo_pass_1" },
  { username: "demo_user_2", password: "demo_pass_2" },
  { username: "demo_user_3", password: "demo_pass_3" }
]);

const DOMAIN_OVERRIDES = Object.freeze({
  "example.com": Object.freeze([
    { username: "reader@example.com", password: "example-pass-123" },
    { username: "trial@example.com", password: "trial-pass-456" }
  ]),
  "news.ycombinator.com": Object.freeze([
    { username: "hn_reader", password: "hn_mock_password" },
    { username: "community_user", password: "community_mock_password" }
  ])
});

export function getMockCredentialsForDomain(domain) {
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    return [...DEFAULT_CREDENTIALS];
  }

  if (DOMAIN_OVERRIDES[normalized]) {
    return [...DOMAIN_OVERRIDES[normalized]];
  }

  return [...DEFAULT_CREDENTIALS];
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
