import { motion } from "framer-motion";
import {
  BarChart3,
  GitBranch,
  ServerCog,
  ShieldAlert,
  ArrowRight,
  Github,
} from "lucide-react";
import { useLocation } from "wouter";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RippleButton } from "@/components/ui/ripple-button";
import { featureCards, workSteps } from "@/lib/infrabox-data";

const featureIcons = [GitBranch, BarChart3, ServerCog, ShieldAlert];

const pipelineStages = [
  "Build",
  "Test",
  "Security Scan",
  "Container Build",
  "Deploy",
];

export default function LandingPage() {
  const [, navigate] = useLocation();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 floating-bg opacity-55" />
      <div className="pointer-events-none absolute inset-0 gradient-grid opacity-35" />

      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 20 }).map((_, index) => (
          <span
            key={index}
            className="absolute h-2 w-2 rounded-full bg-white/55"
            style={{
              left: `${(index * 17) % 100}%`,
              top: `${(index * 29) % 100}%`,
              animation: `float-particle ${5 + (index % 5)}s ease-in-out ${index * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-7xl space-y-20 px-5 pb-16 pt-10 md:px-8 lg:px-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Infrabox</p>
              <p className="text-xs text-slate-600">Predict. Protect. Deploy.</p>
            </div>
          </div>
          <RippleButton
            variant="outline"
            className="border-slate-300 bg-white/80"
            onClick={() => navigate("/auth")}
          >
            Sign In
          </RippleButton>
        </header>

        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
            >
              AI DevOps Intelligence Platform
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="max-w-3xl text-4xl font-extrabold leading-tight text-slate-900 md:text-5xl"
            >
              Infrabox - Predict DevOps Failures Before Deployment
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="max-w-2xl text-base text-slate-600 md:text-lg"
            >
              AI powered DevOps intelligence that analyzes codebases, simulates
              infrastructure, and predicts deployment risks before production.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-3"
            >
              <RippleButton
                className="bg-primary text-white hover:bg-primary/90"
                onClick={() => navigate("/dashboard")}
              >
                Start Analysis
              </RippleButton>
              <RippleButton
                variant="outline"
                className="border-slate-300 bg-white/85"
                onClick={() => navigate("/dashboard")}
              >
                View Demo
              </RippleButton>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-3xl p-6 md:p-7"
          >
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Pipeline Runner</p>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-green-600">
                Live
              </span>
            </div>
            <div className="space-y-3">
              {pipelineStages.map((stage, index) => (
                <motion.div
                  key={stage}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + index * 0.08 }}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                >
                  <motion.span
                    className="h-2.5 w-2.5 rounded-full bg-primary"
                    animate={{ scale: [1, 1.35, 1] }}
                    transition={{
                      duration: 1.6,
                      repeat: Infinity,
                      delay: index * 0.2,
                    }}
                  />
                  <p className="text-sm font-medium text-slate-700">{stage}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Features
            </p>
            <h2 className="text-3xl font-bold text-slate-900">
              Built for teams shipping critical infrastructure
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((feature, index) => {
              const Icon = featureIcons[index];
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                >
                  <Card className="glass-card h-full rounded-2xl transition hover:-translate-y-1">
                    <CardHeader className="space-y-3 pb-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-lg text-slate-900">
                        {feature.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-600">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card rounded-3xl p-6"
          >
            <h3 className="mb-4 text-xl font-semibold text-slate-900">
              Interactive CI/CD Illustration
            </h3>
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max items-center gap-3">
                {pipelineStages.map((stage, index) => (
                  <div key={stage} className="flex items-center gap-3">
                    <motion.div
                      whileHover={{ y: -4 }}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm"
                    >
                      {stage}
                    </motion.div>
                    {index < pipelineStages.length - 1 ? (
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card rounded-3xl p-6"
          >
            <h3 className="mb-4 text-xl font-semibold text-slate-900">How It Works</h3>
            <div className="space-y-4">
              {workSteps.map((step, index) => (
                <div key={step} className="flex gap-3">
                  <div className="relative flex flex-col items-center">
                    <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    {index < workSteps.length - 1 ? (
                      <span className="mt-1 h-8 w-px bg-slate-300" />
                    ) : null}
                  </div>
                  <p className="pt-1 text-sm text-slate-700">{step}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <footer className="flex flex-col items-start justify-between gap-4 border-t border-slate-200 pt-6 text-sm text-slate-600 md:flex-row md:items-center">
          <p>Infrabox 2026</p>
          <div className="flex flex-wrap items-center gap-4">
            <a className="transition hover:text-slate-900" href="#">
              <span className="inline-flex items-center gap-1.5">
                <Github className="h-4 w-4" />
                GitHub
              </span>
            </a>
            <a className="transition hover:text-slate-900" href="#">
              Docs
            </a>
            <a className="transition hover:text-slate-900" href="#">
              Contact
            </a>
            <a className="transition hover:text-slate-900" href="#">
              Privacy
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
