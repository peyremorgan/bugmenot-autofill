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

export function findLoginFields(root = document, targetElement = null) {
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

export async function applyCredential(fields, credential, options = {}) {
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
