let accessTokenGetter: (() => Promise<string | null>) | null = null;

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
