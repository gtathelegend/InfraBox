import { type User, createAuth0Client } from "@auth0/auth0-spa-js";

let auth0ClientPromise: ReturnType<typeof createAuth0Client> | null = null;
type RedirectResult = {
  appState?: {
    returnTo?: string;
  };
};

export type RedirectHandlingResult = {
  handled: boolean;
  result?: RedirectResult;
  error?: string;
};

let redirectHandlePromise: Promise<RedirectResult> | null = null;

function clearAuth0TransactionState() {
  const predicates = [
    "@@auth0spajs@@",
    "a0.spajs.txs",
    "a0.spajs",
  ];

  const clearByPrefix = (storage: Storage) => {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key) continue;
      if (predicates.some((prefix) => key.includes(prefix))) {
        keys.push(key);
      }
    }
    keys.forEach((key) => storage.removeItem(key));
  };

  clearByPrefix(window.sessionStorage);
  clearByPrefix(window.localStorage);
}

function getAuth0Config() {
  const domain =
    ((import.meta.env.VITE_AUTH0_DOMAIN as string | undefined) ?? "").trim() ||
    "dev-cpavvtuu8jeadwti.us.auth0.com";
  const clientId =
    ((import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined) ?? "").trim() ||
    "L0vv7t91md8rt7wHJRJjamm9phAOoK1F";
  const audience = ((import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined) ?? "").trim();

  if (!domain || !clientId) {
    throw new Error("Auth0 is not configured. Set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID.");
  }

  return { domain, clientId, audience };
}

async function getClient() {
  if (!auth0ClientPromise) {
    const { domain, clientId, audience } = getAuth0Config();
    auth0ClientPromise = createAuth0Client({
      domain,
      clientId,
      authorizationParams: {
        redirect_uri: window.location.origin + "/auth",
        ...(audience ? { audience } : {}),
      },
      cacheLocation: "localstorage",
      // Keep local login stable unless refresh-token flow is explicitly required.
      useRefreshTokens: false,
    });
  }

  return auth0ClientPromise;
}

export async function loginWithGithub() {
  const client = await getClient();
  const { audience } = getAuth0Config();

  await client.loginWithRedirect({
    authorizationParams: {
      connection: "github",
      scope: "openid profile email read:user repo",
      ...(audience ? { audience } : {}),
    },
    appState: {
      returnTo: "/connect-repository",
    },
  });
}

export async function handleRedirectIfPresent(): Promise<RedirectHandlingResult> {
  if (window.location.pathname !== "/auth") {
    return { handled: false };
  }

  const params = new URLSearchParams(window.location.search);
  const authError = params.get("error");
  const authErrorDescription = params.get("error_description");
  if (authError) {
    if (authError === "invalid_state" || (authErrorDescription ?? "").toLowerCase().includes("invalid state")) {
      clearAuth0TransactionState();
      window.history.replaceState({}, document.title, "/auth");
      return {
        handled: true,
        error: "Invalid state from Auth0. Session was reset. Please click Continue with GitHub again.",
      };
    }

    const message = authErrorDescription
      ? `${authError}: ${decodeURIComponent(authErrorDescription)}`
      : authError;
    return { handled: true, error: message };
  }

  const hasAuth0Params = params.has("code") && params.has("state");

  if (!hasAuth0Params) {
    return { handled: false };
  }

  if (redirectHandlePromise) {
    const result = await redirectHandlePromise;
    return { handled: true, result };
  }

  const client = await getClient();
  redirectHandlePromise = client
    .handleRedirectCallback()
    .then((result) => {
      window.history.replaceState({}, document.title, "/auth");
      return result as RedirectResult;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("invalid state")) {
        clearAuth0TransactionState();
        window.history.replaceState({}, document.title, "/auth");
        throw new Error("Invalid state from Auth0. Session was reset. Please click Continue with GitHub again.");
      }
      throw error;
    })
    .finally(() => {
      redirectHandlePromise = null;
    });

  try {
    const result = await redirectHandlePromise;
    return { handled: true, result };
  } catch (error) {
    return {
      handled: true,
      error: error instanceof Error ? error.message : "Authentication callback failed",
    };
  }
}

export async function isAuth0Authenticated(): Promise<boolean> {
  const client = await getClient();
  return client.isAuthenticated();
}

export async function getAuth0User(): Promise<User | undefined> {
  const client = await getClient();
  return client.getUser();
}

export async function getAuth0Tokens() {
  const client = await getClient();
  const { audience } = getAuth0Config();
  const shouldFetchAccessToken =
    ((import.meta.env.VITE_AUTH0_FETCH_ACCESS_TOKEN as string | undefined) ?? "").trim() === "true";

  let accessToken: string | null = null;
  if (shouldFetchAccessToken) {
    try {
      accessToken = await client.getTokenSilently({
        authorizationParams: {
          ...(audience ? { audience } : {}),
          scope: "openid profile email read:user repo",
        },
      });
    } catch {
      accessToken = null;
    }
  }

  const idTokenClaims = await client.getIdTokenClaims();
  return {
    accessToken,
    idToken: idTokenClaims?.__raw ?? null,
  };
}
