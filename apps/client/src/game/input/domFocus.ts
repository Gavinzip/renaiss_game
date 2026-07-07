export function isDomTextEditingActive() {
  const active = document.activeElement;
  if (!active || active === document.body) return false;

  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    return !active.disabled && !active.readOnly;
  }

  if (active instanceof HTMLSelectElement) {
    return !active.disabled;
  }

  if (active instanceof HTMLElement) {
    return active.isContentEditable || Boolean(active.closest("[data-rpg-text-input='true']"));
  }

  return false;
}
