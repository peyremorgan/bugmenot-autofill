console.log("[BugMeNot] Content script loading...");

import { findLoginFields, applyCredential } from "../common/formDetection.js";
import { renderCredentialModal } from "./credentialModal.js";

console.log("[BugMeNot] Registering content script message listener...");

browser.runtime.onMessage.addListener(async (message) => {
  console.log("[BugMeNot] Content script received message:", message);
  if (message?.type !== "bugmenot:openCredentialPicker") {
    return undefined;
  }

  const { domain, credentials, targetElementId } = message.payload || {};
  console.log("[BugMeNot] Payload:", { domain, credentialCount: credentials?.length, targetElementId });
  
  if (!Array.isArray(credentials) || credentials.length === 0) {
    console.error("[BugMeNot] No credentials available to display");
    return undefined;
  }

  let targetElement = null;
  if (typeof targetElementId === "number") {
    try {
      targetElement = browser.menus.getTargetElement(targetElementId);
      console.log("[BugMeNot] Resolved target element:", targetElement);
    } catch (error) {
      console.error("[BugMeNot] Could not resolve target element:", error);
    }
  }

  console.log("[BugMeNot] Rendering credential modal...");
  renderCredentialModal({
    domain,
    credentials,
    onSelect: async (credential) => {
      console.log("[BugMeNot] Credential selected:", credential.username);
      const fields = findLoginFields(document, targetElement);
      if (!fields) {
        console.error("[BugMeNot] Unable to locate login fields");
        return;
      }

      console.log("[BugMeNot] Found fields, applying credential...");
      const didApply = await applyCredential(fields, credential);
      if (!didApply) {
        console.error("[BugMeNot] Failed to apply credential");
      } else {
        console.log("[BugMeNot] Credential applied successfully!");
      }
    },
    onClose: () => {
      console.log("[BugMeNot] Modal closed");
    }
  });

  return undefined;
});

console.log("[BugMeNot] Content script loaded successfully!");
