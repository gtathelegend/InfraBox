/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { exec } = require("child_process");

function runCommand(command, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd, timeout: 10 * 60 * 1000 }, (error, stdout, stderr) => {
      if (error) {
        const err = new Error(stderr || error.message || "Command execution failed");
        err.status = 500;
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function sanitizeName(value) {
  return String(value || "app")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function buildKubernetesSpec({ serviceName, image, replicas = 2, namespace = "default", port = 3000 }) {
  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${serviceName}
  namespace: ${namespace}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${serviceName}
  template:
    metadata:
      labels:
        app: ${serviceName}
    spec:
      containers:
      - name: app
        image: ${image}
        ports:
        - containerPort: ${port}
        readinessProbe:
          httpGet:
            path: /api/health
            port: ${port}
          initialDelaySeconds: 10
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: ${serviceName}
  namespace: ${namespace}
spec:
  selector:
    app: ${serviceName}
  ports:
  - protocol: TCP
    port: 80
    targetPort: ${port}
  type: ClusterIP
`;
}

async function deployToKubernetes({ repository, image, options = {} }) {
  const serviceName = sanitizeName(options.serviceName || `${repository.name}-service`);
  const namespace = options.namespace || process.env.K8S_NAMESPACE || "default";
  const replicas = Number(options.replicas || process.env.K8S_REPLICAS || 2);

  const spec = buildKubernetesSpec({ serviceName, image, replicas, namespace });
  const specPath = path.join(os.tmpdir(), `infrabox-${serviceName}-${Date.now()}.yaml`);

  await fs.writeFile(specPath, spec, "utf8");
  await runCommand(`kubectl apply -f "${specPath}"`);
  await runCommand(`kubectl rollout status deployment/${serviceName} -n ${namespace} --timeout=180s`);

  const serviceUrl = options.serviceUrl || `http://${serviceName}.${namespace}.svc.cluster.local`;

  return {
    deploymentUrl: serviceUrl,
    deploymentSpecPath: specPath,
    metadata: { serviceName, namespace, replicas },
  };
}

async function healthCheckKubernetes({ metadata }) {
  const namespace = metadata?.namespace || process.env.K8S_NAMESPACE || "default";
  const serviceName = metadata?.serviceName;
  if (!serviceName) {
    const err = new Error("Kubernetes service metadata missing");
    err.status = 500;
    throw err;
  }

  const rollout = await runCommand(
    `kubectl rollout status deployment/${serviceName} -n ${namespace} --timeout=120s`
  );

  const logs = await runCommand(
    `kubectl logs deployment/${serviceName} -n ${namespace} --tail=50`
  ).catch(() => ({ stdout: "" }));

  return {
    healthy: true,
    httpStatus: 200,
    readiness: true,
    logs: logs.stdout,
    details: rollout.stdout,
  };
}

async function rollbackKubernetes({ metadata }) {
  const namespace = metadata?.namespace || process.env.K8S_NAMESPACE || "default";
  const serviceName = metadata?.serviceName;
  if (!serviceName) return { rolledBack: false, reason: "Missing service name" };

  await runCommand(`kubectl rollout undo deployment/${serviceName} -n ${namespace}`);
  await runCommand(`kubectl rollout status deployment/${serviceName} -n ${namespace} --timeout=180s`);

  return { rolledBack: true };
}

module.exports = {
  deployToKubernetes,
  healthCheckKubernetes,
  rollbackKubernetes,
};
