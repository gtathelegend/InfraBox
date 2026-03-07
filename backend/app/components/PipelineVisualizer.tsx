"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

type PipelineStage = {
  name: string;
  order: number;
  dependencies: string[];
};

type ParsedPipeline = {
  id: string;
  provider: string;
  stages: PipelineStage[];
};

type PipelineResponse = {
  pipelines: ParsedPipeline[];
};

type StageMetric = {
  stageName: string;
  averageStageTimeSeconds: number;
  averageStageTime: string;
  failureRate: number;
  successRate: number;
  averageRetryCount: number;
};

type RawMetric = {
  stageName: string;
  executionTime: number;
  duration: number;
  status: string;
  timestamp: string;
};

type MetricsResponse = {
  pipelineSuccessRate: number;
  stageMetrics: StageMetric[];
  rawMetrics: RawMetric[];
};

type GraphNode = {
  id: string;
  duration: number;
  durationLabel: string;
  failureRate: number;
  successRate: number;
  isBottleneck: boolean;
};

type GraphEdge = {
  source: string;
  target: string;
};

type HoverData = {
  nodeId: string;
  x: number;
  y: number;
};

type D3Node = GraphNode & d3.SimulationNodeDatum;

type D3Link = d3.SimulationLinkDatum<D3Node> & {
  source: string | D3Node;
  target: string | D3Node;
};

const DEFAULT_BOTTLENECK_THRESHOLD_SECONDS = 240;

function providerLabel(provider: string): string {
  if (provider === "github_actions") return "GitHub Actions";
  if (provider === "gitlab_ci") return "GitLab CI";
  if (provider === "jenkins") return "Jenkins";
  return provider;
}

function mapGraphData(
  pipelines: ParsedPipeline[],
  stageMetrics: StageMetric[],
  thresholdSeconds: number
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const metricMap = new Map(stageMetrics.map((metric) => [metric.stageName.toLowerCase(), metric]));
  const nodeMap = new Map<string, GraphNode>();
  const edgeSet = new Set<string>();

  for (const pipeline of pipelines) {
    const sorted = [...pipeline.stages].sort((a, b) => a.order - b.order);

    for (const stage of sorted) {
      const metric = metricMap.get(stage.name.toLowerCase());
      const duration = metric?.averageStageTimeSeconds || 0;

      if (!nodeMap.has(stage.name)) {
        nodeMap.set(stage.name, {
          id: stage.name,
          duration,
          durationLabel: metric?.averageStageTime || `${duration}s`,
          failureRate: metric?.failureRate || 0,
          successRate: metric?.successRate || 0,
          isBottleneck: duration > thresholdSeconds,
        });
      }

      if (stage.dependencies.length) {
        for (const dep of stage.dependencies) {
          const key = `${dep}::${stage.name}`;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
          }
        }
      } else {
        const prev = sorted.find((item) => item.order === stage.order - 1);
        if (prev) {
          const key = `${prev.name}::${stage.name}`;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
          }
        }
      }
    }
  }

  const edges: GraphEdge[] = [...edgeSet].map((key) => {
    const [source, target] = key.split("::");
    return { source, target };
  });

  return {
    nodes: [...nodeMap.values()],
    edges,
  };
}

