import { beforeEach, describe, expect, it } from "vitest";

import { applyCredential, findLoginFields } from "../../src/common/formDetection.js";

describe("formDetection", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("finds username and password fields in a simple form", () => {
    document.body.innerHTML = `
      <form>
        <input type="text" id="username" />
        <input type="password" id="password" />
      </form>
    `;

    const fields = findLoginFields(document);
    expect(fields).not.toBeNull();
    expect(fields.usernameField.id).toBe("username");
    expect(fields.passwordField.id).toBe("password");
  });

  it("applies credential values and emits events", async () => {
    document.body.innerHTML = `
      <form>
        <input type="text" id="username" />
        <input type="password" id="password" />
      </form>
    `;

    const fields = findLoginFields(document);
    const usernameEvents = [];
    const passwordEvents = [];

    fields.usernameField.addEventListener("input", () => usernameEvents.push("input"));
    fields.passwordField.addEventListener("change", () => passwordEvents.push("change"));

    const result = await applyCredential(fields, {
      username: "alice",
      password: "secret"
    }, {
      betweenFieldsDelayMs: 0,
      fieldFocusDelayMs: 0,
      mutationWindowMs: 0,
      retryDelayMs: 0
    });

    expect(result).toBe(true);
    expect(fields.usernameField.value).toBe("alice");
    expect(fields.passwordField.value).toBe("secret");
    expect(usernameEvents).toContain("input");
    expect(passwordEvents).toContain("change");
  });

  it("fills fields sequentially instead of at the same time", async () => {
    document.body.innerHTML = `
      <form>
        <input type="text" id="username" />
        <input type="password" id="password" />
      </form>
    `;

    const fields = findLoginFields(document);
    const order = [];

    fields.usernameField.addEventListener("change", () => {
      order.push("username-change");
    });
    fields.passwordField.addEventListener("change", () => {
      order.push("password-change");
    });

    await applyCredential(fields, {
      username: "alice",
      password: "secret"
    }, {
      betweenFieldsDelayMs: 0,
      fieldFocusDelayMs: 0,
      mutationWindowMs: 0,
      retryDelayMs: 0
    });

    expect(order).toEqual(["username-change", "password-change"]);
  });

  it("retries when a field value is reverted by page code", async () => {
    document.body.innerHTML = `
      <form>
        <input type="text" id="username" />
        <input type="password" id="password" />
      </form>
    `;

    const fields = findLoginFields(document);
    let didRevertUsername = false;

    fields.usernameField.addEventListener("input", () => {
      if (didRevertUsername) {
        return;
      }

      didRevertUsername = true;
      fields.usernameField.value = "";
    });

    const result = await applyCredential(fields, {
      username: "alice",
      password: "secret"
    }, {
      betweenFieldsDelayMs: 0,
      fieldFocusDelayMs: 0,
      mutationWindowMs: 10,
      retryDelayMs: 0,
      maxRetries: 1
    });

    expect(result).toBe(true);
    expect(fields.usernameField.value).toBe("alice");
    expect(fields.passwordField.value).toBe("secret");
  });

  it("returns false when field keeps reverting after retry", async () => {
    document.body.innerHTML = `
      <form>
        <input type="text" id="username" />
        <input type="password" id="password" />
      </form>
    `;

    const fields = findLoginFields(document);
    fields.passwordField.addEventListener("input", () => {
      fields.passwordField.value = "";
    });

    const result = await applyCredential(fields, {
      username: "alice",
      password: "secret"
    }, {
      betweenFieldsDelayMs: 0,
      fieldFocusDelayMs: 0,
      mutationWindowMs: 10,
      retryDelayMs: 0,
      maxRetries: 1
    });

    expect(result).toBe(false);
    expect(fields.passwordField.value).toBe("");
  });

  it("returns null when password field is missing", () => {
    document.body.innerHTML = `<input type="text" id="username" />`;
    const fields = findLoginFields(document);
    expect(fields).toBeNull();
  });

  it("prefers email-like username fields by heuristic", () => {
    document.body.innerHTML = `
      <form>
        <input type="text" id="display-name" name="display" />
        <input type="email" id="account-email" name="email" autocomplete="username" />
        <input type="password" id="password" />
      </form>
    `;

    const fields = findLoginFields(document);
    expect(fields).not.toBeNull();
    expect(fields.usernameField.id).toBe("account-email");
  });

  it("uses the target password element when provided", () => {
    document.body.innerHTML = `
      <form id="first">
        <input type="text" id="first-user" />
        <input type="password" id="first-pass" />
      </form>
      <form id="second">
        <input type="text" id="second-user" />
        <input type="password" id="second-pass" />
      </form>
    `;

    const targetPassword = document.getElementById("second-pass");
    const fields = findLoginFields(document, targetPassword);

    expect(fields).not.toBeNull();
    expect(fields.passwordField.id).toBe("second-pass");
    expect(fields.usernameField.id).toBe("second-user");
  });
});
