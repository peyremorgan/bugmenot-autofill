import { extractDomainFromUrl, getMockCredentialsForDomain } from "../src/common/mockCredentialService.js";

const MENU_ID = "bugmenot-autofill-open-picker";

browser.runtime.onInstalled.addListener(() => {
  browser.menus.create(
    {
      id: MENU_ID,
      title: "Get BugMeNot Mock Credentials",
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
