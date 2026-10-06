export function safeStore(getBackend) {
  const mem = new Map();
  const backend = () => {
    try { return getBackend() || null; } catch { return null; }
  };
  return {
    get(key) {
      try {
        const v = backend()?.getItem(key);
        return v ?? mem.get(key) ?? null;
      } catch {
        return mem.get(key) ?? null;
      }
    },
    set(key, value) {
      mem.set(key, String(value));
      try { backend()?.setItem(key, String(value)); } catch { /* memory copy already kept */ }
    },
  };
}

export const local = safeStore(() => globalThis.localStorage);
export const session = safeStore(() => globalThis.sessionStorage);
