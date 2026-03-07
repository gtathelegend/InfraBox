import { AlertTriangle, X } from "lucide-react";

type ErrorAlertProps = {
  message: string;
  statusCode?: number;
  onDismiss: () => void;
};

export default function ErrorAlert({ message, statusCode, onDismiss }: ErrorAlertProps) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 shadow-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">API request failed</p>
          <p className="text-xs text-red-700">{message}</p>
          {statusCode ? <p className="mt-1 text-[11px] text-red-600">Status: {statusCode}</p> : null}
        </div>
      </div>
      <button
        type="button"
        className="rounded p-0.5 text-red-600 transition hover:bg-red-100"
        onClick={onDismiss}
        aria-label="Dismiss error alert"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
