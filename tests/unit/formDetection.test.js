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

  it("applies credential values and emits events", () => {
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

    const result = applyCredential(fields, {
      username: "alice",
      password: "secret"
    });

    expect(result).toBe(true);
    expect(fields.usernameField.value).toBe("alice");
    expect(fields.passwordField.value).toBe("secret");
    expect(usernameEvents).toContain("input");
    expect(passwordEvents).toContain("change");
  });

  it("returns null when password field is missing", () => {
    document.body.innerHTML = `<input type="text" id="username" />`;
    const fields = findLoginFields(document);
    expect(fields).toBeNull();
  });
});
