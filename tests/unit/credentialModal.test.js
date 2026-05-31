import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearCredentialModal,
  renderCredentialModal
} from "../../src/content/credentialModal.js";

describe("credentialModal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders all credentials and handles selection", () => {
    const onSelect = vi.fn();

    renderCredentialModal({
      domain: "example.com",
      credentials: [
        { username: "u1", password: "p1" },
        { username: "u2", password: "p2" }
      ],
      onSelect,
      onClose: vi.fn()
    });

    const buttons = document.querySelectorAll("#bugmenot-autofill-modal button[data-index]");
    expect(buttons.length).toBe(2);

    buttons[1].click();
    expect(onSelect).toHaveBeenCalledWith({ username: "u2", password: "p2" });
    expect(document.getElementById("bugmenot-autofill-modal")).toBeNull();
  });

  it("clears existing modal", () => {
    renderCredentialModal({
      domain: "example.com",
      credentials: [{ username: "u1", password: "p1" }],
      onSelect: vi.fn(),
      onClose: vi.fn()
    });

    clearCredentialModal();
    expect(document.getElementById("bugmenot-autofill-modal")).toBeNull();
  });
});
