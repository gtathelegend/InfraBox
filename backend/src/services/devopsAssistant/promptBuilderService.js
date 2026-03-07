/* eslint-disable @typescript-eslint/no-require-imports */

const TEMPLATE_BY_INTENT = {
  deployment_failure: {
    focus: [
      "Identify the likely root cause of deployment failure",
      "Pinpoint services/components involved",
      "Recommend concrete mitigation steps",
    ],
    outputSections: ["Root Cause", "Evidence", "Recommended Actions", "Risk Level"],
  },
  pipeline_analysis: {
    focus: [
      "Identify slowest/failing pipeline stages",
      "Explain execution bottlenecks",
      "Recommend stage optimization actions",
    ],
    outputSections: ["Pipeline Findings", "Bottlenecks", "Recommended Actions", "Expected Impact"],
  },
  cost_optimization: {
    focus: [
      "Identify cost drivers and anomalies",
      "Highlight optimization opportunities",
      "Estimate impact of proposed changes",
    ],
    outputSections: ["Cost Drivers", "Optimization Opportunities", "Recommended Actions", "Savings Estimate"],
  },
  performance_issue: {
    focus: [
      "Identify performance bottlenecks",
      "Explain latency/resource spikes",
      "Recommend performance mitigation steps",
    ],
    outputSections: ["Performance Diagnosis", "Evidence", "Recommended Actions", "Operational Risk"],
  },
  general_devops_question: {
    focus: [
      "Provide practical DevOps guidance",
      "Tie recommendations to current system data",
      "Call out risk and tradeoffs",
    ],
    outputSections: ["Answer", "Supporting Evidence", "Recommended Actions", "Risk Notes"],
  },
};

function asJson(value) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch (_err) {
    return "{}";
  }
}

function buildPrompt({
  userQuestion,
  detectedIntent,
  contextSummary,
  keyMetrics,
  insightSummary,
  systemData,
} = {}) {
  const intent = detectedIntent || "general_devops_question";
  const template = TEMPLATE_BY_INTENT[intent] || TEMPLATE_BY_INTENT.general_devops_question;

  const focusList = template.focus.map((item, idx) => `${idx + 1}. ${item}`).join("\n");
  const sectionList = template.outputSections.map((item, idx) => `${idx + 1}. ${item}`).join("\n");

  const systemPrompt = [
    "You are DevOpsAssistant for Infrabox.",
    "Use only provided data where possible and avoid invented metrics.",
    "If evidence is incomplete, explicitly state assumptions.",
    "Keep recommendations actionable and prioritized.",
    "",
    `Intent: ${intent}`,
    "",
    "Focus:",
    focusList,
    "",
    "Context Summary:",
    contextSummary || "No context summary available.",
    "",
    "Key Metrics:",
    asJson(keyMetrics),
    "",
    "Insight Summary:",
    asJson(insightSummary),
    "",
    "System Data:",
    asJson(systemData),
    "",
    "Respond in the following sections:",
    sectionList,
    "",
    "For actions, provide numbered items like:",
    "1 increase container memory",
    "2 enable autoscaling",
    "3 optimize caching",
  ].join("\n");

  const userPrompt = [
    "User Question:",
    userQuestion || "No question provided.",
    "",
    "Please explain the cause (if applicable) and recommend mitigation steps.",
  ].join("\n");

  return { systemPrompt, userPrompt, template: template.outputSections };
}

function parseActionLines(answerText) {
  const lines = String(answerText || "").split(/\r?\n/);
  const actions = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const numbered = trimmed.match(/^(\d+)[\).\s-]+(.+)$/);
    if (numbered) {
      actions.push(numbered[2].trim());
      continue;
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet && /recommend|action|mitigat|optimiz|scale|fix/i.test(bullet[1])) {
      actions.push(bullet[1].trim());
    }
  }

  return [...new Set(actions)].slice(0, 8);
}

function parseSection(answerText, sectionNames) {
  const text = String(answerText || "");
  const sections = {};

  for (const name of sectionNames || []) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`${escaped}\\s*:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Za-z ]+\\s*:|$)`, "i");
    const match = text.match(regex);
    if (match && match[1]) {
      sections[name] = match[1].trim();
    }
  }

  return sections;
}

function inferRiskLevel(answerText) {
  const text = String(answerText || "").toLowerCase();
  if (/critical risk|very high risk|do not deploy/.test(text)) return "critical";
  if (/high risk|unsafe|major risk/.test(text)) return "high";
  if (/medium risk|moderate risk/.test(text)) return "medium";
  if (/low risk|safe to deploy|healthy/.test(text)) return "low";
  return "unknown";
}

function parseLLMResponse(answerText, templateSections = []) {
  const sections = parseSection(answerText, templateSections);
  const recommendedActions = parseActionLines(answerText);
  const riskLevel = inferRiskLevel(answerText);

  return {
    rawText: String(answerText || ""),
    sections,
    recommendedActions,
    riskLevel,
  };
}

module.exports = {
  buildPrompt,
  parseLLMResponse,
};
