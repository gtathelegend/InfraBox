import { motion } from "framer-motion";
import {
  Activity,
  Globe,
  HardDrive,
  Server,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import {
  Background,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/context/workspace-context";

const architectureNodes: Node[] = [
  {
    id: "edge",
    position: { x: 0, y: 120 },
    data: { label: "Edge CDN" },
    style: { border: "1px solid #bfdbfe", borderRadius: 12 },
  },
  {
    id: "gateway",
    position: { x: 210, y: 120 },
    data: { label: "Ingress Gateway" },
    style: { border: "1px solid #bfdbfe", borderRadius: 12 },
  },
  {
    id: "cluster-a",
    position: { x: 440, y: 40 },
    data: { label: "Compute Cluster A" },
    style: { border: "1px solid #c7d2fe", borderRadius: 12 },
  },
  {
    id: "cluster-b",
    position: { x: 440, y: 200 },
    data: { label: "Compute Cluster B" },
    style: { border: "1px solid #fde68a", borderRadius: 12 },
  },
  {
    id: "postgres",
    position: { x: 690, y: 80 },
    data: { label: "PostgreSQL Primary" },
    style: { border: "1px solid #bbf7d0", borderRadius: 12 },
  },
  {
    id: "redis",
    position: { x: 690, y: 230 },
    data: { label: "Redis Cache" },
    style: { border: "1px solid #fbcfe8", borderRadius: 12 },
  },
];

const architectureEdges: Edge[] = [
  {
    id: "a1",
    source: "edge",
    target: "gateway",
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: true,
  },
  {
    id: "a2",
    source: "gateway",
    target: "cluster-a",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "a3",
    source: "gateway",
    target: "cluster-b",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "a4",
    source: "cluster-a",
    target: "postgres",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "a5",
    source: "cluster-b",
    target: "postgres",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "a6",
    source: "cluster-b",
    target: "redis",
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: true,
  },
];

const zoneCards: { title: string; detail: string; icon: LucideIcon }[] = [
  {
    title: "Global Edge",
    detail: "99.98% availability, median TTFB 46ms",
    icon: Globe,
  },
  {
    title: "Compute Plane",
    detail: "18 containers healthy across two clusters",
    icon: Server,
  },
  {
    title: "Data Plane",
    detail: "Primary + replica lag under 20ms",
    icon: HardDrive,
  },
  {
    title: "Security Posture",
    detail: "No critical findings in latest scan",
    icon: ShieldCheck,
  },
];

export default function ArchitecturePage() {
  const { selectedRepo } = useWorkspace();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Architecture</h1>
        <p className="mt-1 text-sm text-slate-600">
          Live digital twin of production service topology
          {selectedRepo ? ` for ${selectedRepo.fullName}` : ""}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {zoneCards.map((zone, index) => (
          <motion.div
            key={zone.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
          >
            <Card className="glass-card rounded-2xl">
              <CardContent className="space-y-2 p-5">
                <zone.icon className="h-5 w-5 text-primary" />
                <p className="text-sm font-semibold text-slate-900">{zone.title}</p>
                <p className="text-sm text-slate-600">{zone.detail}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="glass-card rounded-2xl">
        <CardHeader className="border-b border-slate-200/80">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            Infrastructure Graph
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[460px] p-0">
          <ReactFlow nodes={architectureNodes} edges={architectureEdges} fitView>
            <Background color="#dbeafe" gap={24} />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </CardContent>
      </Card>
    </div>
  );
}
