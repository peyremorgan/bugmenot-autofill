const USERNAME_HINTS = ["user", "username", "email", "login", "identifier", "account"];

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

export function applyCredential(fields, credential) {
  if (!fields || !credential) {
    return false;
  }

  const { usernameField, passwordField } = fields;
  if (!usernameField || !passwordField) {
    return false;
  }

  usernameField.value = credential.username;
  passwordField.value = credential.password;

  dispatchInputEvents(usernameField);
  dispatchInputEvents(passwordField);

  return true;
}

function dispatchInputEvents(element) {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
