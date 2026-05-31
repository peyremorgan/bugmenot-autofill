console.log("[BugMeNot] Content script loading...");

// Form detection utilities (inlined for Firefox compatibility)
const USERNAME_HINTS = ["user", "username", "email", "login", "identifier", "account"];
const DEFAULT_FILL_OPTIONS = {
  betweenFieldsDelayMs: 60,
  fieldFocusDelayMs: 20,
  mutationWindowMs: 250,
  retryDelayMs: 120,
  maxRetries: 1
};

function scoreInput(input) {
  const type = (input.getAttribute("type") || "text").toLowerCase();
  if (type === "hidden" || type === "password") {
    return -1;
  }

  const id = (input.id || "").toLowerCase();
  const name = (input.name || "").toLowerCase();
  const autocomplete = (input.getAttribute("autocomplete") || "").toLowerCase();
  const text = [id, name, autocomplete].join(" ");

  let score = 0;
  if (type === "email") {
    score += 3;
  }
  if (type === "text") {
    score += 2;
  }
  if (autocomplete.includes("username") || autocomplete.includes("email")) {
    score += 4;
  }
  for (const hint of USERNAME_HINTS) {
    if (text.includes(hint)) {
      score += 2;
    }
  }

  return score;
}

function findLoginFields(root = document, targetElement = null) {
  const passwordField = resolvePasswordField(root, targetElement);
  if (!passwordField) {
    return null;
  }

  const usernameField = resolveUsernameField(passwordField, root);
  if (!usernameField) {
    return null;
  }

  return { usernameField, passwordField };
}

function resolvePasswordField(root, targetElement) {
  if (targetElement instanceof HTMLInputElement && targetElement.type === "password") {
    return targetElement;
  }

  return root.querySelector("input[type='password']");
}

function resolveUsernameField(passwordField, root) {
  const scope = passwordField.form || root;
  const candidates = Array.from(scope.querySelectorAll("input"));

  let bestCandidate = null;
  let bestScore = -1;

  for (const input of candidates) {
    if (input === passwordField || input.disabled || input.readOnly) {
      continue;
    }

    const score = scoreInput(input);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = input;
    }
  }

  if (bestCandidate) {
    return bestCandidate;
  }

  const allInputs = Array.from(scope.querySelectorAll("input"));
  const passwordIndex = allInputs.findIndex((entry) => entry === passwordField);
  if (passwordIndex > 0) {
    return allInputs[passwordIndex - 1];
  }

  return null;
}

async function applyCredential(fields, credential, options = {}) {
  if (!fields || !credential) {
    return false;
  }

  const { usernameField, passwordField } = fields;
  if (!usernameField || !passwordField) {
    return false;
  }

  const mergedOptions = { ...DEFAULT_FILL_OPTIONS, ...options };
  const usernameValue = String(credential.username ?? "");
  const passwordValue = String(credential.password ?? "");

  const usernameApplied = await fillFieldWithRetries(usernameField, usernameValue, mergedOptions);
  if (!usernameApplied) {
    return false;
  }

  await wait(mergedOptions.betweenFieldsDelayMs);
  const passwordApplied = await fillFieldWithRetries(passwordField, passwordValue, mergedOptions);
  if (!passwordApplied) {
    return false;
  }

  return usernameField.value === usernameValue && passwordField.value === passwordValue;
}

async function fillFieldWithRetries(field, value, options) {
  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    await simulateUserInput(field, value, options.fieldFocusDelayMs);
    const didPersist = await waitForValuePersistence(field, value, options.mutationWindowMs);
    if (didPersist) {
      return true;
    }

    if (attempt < options.maxRetries) {
      await wait(options.retryDelayMs);
    }
  }

  return false;
}

async function simulateUserInput(field, value, focusDelayMs) {
  if (document.activeElement !== field && typeof field.focus === "function") {
    field.focus();
  }

  await wait(focusDelayMs);
  setFieldValue(field, value);
  dispatchBeforeInputEvent(field, value);
  dispatchInputEvents(field);
}

