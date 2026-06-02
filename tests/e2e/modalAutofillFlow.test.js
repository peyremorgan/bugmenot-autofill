import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyCredential, findLoginFields } from "../../src/common/formDetection.js";
import { renderCredentialModal } from "../../src/content/credentialModal.js";

function waitForAutofillCycle() {
  return new Promise((resolve) => {
    setTimeout(resolve, 80);
  });
}

describe("e2e modal autofill flow", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="login-form">
        <input type="text" id="login-username" name="username" />
        <input type="password" id="login-password" name="password" />
      </form>
    `;
  });

  it("selects credential from modal and fills form", async () => {
    const onClose = vi.fn();

    renderCredentialModal({
      domain: "example.com",
      credentials: [
        { username: "sample-user-a", password: "sample-pass-a" },
        { username: "sample-user-b", password: "sample-pass-b" }
      ],
      onSelect: async (credential) => {
        const fields = findLoginFields(document);
        await applyCredential(fields, credential, {
          betweenFieldsDelayMs: 0,
          fieldFocusDelayMs: 0,
          mutationWindowMs: 0,
          retryDelayMs: 0
        });
      },
      onClose
    });

    const secondCredential = document.querySelector("button[data-index='1']");
    secondCredential.click();
    await waitForAutofillCycle();

    expect(document.getElementById("login-username").value).toBe("sample-user-b");
    expect(document.getElementById("login-password").value).toBe("sample-pass-b");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes modal on cancel without changing fields", () => {
    const onClose = vi.fn();

    renderCredentialModal({
      domain: "example.com",
      credentials: [{ username: "sample-user-a", password: "sample-pass-a" }],
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

  it("fills both fields when a reactive page reverts first username attempt", async () => {
    let revertedOnce = false;
    const usernameField = document.getElementById("login-username");

    usernameField.addEventListener("input", () => {
      if (revertedOnce) {
        return;
      }

      revertedOnce = true;
      usernameField.value = "";
    });

    renderCredentialModal({
      domain: "example.com",
      credentials: [{ username: "reactive-user", password: "reactive-pass" }],
      onSelect: async (credential) => {
        const fields = findLoginFields(document);
        await applyCredential(fields, credential, {
          betweenFieldsDelayMs: 0,
          fieldFocusDelayMs: 0,
          mutationWindowMs: 10,
          retryDelayMs: 0,
          maxRetries: 1
        });
      },
      onClose: vi.fn()
    });

    const firstCredential = document.querySelector("button[data-index='0']");
    firstCredential.click();
    await waitForAutofillCycle();

    expect(document.getElementById("login-username").value).toBe("reactive-user");
    expect(document.getElementById("login-password").value).toBe("reactive-pass");
  });

  it("shows only first 10 credentials when more are provided", async () => {
    const credentials = Array.from({ length: 12 }, (_, index) => ({
      username: `bulk-user-${index}`,
      password: `bulk-pass-${index}`
    }));

    renderCredentialModal({
      domain: "example.com",
      credentials,
      onSelect: async (credential) => {
        const fields = findLoginFields(document);
        await applyCredential(fields, credential, {
          betweenFieldsDelayMs: 0,
          fieldFocusDelayMs: 0,
          mutationWindowMs: 0,
          retryDelayMs: 0
        });
      },
      onClose: vi.fn()
    });

    const options = document.querySelectorAll("button[data-index]");
    expect(options.length).toBe(10);

    const hiddenOption = document.querySelector("button[data-index='10']");
    expect(hiddenOption).toBeNull();

    options[9].click();
    await waitForAutofillCycle();

    expect(document.getElementById("login-username").value).toBe("bulk-user-9");
    expect(document.getElementById("login-password").value).toBe("bulk-pass-9");
  });
});
