console.log("[BugMeNot] Background script loading...");

import { fetchCredentialsForDomain, extractDomainFromUrl } from "../common/mockCredentialService.js";

// Context menu setup
const MENU_ID = "bugmenot-autofill-open-picker";

console.log("[BugMeNot] Registering onInstalled listener...");

browser.runtime.onInstalled.addListener(() => {
  console.log("[BugMeNot] onInstalled fired, creating context menu...");
  browser.menus.create(
    {
      id: MENU_ID,
      title: "BugMeNot Autofill...",
      contexts: ["password", "editable"]
    },
    () => {
      const lastError = browser.runtime.lastError;
      if (lastError) {
        console.error("[BugMeNot] Failed to create context menu:", lastError);
      } else {
        console.log("[BugMeNot] Context menu created successfully!");
      }
    }
  );
});

console.log("[BugMeNot] Registering onMessage listener...");

browser.runtime.onMessage.addListener(async (message) => {
  if (message?.type !== "bugmenot:getCredentials") {
    return undefined;
  }

  console.log("[BugMeNot] Received getCredentials message:", message);
  try {
    const credentials = await fetchCredentialsForDomain(message.domain);
    console.log("[BugMeNot] Returning credentials:", credentials);
    return { ok: true, credentials };
  } catch (error) {
    console.error("[BugMeNot] Failed to resolve credentials:", error);
    return { ok: false, credentials: [] };
  }
});

console.log("[BugMeNot] Registering menus.onClicked listener...");

browser.menus.onClicked.addListener(async (info, tab) => {
  console.log("[BugMeNot] Context menu clicked:", info);
  if (info.menuItemId !== MENU_ID || !tab?.id) {
    console.log("[BugMeNot] Ignoring click - wrong menu ID or no tab");
    return;
  }

  const domain = extractDomainFromUrl(tab.url);
  const credentials = await fetchCredentialsForDomain(domain);
  console.log(`[BugMeNot] Domain: ${domain}, Credentials count: ${credentials.length}`);

  try {
    await browser.tabs.sendMessage(tab.id, {
      type: "bugmenot:openCredentialPicker",
      payload: {
        domain,
        credentials,
        targetElementId: info.targetElementId
      }
    });
    console.log("[BugMeNot] Message sent to content script");
  } catch (error) {
    console.error("[BugMeNot] Failed to send message to content script:", error);
  }
});

console.log("[BugMeNot] Background script loaded successfully!");