function setFieldValue(field, value) {
  const prototype = Object.getPrototypeOf(field);
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (valueSetter) {
    valueSetter.call(field, value);
    return;
  }

  field.value = value;
}

function dispatchBeforeInputEvent(element, value) {
  if (typeof InputEvent !== "function") {
    return;
  }

  element.dispatchEvent(new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    composed: true,
    data: value,
    inputType: "insertText"
  }));
}

async function waitForValuePersistence(field, expectedValue, windowMs) {
  let mismatchDetected = field.value !== expectedValue;
  const observer = typeof MutationObserver === "function"
    ? new MutationObserver(() => {
      if (field.value !== expectedValue) {
        mismatchDetected = true;
      }
    })
    : null;

  if (observer) {
    observer.observe(field, {
      attributes: true,
      attributeFilter: ["value"]
    });
  }

  const interval = setInterval(() => {
    if (field.value !== expectedValue) {
      mismatchDetected = true;
    }
  }, 20);

  await wait(windowMs);
  clearInterval(interval);
  observer?.disconnect();

  return !mismatchDetected && field.value === expectedValue;
}

function dispatchInputEvents(element) {
  element.dispatchEvent(new Event("input", {
    bubbles: true,
    cancelable: true,
    composed: true
  }));
  element.dispatchEvent(new Event("change", {
    bubbles: true,
    cancelable: true,
    composed: true
  }));
}

function wait(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

// Credential modal utilities (inlined for Firefox compatibility)
const MODAL_ID = "bugmenot-autofill-modal";

function clearCredentialModal(root = document) {
  const existing = root.getElementById(MODAL_ID);
  if (existing) {
    existing.remove();
  }
}

function renderCredentialModal({ domain, credentials, onSelect, onClose }, root = document) {
  clearCredentialModal(root);

  const overlay = root.createElement("div");
  overlay.id = MODAL_ID;
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0, 0, 0, 0.45)";
  overlay.style.zIndex = "2147483647";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";

  const panel = root.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.style.background = "#fff";
  panel.style.color = "#111";
  panel.style.padding = "16px";
  panel.style.borderRadius = "10px";
  panel.style.width = "min(520px, 92vw)";
  panel.style.boxShadow = "0 12px 40px rgba(0, 0, 0, 0.3)";

  const title = root.createElement("h2");
  title.textContent = "Select Mock Credentials";
  title.style.margin = "0 0 8px 0";
  title.style.fontSize = "18px";

  const subtitle = root.createElement("p");
  subtitle.textContent = domain ? `Domain: ${domain}` : "Domain unavailable";
  subtitle.style.margin = "0 0 12px 0";
  subtitle.style.fontSize = "14px";

  const list = root.createElement("div");
  list.style.display = "grid";
  list.style.gap = "8px";

  credentials.forEach((credential, index) => {
    const row = root.createElement("button");
    row.type = "button";
    row.style.textAlign = "left";
    row.style.border = "1px solid #d0d0d0";
    row.style.background = "#f8f8f8";
    row.style.padding = "10px";
    row.style.borderRadius = "8px";
    row.style.cursor = "pointer";
    row.dataset.index = String(index);
    row.textContent = `${credential.username} / ${credential.password}`;
    row.addEventListener("click", async () => {
      await Promise.resolve(onSelect(credential));
      clearCredentialModal(root);
    });
    list.appendChild(row);
  });

  const footer = root.createElement("div");
  footer.style.marginTop = "12px";
  footer.style.display = "flex";
  footer.style.justifyContent = "flex-end";

  const cancel = root.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.style.border = "1px solid #bbb";
  cancel.style.background = "#fff";
  cancel.style.padding = "8px 12px";
  cancel.style.borderRadius = "8px";
  cancel.style.cursor = "pointer";
  cancel.addEventListener("click", () => {
    onClose();
    clearCredentialModal(root);
  });

  footer.appendChild(cancel);
  panel.appendChild(title);
  panel.appendChild(subtitle);
  panel.appendChild(list);
  panel.appendChild(footer);
  overlay.appendChild(panel);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      onClose();
      clearCredentialModal(root);
    }
  });

  root.body.appendChild(overlay);
}

// Message listener
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
