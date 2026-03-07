import * as React from "react";

import { dismissApiError } from "@services/apiClientState";
import { useApiClientState } from "@/hooks/use-api-client-state";
import ErrorAlert from "@/components/ErrorAlert";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function GlobalApiFeedback() {
  const { pendingRequests, errors } = useApiClientState();

  React.useEffect(() => {
    if (errors.length === 0) return;

    const timers = errors.map((errorItem) =>
      window.setTimeout(() => dismissApiError(errorItem.id), 6000),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [errors]);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      <div className="pointer-events-auto self-end">
        {pendingRequests > 0 ? <LoadingSpinner message="Syncing data..." /> : null}
      </div>

      <div className="pointer-events-auto space-y-2">
        {errors.map((errorItem) => (
          <ErrorAlert
            key={errorItem.id}
            message={errorItem.message}
            statusCode={errorItem.statusCode}
            onDismiss={() => dismissApiError(errorItem.id)}
          />
        ))}
      </div>
    </div>
  );
}
