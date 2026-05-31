import { applyCredential, findLoginFields } from "../src/common/formDetection.js";
import { renderCredentialModal } from "../src/content/credentialModal.js";

browser.runtime.onMessage.addListener(async (message) => {
  if (message?.type !== "bugmenot:openCredentialPicker") {
    return undefined;
  }

  const { domain, credentials, targetElementId } = message.payload || {};
  if (!Array.isArray(credentials) || credentials.length === 0) {
    console.error("No credentials available to display");
    return undefined;
  }

  let targetElement = null;
  if (typeof targetElementId === "number") {
    try {
      targetElement = browser.menus.getTargetElement(targetElementId);
    } catch (error) {
      console.error("Could not resolve target element", error);
    }
  }

  renderCredentialModal({
    domain,
    credentials,
    onSelect: (credential) => {
      const fields = findLoginFields(document, targetElement);
      if (!fields) {
        console.error("Unable to locate login fields");
        return;
      }

      const didApply = applyCredential(fields, credential);
      if (!didApply) {
        console.error("Failed to apply credential");
      }
    },
    onClose: () => undefined
  });

  return undefined;
});
