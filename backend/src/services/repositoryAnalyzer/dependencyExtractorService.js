function parseRequirements(requirementsRaw) {
  if (!requirementsRaw) return [];

  const deps = [];
  const lines = requirementsRaw.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("-")) continue;

    const match = line.match(/^([A-Za-z0-9_.-]+)\s*([<>=!~].+)?$/);
    if (!match) continue;

    deps.push({
      name: match[1],
      version: (match[2] || "").replace(/^[=<>!~\s]+/, "") || "unknown",
      type: "runtime",
    });
  }

  return deps;
}

function parsePyProject(pyprojectRaw) {
  if (!pyprojectRaw) return [];

  const deps = [];

  const projectDepsMatch = pyprojectRaw.match(/\[project\][\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/m);
  if (projectDepsMatch) {
    const content = projectDepsMatch[1];
    const itemRegex = /"([^"]+)"/g;
    let item;
    while ((item = itemRegex.exec(content)) !== null) {
      const raw = item[1];
      const match = raw.match(/^([A-Za-z0-9_.-]+)(.*)$/);
      if (match) {
        deps.push({
          name: match[1],
          version: match[2]?.replace(/^[\s<>=!~]+/, "") || "unknown",
          type: "runtime",
        });
      }
    }
  }

  const poetryBlock = pyprojectRaw.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(\n\[|$)/m);
  if (poetryBlock) {
    const lines = poetryBlock[1].split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      if (line.startsWith("python")) continue;

      const match = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*"?([^"\n]+)"?/);
      if (match) {
        deps.push({ name: match[1], version: match[2], type: "runtime" });
      }
    }
  }

  return deps;
}

function parsePomDependencies(pomRaw) {
  if (!pomRaw) return [];

  const deps = [];
  const dependencyRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
  let block;

  while ((block = dependencyRegex.exec(pomRaw)) !== null) {
    const section = block[1];
    const groupId = section.match(/<groupId>(.*?)<\/groupId>/)?.[1]?.trim() || "";
    const artifactId = section.match(/<artifactId>(.*?)<\/artifactId>/)?.[1]?.trim() || "";
    const version = section.match(/<version>(.*?)<\/version>/)?.[1]?.trim() || "unknown";
    const scope = section.match(/<scope>(.*?)<\/scope>/)?.[1]?.trim() || "runtime";

    if (!artifactId) continue;

    deps.push({
      name: groupId ? `${groupId}:${artifactId}` : artifactId,
      version,
      type: scope,
    });
  }

  return deps;
}

function parseNodeDependencies(packageJson) {
  if (!packageJson) return [];

  const sections = [
    ["dependencies", "runtime"],
    ["devDependencies", "dev"],
    ["peerDependencies", "peer"],
    ["optionalDependencies", "optional"],
  ];

  const deps = [];

  for (const [sectionName, type] of sections) {
    const section = packageJson[sectionName] || {};
    for (const [name, version] of Object.entries(section)) {
      deps.push({ name, version, type });
    }
  }

  return deps;
}

function dedupeDependencies(dependencies) {
  const map = new Map();

  for (const dep of dependencies) {
    const key = `${dep.name}::${dep.type}`;
    if (!map.has(key)) {
      map.set(key, dep);
    }
  }

  return [...map.values()];
}

function extractDependencies(scanData, packageJson) {
  const nodeDeps = parseNodeDependencies(packageJson);
  const requirementsDeps = parseRequirements(scanData.requirementsRaw);
  const pyProjectDeps = parsePyProject(scanData.pyprojectRaw);
  const javaDeps = parsePomDependencies(scanData.pomRaw);

  return dedupeDependencies([
    ...nodeDeps,
    ...requirementsDeps,
    ...pyProjectDeps,
    ...javaDeps,
  ]);
}

module.exports = {
  extractDependencies,
};