export default function PipelineVisualizer() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [repoId, setRepoId] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thresholdSeconds, setThresholdSeconds] = useState(DEFAULT_BOTTLENECK_THRESHOLD_SECONDS);

  const [pipelines, setPipelines] = useState<ParsedPipeline[]>([]);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

  const graphData = useMemo(() => {
    return mapGraphData(pipelines, metrics?.stageMetrics || [], thresholdSeconds);
  }, [pipelines, metrics?.stageMetrics, thresholdSeconds]);

  const selectedStageMetric = useMemo(() => {
    if (!selectedNodeId || !metrics) return null;
    return metrics.stageMetrics.find(
      (item) => item.stageName.toLowerCase() === selectedNodeId.toLowerCase()
    ) || null;
  }, [selectedNodeId, metrics]);

  const recentLogs = useMemo(() => {
    if (!selectedNodeId || !metrics?.rawMetrics) return [];

    return [...metrics.rawMetrics]
      .filter((row) => row.stageName.toLowerCase() === selectedNodeId.toLowerCase())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8)
      .map((row) => ({
        ts: new Date(row.timestamp).toLocaleString(),
        status: row.status,
        duration: row.duration,
        executionTime: row.executionTime,
      }));
  }, [selectedNodeId, metrics?.rawMetrics]);

  const loadData = useCallback(async () => {
    if (!repoId.trim()) {
      setError("Repository ID is required");
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const [pipelineRes, metricsRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/pipeline/${repoId.trim()}`, { credentials: "include" }),
        fetch(`${apiBaseUrl}/api/pipeline/${repoId.trim()}/metrics`, { credentials: "include" }),
      ]);

      if (!pipelineRes.ok) {
        throw new Error(`Failed to load pipeline structure (${pipelineRes.status})`);
      }

      if (!metricsRes.ok) {
        throw new Error(`Failed to load pipeline metrics (${metricsRes.status})`);
      }

      const pipelineJson: PipelineResponse = await pipelineRes.json();
      const metricsJson: MetricsResponse = await metricsRes.json();

      setPipelines(pipelineJson.pipelines || []);
      setMetrics(metricsJson);

      const firstStage = pipelineJson.pipelines?.[0]?.stages?.[0]?.name || null;
      setSelectedNodeId(firstStage);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load pipeline data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, repoId]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const width = 980;
    const height = 520;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrow-head")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 22)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#94a3b8");

    const rootLayer = svg.append("g");
    const graphLayer = rootLayer.append("g");

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 2.8])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        graphLayer.attr("transform", event.transform.toString());
      });

    svg.call(zoomBehavior as never);

    const nodes: D3Node[] = graphData.nodes.map((node) => ({ ...node }));
    const links: D3Link[] = graphData.edges.map((edge) => ({ ...edge }));

    if (!nodes.length) return;

    const simulation = d3
      .forceSimulation<D3Node>(nodes)
      .force(
        "link",
        d3
          .forceLink<D3Node, D3Link>(links)
            .id((d: D3Node) => d.id)
          .distance(160)
          .strength(0.8)
      )
      .force("charge", d3.forceManyBody().strength(-720))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(48));

    const linkGroup = graphLayer.append("g").attr("stroke", "#64748b").attr("stroke-opacity", 0.55);

    const link = linkGroup
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow-head)");

    const nodeGroup = graphLayer.append("g");

    const node = nodeGroup
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (_event: MouseEvent, d: D3Node) => {
        setSelectedNodeId(d.id);
      })
      .on("mousemove", (event: MouseEvent, d: D3Node) => {
        const [x, y] = d3.pointer(event, svgEl);
        setHoverData({ nodeId: d.id, x: x + 10, y: y + 10 });
      })
      .on("mouseleave", () => {
        setHoverData(null);
      });

    node
      .append("circle")
      .attr("r", 24)
      .attr("fill", (d: D3Node) => (d.isBottleneck ? "#7f1d1d" : "#1e293b"))
      .attr("stroke", (d: D3Node) => {
        if (selectedNodeId === d.id) return "#38bdf8";
        if (d.failureRate > 0) return "#ef4444";
        return "#6366f1";
      })
      .attr("stroke-width", (d: D3Node) => (selectedNodeId === d.id ? 3 : 2));

    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", -34)
      .attr("fill", "#e2e8f0")
      .attr("font-size", 12)
      .attr("font-weight", 700)
      .text((d: D3Node) => d.id);

    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 4)
      .attr("fill", "#f8fafc")
      .attr("font-size", 11)
      .text((d: D3Node) => d.durationLabel || "0s");

    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 19)
      .attr("fill", (d: D3Node) => (d.failureRate > 0 ? "#fecaca" : "#bae6fd"))
      .attr("font-size", 10)
      .text((d: D3Node) => `${Math.round(d.failureRate)}% fail`);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: D3Link) => (typeof d.source === "string" ? 0 : d.source.x || 0))
        .attr("y1", (d: D3Link) => (typeof d.source === "string" ? 0 : d.source.y || 0))
        .attr("x2", (d: D3Link) => (typeof d.target === "string" ? 0 : d.target.x || 0))
        .attr("y2", (d: D3Link) => (typeof d.target === "string" ? 0 : d.target.y || 0));

      node.attr("transform", (d: D3Node) => `translate(${d.x || 0}, ${d.y || 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData.nodes, graphData.edges, selectedNodeId]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col gap-2 min-w-[260px]">
            <label className="text-xs uppercase tracking-wide text-gray-400">Repository ID</label>
            <input
              value={repoId}
              onChange={(event) => setRepoId(event.target.value)}
              placeholder="Enter repository ObjectId"
              className="rounded-lg border border-white/15 bg-[#0f172a] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex flex-col gap-2 min-w-[220px]">
            <label className="text-xs uppercase tracking-wide text-gray-400">Bottleneck Threshold (seconds)</label>
            <input
              type="number"
              min={30}
              value={thresholdSeconds}
              onChange={(event) => setThresholdSeconds(Number(event.target.value) || DEFAULT_BOTTLENECK_THRESHOLD_SECONDS)}
              className="rounded-lg border border-white/15 bg-[#0f172a] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
            />
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Loading..." : "Load Pipeline Graph"}
          </button>

          {metrics && (
            <div className="ml-auto rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              Pipeline Success Rate: <span className="font-semibold">{metrics.pipelineSuccessRate}%</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-[#0f172a] to-[#111827] p-3">
            <svg ref={svgRef} className="h-[540px] w-full" />

            {hoverData && (
              <div
                className="pointer-events-none absolute z-10 rounded-md border border-cyan-400/40 bg-slate-900/95 px-2 py-1 text-xs text-cyan-100"
                style={{ left: hoverData.x, top: hoverData.y }}
              >
                {hoverData.nodeId}
              </div>
            )}

            <div className="absolute left-5 top-5 rounded-md bg-slate-900/70 px-2 py-1 text-xs text-slate-300">
              Zoom: mouse wheel | Pan: drag canvas | Click node for details
            </div>
          </div>

          <aside className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">Stage Metrics Panel</h2>

            {!selectedStageMetric ? (
              <p className="text-sm text-gray-400">Select a stage to view execution time, failure rate, and recent logs.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-cyan-200">{selectedStageMetric.stageName}</h3>
                  <p className="text-xs text-gray-400 mt-1">Failure indicators and bottleneck rules are applied in graph colors.</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-slate-900/70 p-2">
                    <div className="text-gray-400 text-xs">Execution Time</div>
                    <div className="font-semibold">{selectedStageMetric.averageStageTime}</div>
                  </div>
                  <div className="rounded-lg bg-slate-900/70 p-2">
                    <div className="text-gray-400 text-xs">Failure Rate</div>
                    <div className={`font-semibold ${selectedStageMetric.failureRate > 20 ? "text-red-300" : "text-emerald-300"}`}>
                      {selectedStageMetric.failureRate}%
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/70 p-2">
                    <div className="text-gray-400 text-xs">Success Rate</div>
                    <div className="font-semibold text-emerald-300">{selectedStageMetric.successRate}%</div>
                  </div>
                  <div className="rounded-lg bg-slate-900/70 p-2">
                    <div className="text-gray-400 text-xs">Retry Count</div>
                    <div className="font-semibold">{selectedStageMetric.averageRetryCount}</div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Recent Logs</h4>
                  {recentLogs.length === 0 ? (
                    <p className="text-sm text-gray-500">No recent execution logs available for this stage.</p>
                  ) : (
                    <ul className="space-y-2 max-h-[260px] overflow-auto pr-1">
                      {recentLogs.map((log, idx) => (
                        <li key={`${log.ts}-${idx}`} className="rounded-lg border border-white/10 bg-slate-900/60 p-2 text-xs">
                          <div className="text-gray-300">{log.ts}</div>
                          <div className="mt-1 flex items-center justify-between">
                            <span className={log.status === "failed" ? "text-red-300" : "text-emerald-300"}>{log.status}</span>
                            <span className="text-gray-400">duration {log.duration}s</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            <div className="mt-5 rounded-lg border border-red-400/25 bg-red-500/10 p-2 text-xs text-red-100">
              Bottleneck rule: stages with average duration over {thresholdSeconds}s are highlighted in red.
            </div>

            {pipelines.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Detected Pipelines</h4>
                <ul className="space-y-1 text-xs text-gray-300">
                  {pipelines.map((pipeline) => (
                    <li key={pipeline.id} className="rounded-md bg-slate-900/50 px-2 py-1">
                      {providerLabel(pipeline.provider)} ({pipeline.stages.length} stages)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
