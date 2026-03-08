import { Auth0Provider } from "@auth0/auth0-react";
import { createRoot } from "react-dom/client";

import { AuthTokenBridge } from "@/components/auth/auth-token-bridge";
import App from "./App";
import "./index.css";

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN;
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE;

const appNode = document.getElementById("root");

if (!appNode) {
  throw new Error("Root element was not found");
}

const root = createRoot(appNode);

if (!auth0Domain || !auth0ClientId) {
  root.render(
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Auth0 is not configured</h1>
        <p className="mt-2 text-sm text-slate-600">
          Set `VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID` to run the production authentication flow.
        </p>
      </div>
    </div>,
  );
} else {
  root.render(
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      authorizationParams={{
        redirect_uri: `${window.location.origin}/auth`,
        ...(auth0Audience ? { audience: auth0Audience } : {}),
      }}
      useRefreshTokens
      cacheLocation="localstorage"
    >
      <AuthTokenBridge>
        <App />
      </AuthTokenBridge>
    </Auth0Provider>,
  );
}
