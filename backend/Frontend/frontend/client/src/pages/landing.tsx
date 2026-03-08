import { motion } from "framer-motion";
import {
  ArrowRight,
  Code2,
  GitBranch,
  Network,
  Rocket,
  ServerCog,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";

import { InfraboxLogo } from "@/components/brand/infrabox-logo";
import { RippleButton } from "@/components/ui/ripple-button";

const navItems = [
  { label: "Product", href: "#product" },
  { label: "Features", href: "#features" },
  { label: "Architecture", href: "#architecture" },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "#docs" },
];

const featureItems = [
  {
    title: "Codebase Intelligence",
    description: "Automatically analyze repository architecture and service topology.",
    icon: Code2,
  },
  {
    title: "Pipeline Visualization",
    description: "Understand CI/CD stages, execution drift, and bottlenecks instantly.",
    icon: Network,
  },
  {
    title: "Infrastructure Simulation",
    description: "Simulate traffic, scaling pressure, and runtime container behavior.",
    icon: ServerCog,
  },
  {
    title: "Failure Prediction",
    description: "Detect scaling risks and system failures before deployment.",
    icon: ShieldAlert,
  },
];

const processItems = [
  { title: "Developer pushes code", icon: GitBranch },
  { title: "Repository analysis", icon: Code2 },
  { title: "Infrastructure simulation", icon: ServerCog },
  { title: "Failure prediction", icon: ShieldAlert },
  { title: "Deployment confidence score", icon: Rocket },
];

const testimonials = [
  {
    name: "Ananya Mehta",
    role: "Lead Platform Engineer, FluxLoop",
    quote:
      "Infrabox surfaced memory pressure in our payment service before rollout. We fixed it in staging and avoided a critical outage.",
    initials: "AM",
  },
  {
    name: "Rohan Kapoor",
    role: "DevOps Manager, CloudNest",
    quote:
      "The pipeline bottleneck analysis gave us clear action points. Our release cycle became faster and far more predictable.",
    initials: "RK",
  },
  {
    name: "Sara Thomas",
    role: "SRE, ByteForge",
    quote:
      "Cost spike prediction with simulation insights helped us tune autoscaling and save budget without sacrificing reliability.",
    initials: "ST",
  },
];

const footerLinks = [
  {
    title: "Product",
    links: ["Features", "Pricing", "Docs", "Architecture"],
  },
  {
    title: "Company",
    links: ["About", "Blog", "Careers", "Contact"],
  },
  {
    title: "Legal",
    links: ["Privacy", "Terms", "Security", "Compliance"],
  },
];

const sectionFade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.45, ease: "easeOut" },
} as const;

