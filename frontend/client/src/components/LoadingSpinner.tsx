import { Loader2 } from "lucide-react";

type LoadingSpinnerProps = {
  message?: string;
};

export default function LoadingSpinner({ message = "Loading..." }: LoadingSpinnerProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-xs text-slate-700 shadow-sm">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <span>{message}</span>
    </div>
  );
}
