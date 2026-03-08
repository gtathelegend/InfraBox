import { motion } from "framer-motion";
import { Activity, CheckCircle, Clock, Search, ShieldAlert, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { usePipelines } from "@/hooks/use-pipelines";
import { format } from "date-fns";

export default function Pipelines() {
  const { data: pipelines, isLoading } = usePipelines();

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'running': return <RefreshCw className="w-4 h-4 text-primary animate-spin" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-6 md:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Pipelines & Sandbox</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Visualize CI/CD flow and simulated sandbox environments.</p>
        </div>

        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2].map(i => <div key={i} className="h-40 rounded-xl bg-card border border-border/50" />)}
          </div>
        ) : !pipelines?.length ? (
          <div className="text-center p-12 glass-card rounded-xl">
            <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium">No pipelines recorded yet</p>
          </div>
        ) : (
          <div className="space-y-6">
            {pipelines.map((pipe, i) => (
              <motion.div
                key={pipe.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="glass-card overflow-hidden">
                  <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          {getStatusIcon(pipe.status)}
                          <CardTitle className="text-lg font-display">{pipe.name}</CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                          Triggered on {pipe.createdAt ? format(new Date(pipe.createdAt), "PPpp") : "Unknown"}
                        </CardDescription>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Deployment Confidence</p>
                          <p className={`text-lg font-bold font-display leading-none ${pipe.confidenceScore && pipe.confidenceScore >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {pipe.confidenceScore || '--'} / 100
                          </p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Cost Impact</p>
                          <p className="text-lg font-bold font-display leading-none text-foreground">
                            ${pipe.costPrediction || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {/* Visualizer */}
                    <div className="flex items-center justify-between relative">
                      <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border/50 -z-10" />
                      
                      {['Build', 'Test', 'Security Scan', 'Deploy'].map((stage, stepIdx) => {
                        // Mocking step states based on overall status
                        let stepStatus = 'success';
                        if (pipe.status === 'failed' && stepIdx === 2) stepStatus = 'failed';
                        if (pipe.status === 'failed' && stepIdx > 2) stepStatus = 'pending';

                        return (
                          <div key={stage} className="flex flex-col items-center bg-card px-2">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-lg mb-3 ${
                              stepStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' :
                              stepStatus === 'failed' ? 'bg-destructive/10 border-destructive/30 text-destructive' :
                              'bg-muted border-border text-muted-foreground'
                            }`}>
                              {stage === 'Build' && <Activity className="w-5 h-5" />}
                              {stage === 'Test' && <Search className="w-5 h-5" />}
                              {stage === 'Security Scan' && <ShieldAlert className="w-5 h-5" />}
                              {stage === 'Deploy' && <CheckCircle className="w-5 h-5" />}
                            </div>
                            <span className="text-xs font-medium text-foreground">{stage}</span>
                            <span className="text-[10px] text-muted-foreground mt-0.5 uppercase">
                              {stepStatus === 'success' ? 'Passed' : stepStatus === 'failed' ? 'Failed' : 'Pending'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Ensure the spin icon works if used
import { RefreshCw } from "lucide-react";
