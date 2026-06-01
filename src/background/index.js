import { fetchCredentialsForDomain, extractDomainFromUrl } from "../common/bmnCredentialService.js";

// Context menu setup
const MENU_ID = "bugmenot-autofill-open-picker";

browser.runtime.onInstalled.addListener(() => {
  console.debug("[BugMeNot] onInstalled fired, creating context menu...");
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
        console.debug("[BugMeNot] Context menu created successfully!");
      }
    }
  );
});

browser.runtime.onMessage.addListener(async (message) => {
  if (message?.type !== "bugmenot:getCredentials") {
    return undefined;
  }

  console.debug("[BugMeNot] Received getCredentials message:", message);
  try {
    const credentials = await fetchCredentialsForDomain(message.domain);
    console.debug("[BugMeNot] Returning credentials:", credentials);
    return { ok: true, credentials };
  } catch (error) {
    console.error("[BugMeNot] Failed to resolve credentials:", error);
    return { ok: false, credentials: [] };
  }
});

browser.menus.onClicked.addListener(async (info, tab) => {
  console.debug("[BugMeNot] Context menu clicked:", info);
  if (info.menuItemId !== MENU_ID || !tab?.id) {
    console.debug("[BugMeNot] Ignoring click - wrong menu ID or no tab");
    return;
  }

  console.debug(`[BugMeNot] Tab URL: ${tab.url}`);
  const domain = extractDomainFromUrl(tab.url);
  console.debug(`[BugMeNot] Extracted domain: "${domain}"`);
  
  if (!domain) {
    console.error("[BugMeNot] Failed to extract domain from URL");
    return;
  }
  
  const credentials = await fetchCredentialsForDomain(domain);
  console.debug(`[BugMeNot] Domain: ${domain}, Credentials count: ${credentials.length}`);
  console.debug("[BugMeNot] Credentials:", credentials);

  try {
    await browser.tabs.sendMessage(tab.id, {
      type: "bugmenot:openCredentialPicker",
      payload: {
        domain,
        credentials,
        targetElementId: info.targetElementId
      }
    });
    console.debug("[BugMeNot] Message sent to content script");
  } catch (error) {
    console.error("[BugMeNot] Failed to send message to content script:", error);
  }
});
