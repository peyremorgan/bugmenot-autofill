import { findLoginFields, applyCredential } from "../common/formDetection.js";
import { renderCredentialModal } from "./credentialModal.js";

browser.runtime.onMessage.addListener(async (message) => {
  console.debug("[BugMeNot] Content script received message:", message);
  if (message?.type !== "bugmenot:openCredentialPicker") {
    return undefined;
  }

  const { domain, credentials, targetElementId } = message.payload || {};
  console.debug("[BugMeNot] Payload:", { domain, credentialCount: credentials?.length, targetElementId });
  
  if (!Array.isArray(credentials) || credentials.length === 0) {
    console.error("[BugMeNot] No credentials available to display");
    return undefined;
  }

  let targetElement = null;
  if (typeof targetElementId === "number") {
    try {
      targetElement = browser.menus.getTargetElement(targetElementId);
      console.debug("[BugMeNot] Resolved target element:", targetElement);
    } catch (error) {
      console.error("[BugMeNot] Could not resolve target element:", error);
    }
  }

  console.debug("[BugMeNot] Rendering credential modal...");
  renderCredentialModal({
    domain,
    credentials,
    onSelect: async (credential) => {
      console.debug("[BugMeNot] Credential selected:", credential.username);
      const fields = findLoginFields(document, targetElement);
      if (!fields) {
        console.error("[BugMeNot] Unable to locate login fields");
        return;
      }

      console.debug("[BugMeNot] Found fields, applying credential...");
      const didApply = await applyCredential(fields, credential);
      if (!didApply) {
        console.error("[BugMeNot] Failed to apply credential");
      } else {
        console.info("[BugMeNot] Credential applied successfully!");
      }
    },
    onClose: () => {
      console.debug("[BugMeNot] Modal closed");
    }
  });

  return undefined;
});
