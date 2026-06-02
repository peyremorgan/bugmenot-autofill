const MODAL_ID = "bugmenot-autofill-modal";
const MAX_VISIBLE_CREDENTIALS = 10;

export function clearCredentialModal(root = document) {
  const existing = root.getElementById(MODAL_ID);
  if (existing) {
    existing.remove();
  }
}

export function renderCredentialModal({ domain, credentials, onSelect, onClose }, root = document) {
  clearCredentialModal(root);
  const visibleCredentials = credentials.slice(0, MAX_VISIBLE_CREDENTIALS);

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
  title.textContent = "Select Credentials";
  title.style.margin = "0 0 8px 0";
  title.style.fontSize = "18px";

  const subtitle = root.createElement("p");
  subtitle.textContent = domain ? `Domain: ${domain}` : "Domain unavailable";
  subtitle.style.margin = "0 0 12px 0";
  subtitle.style.fontSize = "14px";

  const list = root.createElement("div");
  list.style.display = "grid";
  list.style.gap = "8px";

  visibleCredentials.forEach((credential, index) => {
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
