import { motion } from "framer-motion";
import { Chrome, Github, Lock, Mail } from "lucide-react";
import { useLocation } from "wouter";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RippleButton } from "@/components/ui/ripple-button";

export default function AuthPage() {
  const [, navigate] = useLocation();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 floating-bg opacity-60" />

      <div className="relative z-10 grid min-h-screen grid-cols-1 px-5 py-8 md:px-8 lg:grid-cols-2 lg:px-14">
        <div className="hidden flex-col justify-between rounded-3xl border border-white/35 bg-white/35 p-10 backdrop-blur-xl lg:flex">
          <div>
            <p className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Infrabox Access
            </p>
            <h1 className="mt-6 text-4xl font-bold text-slate-900">
              Predict. Protect. Deploy.
            </h1>
            <p className="mt-4 max-w-md text-sm text-slate-700">
              Connect repositories, simulate infra behavior, and get confidence
              scoring before each production rollout.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                Trusted by teams
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Kubernetes, Vercel, AWS, and hybrid platforms.
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                Today
              </p>
              <p className="mt-2 text-sm font-medium text-slate-800">
                Deployment confidence: 82 / 100
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center lg:justify-end">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <Card className="glass-card rounded-3xl">
              <CardHeader className="space-y-2 text-center">
                <CardTitle className="text-2xl font-bold text-slate-900">
                  Sign in to Infrabox
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Continue with OAuth or email login.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <RippleButton
                  variant="outline"
                  className="h-11 w-full justify-start border-slate-300 bg-white"
                >
                  <Github className="h-4 w-4" />
                  Sign in with GitHub
                </RippleButton>
                <RippleButton
                  variant="outline"
                  className="h-11 w-full justify-start border-slate-300 bg-white"
                >
                  <Chrome className="h-4 w-4" />
                  Sign in with Google
                </RippleButton>

                <div className="relative py-1 text-center text-xs uppercase tracking-[0.12em] text-slate-400">
                  <span className="bg-white px-2">or email login</span>
                  <span className="absolute left-0 top-1/2 -z-10 h-px w-full -translate-y-1/2 bg-slate-200" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input id="email" placeholder="devops@company.com" className="pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input id="password" type="password" placeholder="Enter password" className="pl-9" />
                  </div>
                </div>

                <RippleButton
                  className="h-11 w-full bg-primary text-white hover:bg-primary/90"
                  onClick={() => navigate("/connect-repository")}
                >
                  Continue to Workspace
                </RippleButton>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
