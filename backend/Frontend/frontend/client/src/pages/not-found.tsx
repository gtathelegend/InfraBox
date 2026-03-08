import { AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

import { Card, CardContent } from "@/components/ui/card";
import { RippleButton } from "@/components/ui/ripple-button";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="flex min-h-[65vh] w-full items-center justify-center">
      <Card className="glass-card mx-4 w-full max-w-md rounded-2xl">
        <CardContent className="space-y-4 pt-6">
          <div className="flex gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-slate-900">404 Page Not Found</h1>
          </div>
          <p className="text-sm text-slate-600">
            The requested page does not exist in this workspace.
          </p>
          <div className="flex gap-2">
            <RippleButton onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </RippleButton>
            <RippleButton
              variant="outline"
              className="border-slate-300 bg-white"
              onClick={() => navigate("/")}
            >
              Go to Landing
            </RippleButton>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
