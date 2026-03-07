function parsePackageJson(packageJsonRaw) {
  if (!packageJsonRaw) return null;

  try {
    return JSON.parse(packageJsonRaw);
  } catch {
    return null;
  }
}

function detectFrameworks(scanData) {
  const frameworks = new Set();
  const languages = new Set();
  const configurations = new Set();

  const pkg = parsePackageJson(scanData.packageJsonRaw);
  if (pkg) {
    configurations.add("package.json");
    languages.add("JavaScript");

    const deps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
      ...(pkg.peerDependencies || {}),
    };

    if (deps.next) frameworks.add("Next.js");
    if (deps.react) frameworks.add("React");
    if (deps.express) frameworks.add("Express");
    if (deps.nest) frameworks.add("NestJS");

    if (!deps.next) frameworks.add("Node.js");
    if (deps.typescript || scanData.lowerFiles.has("tsconfig.json")) {
      languages.add("TypeScript");
    }
  }

  if (scanData.requirementsRaw) {
    frameworks.add("Python");
    languages.add("Python");
    configurations.add("requirements.txt");
  }

  if (scanData.pyprojectRaw) {
    frameworks.add("Python");
    languages.add("Python");
    configurations.add("pyproject.toml");
  }

  if (scanData.pomRaw) {
    frameworks.add("Java");
    languages.add("Java");
    configurations.add("pom.xml");

    if (/spring-boot/i.test(scanData.pomRaw)) {
      frameworks.add("Spring Boot");
    }
  }

  if (scanData.lowerFiles.has("next.config.js") || scanData.lowerFiles.has("next.config.ts")) {
    configurations.add("next.config");
    frameworks.add("Next.js");
  }

  if (scanData.lowerFiles.has("docker-compose.yml") || scanData.lowerFiles.has("docker-compose.yaml")) {
    configurations.add("docker-compose");
  }

  if (scanData.lowerFiles.has(".github/workflows") || scanData.files.some((f) => f.startsWith(".github/workflows/"))) {
    configurations.add("github_workflows");
  }

  if (scanData.lowerFiles.has(".gitlab-ci.yml")) configurations.add("gitlab_ci");
  if (scanData.lowerFiles.has("jenkinsfile")) configurations.add("jenkins");
  if (scanData.lowerFiles.has("circle.yml")) configurations.add("circleci");

  return {
    frameworks: [...frameworks],
    languages: [...languages],
    configurations: [...configurations],
    packageJson: pkg,
  };
}

module.exports = {
  detectFrameworks,
};
