const storageKey = "studysync-pending-confirmation";

export function readConfirmation(): { email: string; sentAt: number } {
  try {
    const pending = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    if (typeof pending?.email === "string" && typeof pending.sentAt === "number")
      return pending;
  } catch { /* The form also works when browser storage is unavailable. */ }
  return { email: "", sentAt: 0 };
}

export function rememberConfirmation(email: string, sent: boolean) {
  const last = readConfirmation();
  const sentAt = sent ? Date.now() : last.email === email ? last.sentAt : 0;
  try { sessionStorage.setItem(storageKey, JSON.stringify({ email, sentAt })); } catch {}
}

export function clearConfirmation() {
  try { sessionStorage.removeItem(storageKey); } catch {}
}
