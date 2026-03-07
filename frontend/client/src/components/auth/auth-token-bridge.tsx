import * as React from "react";
import { useAuth0 } from "@auth0/auth0-react";

import { registerAccessTokenGetter } from "@/lib/auth-token";

export function AuthTokenBridge({ children }: { children: React.ReactNode }) {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  React.useEffect(() => {
    registerAccessTokenGetter(async () => {
      if (!isAuthenticated) {
        return null;
      }

      try {
        const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
        return await getAccessTokenSilently({
          authorizationParams: audience ? { audience } : undefined,
        });
      } catch {
        return null;
      }
    });
  }, [getAccessTokenSilently, isAuthenticated]);

  return <>{children}</>;
}
