export const featureCards = [
  {
    title: "Codebase Intelligence",
    description:
      "Automatically analyzes repository architecture and dependencies.",
  },
  {
    title: "Pipeline Visualization",
    description: "Understand CI/CD stages and bottlenecks visually.",
  },
  {
    title: "Infrastructure Simulation",
    description:
      "Simulate traffic and infrastructure behavior before deployment.",
  },
  {
    title: "Failure Prediction",
    description:
      "Predict crashes, scaling issues, and cost anomalies before release.",
  },
];

export const workSteps = [
  "Connect Repository",
  "Analyze Architecture",
  "Simulate Infrastructure",
  "Predict Deployment Risk",
  "Deploy Safely",
];

export const dashboardTrend = [
  { hour: "09:00", cpu: 42, memory: 48, latency: 108, errors: 0.8 },
  { hour: "10:00", cpu: 46, memory: 50, latency: 112, errors: 0.9 },
  { hour: "11:00", cpu: 54, memory: 58, latency: 130, errors: 1.2 },
  { hour: "12:00", cpu: 63, memory: 61, latency: 152, errors: 1.5 },
  { hour: "13:00", cpu: 58, memory: 60, latency: 141, errors: 1.3 },
  { hour: "14:00", cpu: 61, memory: 64, latency: 148, errors: 1.1 },
  { hour: "15:00", cpu: 56, memory: 59, latency: 132, errors: 0.9 },
];

export const alerts = [
  {
    severity: "warning",
    title: "Build cache miss spike",
    detail: "Test stage took 32% longer due to cache invalidation.",
  },
  {
    severity: "danger",
    title: "Payment service memory pressure",
    detail: "Projected memory exceeds limit at 10k concurrent users.",
  },
  {
    severity: "success",
    title: "Security scan baseline healthy",
    detail: "No critical vulnerabilities detected in latest run.",
  },
];

export const pipelineStages = [
  { name: "Build", time: "2m 18s", failRate: "1.8%", status: "success" },
  { name: "Test", time: "4m 46s", failRate: "6.2%", status: "warning" },
  {
    name: "Security Scan",
    time: "3m 08s",
    failRate: "2.1%",
    status: "success",
  },
  {
    name: "Container Build",
    time: "2m 51s",
    failRate: "1.4%",
    status: "success",
  },
  { name: "Deploy", time: "1m 10s", failRate: "0.7%", status: "success" },
];

export const riskCards = [
  {
    title: "Memory Leak Risk",
    probability: 72,
    service: "Payment Service",
    fix: "Increase memory limit and patch caching strategy.",
    tone: "danger",
  },
  {
    title: "Dependency Failure",
    probability: 41,
    service: "Auth Service",
    fix: "Pin `jsonwebtoken` and add fallback token validation.",
    tone: "warning",
  },
  {
    title: "Database Overload",
    probability: 58,
    service: "Primary PostgreSQL",
    fix: "Add read replicas and index `transactions.created_at`.",
    tone: "warning",
  },
  {
    title: "Network Latency",
    probability: 33,
    service: "API Gateway",
    fix: "Enable edge caching and reduce blocking middleware.",
    tone: "success",
  },
];

export const deploymentTimeline = [
  { time: "14:02", title: "Build artifacts generated", status: "done" },
  { time: "14:09", title: "Security scan completed", status: "done" },
  { time: "14:16", title: "Infrastructure simulation passed", status: "done" },
  { time: "14:20", title: "Awaiting manual approval", status: "active" },
  { time: "14:24", title: "Progressive rollout", status: "pending" },
];

export const monthlyCostData = [
  { month: "Jan", compute: 1280, storage: 460, bandwidth: 310 },
  { month: "Feb", compute: 1410, storage: 470, bandwidth: 360 },
  { month: "Mar", compute: 1360, storage: 482, bandwidth: 340 },
  { month: "Apr", compute: 1490, storage: 500, bandwidth: 388 },
  { month: "May", compute: 1570, storage: 530, bandwidth: 420 },
  { month: "Jun", compute: 1680, storage: 548, bandwidth: 452 },
];

export const assistantMessages = [
  {
    role: "user",
    content: "Why will deployment fail?",
  },
  {
    role: "assistant",
    content:
      "Payment service exceeds memory limits under high traffic. Suggested fix: raise container memory to 1.5GB and enable autoscaling from 2 to 4 replicas.",
    code: "kubectl set resources deployment/payment-service --limits=memory=1536Mi\nkubectl autoscale deployment/payment-service --cpu-percent=70 --min=2 --max=4",
  },
  {
    role: "user",
    content: "How can I reduce cloud costs?",
  },
  {
    role: "assistant",
    content:
      "Two `worker` instances are underutilized. Rightsize to burstable nodes and apply scale-to-zero for the nightly batch queue. Estimated savings: $210/month.",
  },
];

export const simulationLoads = [100, 1000, 5000, 10000];

export const buildSimulationSeries = (users: number) => {
  const intensity = users / 10000;

  return [
    {
      step: "Warmup",
      cpu: Math.round(36 + intensity * 18),
      memory: Math.round(42 + intensity * 24),
      latency: Math.round(92 + intensity * 60),
      errors: +(0.3 + intensity * 0.7).toFixed(2),
    },
    {
      step: "Spike",
      cpu: Math.round(44 + intensity * 32),
      memory: Math.round(48 + intensity * 36),
      latency: Math.round(108 + intensity * 112),
      errors: +(0.5 + intensity * 1.9).toFixed(2),
    },
    {
      step: "Steady",
      cpu: Math.round(38 + intensity * 26),
      memory: Math.round(45 + intensity * 30),
      latency: Math.round(98 + intensity * 92),
      errors: +(0.4 + intensity * 1.3).toFixed(2),
    },
    {
      step: "Recovery",
      cpu: Math.round(34 + intensity * 20),
      memory: Math.round(40 + intensity * 24),
      latency: Math.round(90 + intensity * 72),
      errors: +(0.3 + intensity * 0.9).toFixed(2),
    },
  ];
};
