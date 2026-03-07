export type ApiErrorItem = {
  id: string;
  message: string;
  statusCode?: number;
  timestamp: number;
};

type ApiClientState = {
  pendingRequests: number;
  errors: ApiErrorItem[];
};

const MAX_ERROR_ITEMS = 5;

let state: ApiClientState = {
  pendingRequests: 0,
  errors: [],
};

let listeners: Array<() => void> = [];

function emit() {
  listeners.forEach((listener) => {
    listener();
  });
}

export function subscribeApiClientState(listener: () => void) {
  if (!listeners.includes(listener)) {
    listeners = [...listeners, listener];
  }

  return () => {
    listeners = listeners.filter((item) => item !== listener);
  };
}

export function getApiClientStateSnapshot(): ApiClientState {
  return state;
}

export function incrementPendingRequests() {
  state = {
    ...state,
    pendingRequests: state.pendingRequests + 1,
  };
  emit();
}

export function decrementPendingRequests() {
  state = {
    ...state,
    pendingRequests: Math.max(0, state.pendingRequests - 1),
  };
  emit();
}

export function pushApiError(payload: { message: string; statusCode?: number }) {
  const item: ApiErrorItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message: payload.message,
    statusCode: payload.statusCode,
    timestamp: Date.now(),
  };

  state = {
    ...state,
    errors: [item, ...state.errors].slice(0, MAX_ERROR_ITEMS),
  };
  emit();
}

export function dismissApiError(id: string) {
  state = {
    ...state,
    errors: state.errors.filter((item) => item.id !== id),
  };
  emit();
}