export default function LandingPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-80px] top-[-80px] h-[280px] w-[280px] rounded-full bg-[#ffb347]/30 blur-3xl" />
        <div className="absolute right-[-80px] top-[120px] h-[320px] w-[320px] rounded-full bg-[#ff9a3c]/25 blur-3xl" />
        <div className="absolute bottom-[-120px] left-1/2 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-[#ff7a18]/18 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-orange-100/80 bg-white/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-10">
          <div className="flex items-center gap-3">
            <InfraboxLogo className="h-10 w-10 rounded-xl shadow-[0_12px_30px_rgba(255,122,24,0.35)]" />
            <div>
              <p className="text-base font-semibold text-slate-900">Infrabox</p>
              <p className="text-xs text-slate-500">Predict. Protect. Deploy.</p>
            </div>
          </div>

          <ul className="hidden items-center gap-7 lg:flex">
            {navItems.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className="text-sm text-slate-600 transition hover:text-slate-900"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2.5">
            <RippleButton
              variant="ghost"
              className="h-10 rounded-full px-4 text-sm text-slate-700 hover:bg-orange-50"
              onClick={() => navigate("/auth")}
            >
              Login
            </RippleButton>
            <RippleButton
              className="h-10 rounded-full bg-gradient-to-r from-[#ff7a18] to-[#ff9a3c] px-5 text-sm text-white hover:from-[#eb6d12] hover:to-[#f08f2f]"
              onClick={() => navigate("/auth")}
            >
              Get Started
            </RippleButton>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-24 px-6 pb-20 pt-12 md:px-10">
        <section
          id="product"
          className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="space-y-6"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-[#ff7a18]">
              <Sparkles className="h-3.5 w-3.5" />
              AI-Powered DevOps Intelligence
            </span>

            <h1 className="text-4xl font-extrabold leading-tight text-slate-900 md:text-5xl">
              Transform The Way
              <br />
              You Deploy Cloud Infrastructure
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
              Infrabox analyzes your repositories, simulates infrastructure behavior,
              and predicts failures before production deployment.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <RippleButton
                className="h-11 rounded-full bg-gradient-to-r from-[#ff7a18] to-[#ff9a3c] px-6 text-white hover:from-[#eb6d12] hover:to-[#f08f2f]"
                onClick={() => navigate("/auth")}
              >
                Start Analysis
              </RippleButton>
              <RippleButton
                variant="outline"
                className="h-11 rounded-full border-orange-200 bg-white px-6 text-slate-700 hover:bg-orange-50"
                onClick={() => navigate("/auth")}
              >
                View Demo
              </RippleButton>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.12 }}
            className="relative mx-auto h-[420px] w-full max-w-[520px]"
          >
            <motion.div
              className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[#ffb347]/55 via-[#ff9a3c]/55 to-[#ff7a18]/55 blur-3xl"
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />

            <motion.div
              className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-200/70"
              animate={{ scale: [1, 1.16, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute left-1/2 top-1/2 h-[140px] w-[140px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[#ff7a18] via-[#ff9a3c] to-[#ffb347] shadow-[0_20px_60px_rgba(255,122,24,0.45)]"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            />

            <motion.div
              className="absolute left-[10%] top-[16%] rounded-xl border border-orange-200 bg-white/90 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3.1, repeat: Infinity, ease: "easeInOut" }}
            >
              Failure Risk Scan
            </motion.div>
            <motion.div
              className="absolute right-[4%] top-[56%] rounded-xl border border-orange-200 bg-white/90 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm"
              animate={{ y: [0, 9, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            >
              Deployment Confidence +18%
            </motion.div>
            <motion.div
              className="absolute bottom-[5%] left-[22%] rounded-xl border border-orange-200 bg-white/90 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2.7, repeat: Infinity, ease: "easeInOut" }}
            >
              Simulation Active
            </motion.div>
          </motion.div>
        </section>

        <motion.section {...sectionFade}>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Product Visual
              </p>
              <h2 className="text-3xl font-bold text-slate-900">
                Real-time DevOps control center preview
              </h2>
            </div>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[75%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#ffb347]/30 via-[#ff9a3c]/25 to-[#ff7a18]/25 blur-3xl" />
            <div className="relative rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_26px_50px_rgba(15,23,42,0.10)] md:p-6">
              <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-700">
                  Repository: KartikSharma4448/Auccostic-Ai
                </p>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  Live
                </span>
              </div>

              <div className="mb-4 grid gap-3 md:grid-cols-4">
                {[
                  "Deployment Confidence",
                  "Active Repositories",
                  "Simulation Status",
                  "Infrastructure Health",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <p className="text-xs text-slate-500">{item}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">98%</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="mb-3 text-sm font-semibold text-slate-800">Pipeline Flow</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {["Repository", "Analysis", "Simulation", "Prediction", "Deploy"].map(
                      (step, index, array) => (
                        <div key={step} className="flex items-center gap-2">
                          <span className="rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-slate-700">
                            {step}
                          </span>
                          {index < array.length - 1 ? (
                            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                          ) : null}
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-amber-700">
                    Cost During Traffic Spike
                  </p>
                  <p className="mt-1 text-2xl font-bold text-amber-800">$3,420</p>
                  <p className="mt-2 text-sm text-amber-700">Predicted from simulation model</p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section id="features" {...sectionFade} className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Features
            </p>
            <h2 className="text-3xl font-bold text-slate-900">
              AI-Powered DevOps Intelligence
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featureItems.map((item, index) => (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ delay: index * 0.06, duration: 0.4 }}
                whileHover={{ y: -4, scale: 1.01 }}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff7a18]/20 to-[#ffb347]/30 text-[#ff7a18]">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {item.description}
                </p>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <motion.section id="architecture" {...sectionFade} className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Workflow
            </p>
            <h2 className="text-3xl font-bold text-slate-900">How Infrabox Works</h2>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-5">
              {processItems.map((item, index) => (
                <div key={item.title} className="relative">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-[#ff7a18]">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">{item.title}</p>
                  </div>
                  {index < processItems.length - 1 ? (
                    <span className="absolute -right-3 top-1/2 hidden h-px w-6 bg-orange-200 md:block" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section {...sectionFade} className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-slate-900">
              Trusted by DevOps teams building scalable systems.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <motion.article
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: index * 0.06, duration: 0.4 }}
                whileHover={{ y: -4 }}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-[0_16px_34px_rgba(255,122,24,0.16)]"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-[#ff7a18]">
                    {testimonial.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{testimonial.name}</p>
                    <p className="text-xs text-slate-500">{testimonial.role}</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">"{testimonial.quote}"</p>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <motion.section
          id="pricing"
          {...sectionFade}
          className="relative overflow-hidden rounded-3xl border border-orange-200 bg-gradient-to-r from-[#fff3e4] via-[#ffe6c7] to-[#fff3e4] p-8 text-center shadow-sm md:p-12"
        >
          <div className="pointer-events-none absolute -left-14 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-[#ff9a3c]/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-14 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-[#ff7a18]/25 blur-3xl" />

          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
            Predict deployment failures before they reach production.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 md:text-base">
            Bring AI-powered risk prediction into your release cycle and deploy
            with confidence.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <RippleButton
              className="h-11 rounded-full bg-gradient-to-r from-[#ff7a18] to-[#ff9a3c] px-6 text-white hover:from-[#eb6d12] hover:to-[#f08f2f]"
              onClick={() => navigate("/auth")}
            >
              Get Started
            </RippleButton>
            <RippleButton
              variant="outline"
              className="h-11 rounded-full border-orange-200 bg-white px-6 text-slate-700 hover:bg-orange-50"
              onClick={() => navigate("/auth")}
            >
              Request Demo
            </RippleButton>
          </div>
        </motion.section>
      </main>

      <footer id="docs" className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-4 md:px-10">
          <div>
            <div className="flex items-center gap-3">
              <InfraboxLogo className="h-10 w-10 rounded-xl" />
              <div>
                <p className="text-base font-semibold text-slate-900">Infrabox</p>
                <p className="text-xs text-slate-500">Predict. Protect. Deploy.</p>
              </div>
            </div>
          </div>

          {footerLinks.map((group) => (
            <div key={group.title}>
              <p className="mb-3 text-sm font-semibold text-slate-900">{group.title}</p>
              <div className="space-y-2">
                {group.links.map((item) => (
                  <a
                    key={item}
                    href="#"
                    className="block text-sm text-slate-600 transition hover:text-slate-900"
                  >
                    {item}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 px-6 py-4 text-center text-sm text-slate-500 md:px-10">
          © Infrabox. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
