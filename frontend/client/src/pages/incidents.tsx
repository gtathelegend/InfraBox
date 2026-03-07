import { motion } from "framer-motion";
import { AlertOctagon, Bot, CheckCircle2, ShieldAlert, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useIncidents, useResolveIncident } from "@/hooks/use-incidents";
import { format } from "date-fns";

export default function Incidents() {
  const { data: incidents, isLoading } = useIncidents();
  const resolveMutation = useResolveIncident();

  const handleResolve = (id: number) => {
    resolveMutation.mutate(id);
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-6 md:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Incidents & Remediation</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Autonomous agents detect, predict, and resolve infrastructure issues.</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-64 rounded-xl bg-card border border-border/50" />)}
          </div>
        ) : !incidents?.length ? (
          <div className="flex flex-col items-center justify-center p-16 glass-card rounded-2xl border-dashed border-2">
            <ShieldAlert className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">No active incidents</h3>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              Your infrastructure is running smoothly. Autonomous agents are monitoring.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {incidents.map((incident, i) => (
              <motion.div
                key={incident.id}
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className={`glass-card h-full flex flex-col relative overflow-hidden transition-all duration-300 ${
                  incident.status === 'resolved' ? 'opacity-70 grayscale-[0.5]' : 'hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]'
                }`}>
                  {/* Subtle Background Glow based on severity */}
                  {incident.status === 'open' && (
                    <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-20 ${
                      incident.severity === 'high' ? 'bg-destructive' : 'bg-amber-500'
                    }`} />
                  )}

                  <CardHeader className="pb-3 border-b border-border/50 relative z-10">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          incident.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-500' :
                          incident.severity === 'high' ? 'bg-destructive/20 text-destructive' : 'bg-amber-500/20 text-amber-500'
                        }`}>
                          {incident.status === 'resolved' ? <CheckCircle2 className="w-6 h-6" /> : <AlertOctagon className="w-6 h-6" />}
                        </div>
                        <div>
                          <CardTitle className="text-lg font-display leading-tight">{incident.title}</CardTitle>
                          <CardDescription className="text-xs mt-1 font-mono">Component: {incident.component}</CardDescription>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        incident.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                        incident.severity === 'high' ? 'bg-destructive/20 text-destructive border border-destructive/20' : 
                        'bg-amber-500/20 text-amber-500 border border-amber-500/20'
                      }`}>
                        {incident.status === 'resolved' ? 'Resolved' : incident.severity}
                      </span>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="py-4 flex-1 relative z-10">
                    <p className="text-sm text-foreground mb-6 leading-relaxed">
                      {incident.description}
                    </p>

                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="w-4 h-4 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-primary">AI Remediation Plan</span>
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">
                        {'>'} {incident.suggestedAction}
                      </p>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="pt-0 relative z-10">
                    {incident.status === 'open' ? (
                      <Button 
                        onClick={() => handleResolve(incident.id)}
                        disabled={resolveMutation.isPending}
                        className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] transition-all group"
                      >
                        <Zap className="w-4 h-4 mr-2 group-hover:animate-pulse" />
                        {resolveMutation.isPending ? "Executing Plan..." : "Execute AI Remediation"}
                      </Button>
                    ) : (
                      <div className="w-full py-2 text-center text-sm font-medium text-emerald-500 bg-emerald-500/10 rounded-md">
                        Resolution Successful
                      </div>
                    )}
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
