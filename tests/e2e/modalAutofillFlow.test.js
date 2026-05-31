import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyCredential, findLoginFields } from "../../src/common/formDetection.js";
import { renderCredentialModal } from "../../src/content/credentialModal.js";

describe("e2e modal autofill flow", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="login-form">
        <input type="text" id="login-username" name="username" />
        <input type="password" id="login-password" name="password" />
      </form>
    `;
  });

  it("selects credential from modal and fills form", () => {
    const onClose = vi.fn();

    renderCredentialModal({
      domain: "example.com",
      credentials: [
        { username: "mock-user-a", password: "mock-pass-a" },
        { username: "mock-user-b", password: "mock-pass-b" }
      ],
      onSelect: (credential) => {
        const fields = findLoginFields(document);
        applyCredential(fields, credential);
      },
      onClose
    });

    const secondCredential = document.querySelector("button[data-index='1']");
    secondCredential.click();

    expect(document.getElementById("login-username").value).toBe("mock-user-b");
    expect(document.getElementById("login-password").value).toBe("mock-pass-b");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes modal on cancel without changing fields", () => {
    const onClose = vi.fn();

    renderCredentialModal({
      domain: "example.com",
      credentials: [{ username: "mock-user-a", password: "mock-pass-a" }],
      onSelect: (credential) => {
        const fields = findLoginFields(document);
        applyCredential(fields, credential);
      },
      onClose
    });

    const cancel = document.querySelector("#bugmenot-autofill-modal button:not([data-index])");
    cancel.click();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.getElementById("bugmenot-autofill-modal")).toBeNull();
    expect(document.getElementById("login-username").value).toBe("");
    expect(document.getElementById("login-password").value).toBe("");
  });
});
