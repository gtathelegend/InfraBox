let accessTokenGetter: (() => Promise<string | null>) | null = null;
const GITHUB_TOKEN_STORAGE_KEY = "infrabox.githubToken";

export function registerAccessTokenGetter(getter: () => Promise<string | null>) {
  accessTokenGetter = getter;
}

export async function getAccessToken(): Promise<string | null> {
  if (!accessTokenGetter) {
    return null;
  }

  try {
    return await accessTokenGetter();
  } catch {
    return null;
  }
}

export function getGitHubTokenFromStorage(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY);
  if (!token) {
    return null;
  }

  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function saveGitHubTokenToStorage(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  const trimmed = token.trim();
  if (!trimmed) {
    window.localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, trimmed);
}

export function clearGitHubTokenFromStorage() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
}
