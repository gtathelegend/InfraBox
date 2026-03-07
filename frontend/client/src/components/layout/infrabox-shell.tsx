import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { InfraboxSidebar } from "@/components/layout/infrabox-sidebar";
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

export function InfraboxShell({ children, routeKey }: InfraboxShellProps) {
  const { analysisModalOpen, analysisSteps, analysisStepIndex } = useWorkspace();

  return (
    <SidebarProvider defaultOpen>
      <div className="relative flex min-h-screen w-full overflow-hidden bg-background">
        <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />

        <InfraboxSidebar />

        <div className="relative z-10 flex min-h-screen flex-1 flex-col">
          <InfraboxTopbar />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
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
        </div>

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
    </SidebarProvider>
  );
}
