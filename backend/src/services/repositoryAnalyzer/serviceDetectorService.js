function hasDependency(dependencies, names) {
  const depNames = new Set(dependencies.map((item) => item.name.toLowerCase()));
  return names.some((name) => depNames.has(name.toLowerCase()));
}

function detectServices({ frameworks, dependencies, scanData }) {
  const services = new Set();

  if (frameworks.some((f) => ["next.js", "react"].includes(f.toLowerCase()))) {
    services.add("frontend");
  }

  if (
    frameworks.some((f) => ["node.js", "express", "nestjs", "python", "java", "spring boot"].includes(f.toLowerCase()))
  ) {
    services.add("backend");
  }

  if (
    hasDependency(dependencies, ["pg", "postgres", "postgresql", "psycopg2", "mysql", "mongodb", "mongoose", "spring-boot-starter-data-jpa"])
  ) {
    services.add("database");
  }

  if (hasDependency(dependencies, ["redis", "ioredis", "spring-boot-starter-data-redis"])) {
    services.add("cache");
  }

  const compose = scanData.dockerComposeRaw.toLowerCase();
  if (compose.includes("postgres")) services.add("database:postgresql");
  if (compose.includes("redis")) services.add("cache:redis");
  if (compose.includes("kafka")) services.add("messaging:kafka");
  if (compose.includes("rabbitmq")) services.add("messaging:rabbitmq");

  return [...services];
}

function buildSummary({ frameworks, services, dependencies }) {
  const frameworkSet = new Set(frameworks.map((item) => item.toLowerCase()));
  const serviceSet = new Set(services.map((item) => item.toLowerCase()));

  let frontend = "unknown";
  if (frameworkSet.has("next.js")) frontend = "Next.js";
  else if (frameworkSet.has("react")) frontend = "React";

  let backend = "unknown";
  if (frameworkSet.has("spring boot")) backend = "Java (Spring Boot)";
  else if (frameworkSet.has("java")) backend = "Java";
  else if (frameworkSet.has("express")) backend = "Node.js (Express)";
  else if (frameworkSet.has("nestjs")) backend = "Node.js (NestJS)";
  else if (frameworkSet.has("node.js")) backend = "Node.js";
  else if (frameworkSet.has("python")) backend = "Python";

  let database = "unknown";
  const depNames = new Set(dependencies.map((d) => d.name.toLowerCase()));
  if (serviceSet.has("database:postgresql") || depNames.has("pg") || depNames.has("psycopg2")) {
    database = "PostgreSQL";
  } else if (depNames.has("mongoose") || depNames.has("mongodb")) {
    database = "MongoDB";
  } else if (depNames.has("mysql")) {
    database = "MySQL";
  }

  let cache = "unknown";
  if (serviceSet.has("cache:redis") || depNames.has("redis") || depNames.has("ioredis")) {
    cache = "Redis";
  }

  return {
    frontend,
    backend,
    database,
    cache,
  };
}

module.exports = {
  detectServices,
  buildSummary,
};
