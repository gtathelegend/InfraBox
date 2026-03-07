import * as React from "react";
import {
  getApiClientStateSnapshot,
  subscribeApiClientState,
} from "@services/apiClientState";

export function useApiClientState() {
  return React.useSyncExternalStore(subscribeApiClientState, getApiClientStateSnapshot);
}
