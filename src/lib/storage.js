const STORAGE_KEY = 'sistum-tracker-state-v1';

function hasArtifactStorage() {
  return typeof window !== 'undefined' && window.storage && typeof window.storage.get === 'function' && typeof window.storage.set === 'function';
}

export async function loadAppState() {
  try {
    if (hasArtifactStorage()) {
      const stored = await window.storage.get(STORAGE_KEY);
      return parseStored(stored);
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return parseStored(stored);
  } catch {
    return null;
  }
}

export async function saveAppState(state) {
  const payload = JSON.stringify(state);
  if (hasArtifactStorage()) {
    await window.storage.set(STORAGE_KEY, payload);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, payload);
}

function parseStored(stored) {
  if (!stored) return null;
  if (typeof stored === 'string') return JSON.parse(stored);
  return stored;
}
