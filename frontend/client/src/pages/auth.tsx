import { motion } from "framer-motion";
import { Github } from "lucide-react";
import * as React from "react";
import { useLocation } from "wouter";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RippleButton } from "@/components/ui/ripple-button";
import { useWorkspace } from "@/context/workspace-context";

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { bootstrapSession } = useWorkspace();
  const skipAuth = String(import.meta.env.VITE_SKIP_AUTH || "").toLowerCase() === "true";
  const githubProfile = (import.meta.env.VITE_GITHUB_PROFILE as string | undefined)?.trim() || "gtathelegend";

  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        if (skipAuth) {
          const auth0Id = `dev-${githubProfile}`;
          const email = `${githubProfile}@users.infrabox.local`;
          await bootstrapSession(auth0Id, email);
          navigate("/connect-repository");
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const authError = params.get("error");
        const authErrorDescription = params.get("error_description");
        const auth0Id = params.get("auth0Id");
        const email = params.get("email");

        if (authError) {
          if (!mounted) return;
          setError(authErrorDescription || authError);
          setSubmitting(false);
          return;
        }

        if (!auth0Id || !email) {
          if (!mounted) return;
          setSubmitting(false);
          return;
        }

        await bootstrapSession(auth0Id, email);
        navigate("/connect-repository");
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : "Authentication failed";
        setError(message);
        setSubmitting(false);
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [bootstrapSession, githubProfile, navigate, skipAuth]);

  const handleContinue = () => {
    setSubmitting(true);
    setError(null);
    if (skipAuth) {
      const auth0Id = `dev-${githubProfile}`;
      const email = `${githubProfile}@users.infrabox.local`;
      void bootstrapSession(auth0Id, email)
        .then(() => navigate("/connect-repository"))
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Authentication failed");
          setSubmitting(false);
        });
      return;
    }

    window.location.assign("/api/auth/github/login");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 floating-bg opacity-60" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-8 md:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Card className="glass-card rounded-3xl">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-2xl font-bold text-slate-900">Sign in with Auth0</CardTitle>
              <p className="text-sm text-slate-600">
                {skipAuth
                  ? `Auth bypass is enabled. Loading public repositories from ${githubProfile}.`
                  : "Continue with GitHub via Auth0. Your workspace is initialized automatically."}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <RippleButton
                variant="outline"
                className="h-11 w-full justify-start border-slate-300 bg-white"
                onClick={handleContinue}
                disabled={submitting}
              >
                <Github className="h-4 w-4" />
                {submitting
                  ? skipAuth
                    ? "Initializing workspace..."
                    : "Checking Auth0 session..."
                  : skipAuth
                    ? `Continue as ${githubProfile}`
                    : "Continue with GitHub"}
              </RippleButton>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
