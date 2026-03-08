import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

import { InfraboxTopbar } from "@/components/layout/infrabox-topbar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/context/workspace-context";

type InfraboxShellProps = {
  children: ReactNode;
  routeKey: string;
};

export function AppLayout({ children, routeKey }: InfraboxShellProps) {
  const { analysisModalOpen, analysisSteps, analysisStepIndex } = useWorkspace();

  return (
    <div className="flex h-screen flex-col bg-[#F8FAFC]">
      <InfraboxTopbar />
      <main className="flex-1 overflow-y-auto px-8 py-6 pt-[88px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={routeKey}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <Dialog open={analysisModalOpen}>
        <DialogContent className="rounded-2xl border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>Running Full Analysis</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {analysisSteps.map((step, index) => (
              <div
                key={step}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  index < analysisStepIndex
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : index === analysisStepIndex
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                {step}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function InfraboxShell(props: InfraboxShellProps) {
  return <AppLayout {...props} />;
}
