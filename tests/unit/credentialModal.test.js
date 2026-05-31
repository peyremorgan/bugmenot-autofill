import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearCredentialModal,
  renderCredentialModal
} from "../../src/content/credentialModal.js";

describe("credentialModal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders all credentials and handles selection", async () => {
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
    await Promise.resolve();
    expect(onSelect).toHaveBeenCalledWith({ username: "u2", password: "p2" });
    expect(document.getElementById("bugmenot-autofill-modal")).toBeNull();
  });

  it("waits for async onSelect before closing", async () => {
    let resolveSelection;
    const onSelect = vi.fn(() => new Promise((resolve) => {
      resolveSelection = resolve;
    }));

    renderCredentialModal({
      domain: "example.com",
      credentials: [{ username: "u1", password: "p1" }],
      onSelect,
      onClose: vi.fn()
    });

    const button = document.querySelector("#bugmenot-autofill-modal button[data-index='0']");
    button.click();
    await Promise.resolve();
    expect(document.getElementById("bugmenot-autofill-modal")).not.toBeNull();

    resolveSelection();
    await Promise.resolve();
    await Promise.resolve();
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
