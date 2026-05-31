// Mock credential service (inlined for Firefox compatibility)
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

function getMockCredentialsForDomain(domain) {
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    return [...DEFAULT_CREDENTIALS];
  }

  if (DOMAIN_OVERRIDES[normalized]) {
    return [...DOMAIN_OVERRIDES[normalized]];
  }

  return [...DEFAULT_CREDENTIALS];
}

function normalizeDomain(input) {
  if (!input || typeof input !== "string") {
    return "";
  }

  const value = input.trim().toLowerCase();
  return value.startsWith("www.") ? value.slice(4) : value;
}

function extractDomainFromUrl(url) {
  try {
    const parsed = new URL(url);
    return normalizeDomain(parsed.hostname);
  } catch {
    return "";
  }
}

// Context menu setup
const MENU_ID = "bugmenot-autofill-open-picker";

browser.runtime.onInstalled.addListener(() => {
  browser.menus.create(
    {
      id: MENU_ID,
      title: "BugMeNot Autofill...",
      contexts: ["password", "editable"]
    },
    () => {
      const lastError = browser.runtime.lastError;
      if (lastError) {
        console.error("Failed to create context menu", lastError);
      }
    }
  );
});

browser.runtime.onMessage.addListener((message) => {
  if (message?.type !== "bugmenot:getCredentials") {
    return undefined;
  }

  try {
    const credentials = getMockCredentialsForDomain(message.domain);
    return Promise.resolve({ ok: true, credentials });
  } catch (error) {
    console.error("Failed to resolve mock credentials", error);
    return Promise.resolve({ ok: false, credentials: [] });
  }
});

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) {
    return;
  }

  try {
    const domain = extractDomainFromUrl(info.pageUrl || tab.url || "");
    const credentials = getMockCredentialsForDomain(domain);

    await browser.tabs.sendMessage(tab.id, {
      type: "bugmenot:openCredentialPicker",
      payload: {
        domain,
        credentials,
        targetElementId: info.targetElementId || null
      }
    });
  } catch (error) {
    console.error("Failed to open credential picker", error);
  }
});
