// The display name lives in sessionStorage so a refresh silently rejoins the
// room, while each tab can still be a different participant.
const KEY = 'scrum-poker:displayName';

export function getStoredDisplayName(): string {
  try {
    return sessionStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function storeDisplayName(name: string): void {
  try {
    sessionStorage.setItem(KEY, name);
  } catch {
    // Storage can be unavailable (private mode); rejoin-on-refresh just won't work.
  }
}
