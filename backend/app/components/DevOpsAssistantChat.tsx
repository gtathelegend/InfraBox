"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";

type Role = "user" | "assistant";

type ParsedResponse = {
  sections?: Record<string, string>;
  recommendedActions?: string[];
  riskLevel?: string;
};

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  supportingData?: Record<string, unknown>;
  parsedResponse?: ParsedResponse;
};

type AssistantApiResponse = {
  answer: string;
  parsedResponse?: ParsedResponse;
  supportingData?: Record<string, unknown>;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

function buildApiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

async function getAccessToken(): Promise<string | null> {
  try {
    const tokenRes = await fetch("/auth/access-token", { cache: "no-store" });
    if (!tokenRes.ok) return null;

    const data = await tokenRes.json();
    return data?.token || data?.accessToken || null;
  } catch {
    return null;
  }
}

function flattenHistory(conversations: Array<{ messages?: Array<Record<string, unknown>> }>): ChatMessage[] {
  const out: ChatMessage[] = [];

  for (const conversation of conversations || []) {
    for (const rawMessage of conversation.messages || []) {
      const role = String(rawMessage.role || "") === "assistant" ? "assistant" : "user";
      const content = String(rawMessage.content || "");
      if (!content) continue;

      out.push({
        id: `${role}-${String(rawMessage.timestamp || Date.now())}-${Math.random()}`,
        role,
        content,
        createdAt: String(rawMessage.timestamp || new Date().toISOString()),
        supportingData: (rawMessage.supportingData || {}) as Record<string, unknown>,
      });
    }
  }

  return out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getInsights(supportingData?: Record<string, unknown>) {
  if (!supportingData) return [] as Array<{ label: string; value: string; level: "high" | "medium" | "low" }>;

  const insights: Array<{ label: string; value: string; level: "high" | "medium" | "low" }> = [];

  const infra = supportingData.infrastructureHealth as Record<string, unknown> | undefined;
  const components = infra?.components as Record<string, unknown> | undefined;

  const cpu = (components?.cpu as Record<string, unknown> | undefined)?.average;
  const mem = (components?.memory as Record<string, unknown> | undefined)?.average;
  const err = (components?.errorRate as Record<string, unknown> | undefined)?.average;

  const cpuNum = toNumber(cpu);
  const memNum = toNumber(mem);
  const errNum = toNumber(err);

  if (cpuNum !== null) {
    insights.push({
      label: "CPU Usage",
      value: `${cpuNum.toFixed(1)}%`,
      level: cpuNum >= 85 ? "high" : cpuNum >= 70 ? "medium" : "low",
    });
  }

  if (errNum !== null) {
    insights.push({
      label: "Error Rate",
      value: `${errNum.toFixed(2)}%`,
      level: errNum >= 5 ? "high" : errNum >= 1 ? "medium" : "low",
    });
  }

  if (memNum !== null) {
    insights.push({
      label: "Memory Usage",
      value: `${memNum.toFixed(1)}%`,
      level: memNum >= 85 ? "high" : memNum >= 70 ? "medium" : "low",
    });
  }

  const failure = supportingData.failureAnalysis as Record<string, unknown> | undefined;
  const failureSummary = failure?.summary as Record<string, unknown> | undefined;
  const failureProbability = toNumber(failureSummary?.averageFailureProbability);
  if (failureProbability !== null) {
    insights.push({
      label: "Failure Probability",
      value: `${failureProbability.toFixed(1)}%`,
      level: failureProbability >= 45 ? "high" : failureProbability >= 20 ? "medium" : "low",
    });
  }

  const cost = supportingData.costInsights as Record<string, unknown> | undefined;
  const costSummary = cost?.summary as Record<string, unknown> | undefined;
  const monthly = toNumber(costSummary?.averageMonthlyCost);
  if (monthly !== null) {
    insights.push({
      label: "Monthly Cost",
      value: `$${monthly.toFixed(0)}`,
      level: monthly >= 2000 ? "high" : monthly >= 800 ? "medium" : "low",
    });
  }

  return insights;
}

export default function DevOpsAssistantChat() {
  const { user, isLoading } = useUser();
  const [workspaceId, setWorkspaceId] = useState("ws_1");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages]
  );

  const insightItems = getInsights(latestAssistantMessage?.supportingData);

  async function loadHistory(targetWorkspaceId: string) {
    setIsLoadingHistory(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const res = await fetch(buildApiUrl(`/api/assistant/${targetWorkspaceId}/history`), {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load history (${res.status})`);
      }

      const payload = await res.json();
      const history = flattenHistory(payload?.conversations || []);
      setMessages(history);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load history";
      setError(message);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  useEffect(() => {
    if (!workspaceId) return;
    void loadHistory(workspaceId);
  }, [workspaceId]);

  async function streamAssistantMessage(messageId: string, fullText: string) {
    const safeText = String(fullText || "");
    const step = Math.max(3, Math.ceil(safeText.length / 90));

    for (let i = step; i <= safeText.length + step; i += step) {
      const slice = safeText.slice(0, Math.min(i, safeText.length));
      setMessages((prev) =>
        prev.map((item) => (item.id === messageId ? { ...item, content: slice } : item))
      );
      // Small delay to emulate streaming in chat UI
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || !workspaceId || isSending) return;

    const question = input.trim();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);
    setError(null);

    const assistantMessageId = `assistant-${Date.now()}-${Math.random()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const token = await getAccessToken();
      const res = await fetch(buildApiUrl("/api/assistant/query"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ workspaceId, query: question }),
      });

      if (!res.ok) {
        throw new Error(`Assistant request failed (${res.status})`);
      }

      const payload = (await res.json()) as AssistantApiResponse;
      const answer = payload.answer || "I could not find enough data to answer this question.";

      await streamAssistantMessage(assistantMessageId, answer);

      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantMessageId
            ? {
                ...item,
                content: answer,
                supportingData: payload.supportingData,
                parsedResponse: payload.parsedResponse,
              }
            : item
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Assistant request failed";
      setError(message);
      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantMessageId
            ? {
                ...item,
                content: `I could not complete this request: ${message}`,
              }
            : item
        )
      );
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-sm text-gray-300">Loading assistant...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
          <p className="text-gray-300 mb-5">You need to sign in to use the DevOps Assistant.</p>
          <a
            href="/auth/login"
            className="inline-flex px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 transition-colors"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090c12] text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">DevOps Assistant</h1>
            <p className="text-sm text-gray-300 mt-1">Ask about deployment failures, pipeline bottlenecks, costs, and performance risks.</p>
          </div>
          <a
            href="/dashboard"
            className="px-3 py-2 rounded-lg border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/10"
          >
            Back to Dashboard
          </a>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <section className="xl:col-span-2 rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-sm min-h-[70vh] flex flex-col">
            <div className="border-b border-white/10 p-4 sm:p-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <p className="text-sm text-gray-300">Assistant online</p>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="workspaceId" className="text-xs text-gray-400">
                  Workspace
                </label>
                <input
                  id="workspaceId"
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  className="h-9 w-36 rounded-lg border border-white/15 bg-[#0f1723] px-3 text-sm text-white outline-none focus:border-cyan-400/60"
                />
                <button
                  type="button"
                  onClick={() => void loadHistory(workspaceId)}
                  className="h-9 px-3 rounded-lg border border-white/20 bg-white/5 text-xs hover:bg-white/10"
                  disabled={isLoadingHistory}
                >
                  {isLoadingHistory ? "Loading" : "Refresh"}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {messages.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.03] p-4 text-sm text-gray-300">
                  Try: &quot;Why did deployment fail?&quot; or &quot;Which pipeline stage is the slowest?&quot;
                </div>
              )}

              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`max-w-[92%] rounded-2xl p-3.5 sm:p-4 ${
                    message.role === "user"
                      ? "ml-auto bg-cyan-600/20 border border-cyan-400/25"
                      : "mr-auto bg-slate-900/80 border border-white/10"
                  }`}
                >
                  <p className="text-xs uppercase tracking-wider text-gray-400 mb-1.5">
                    {message.role === "user" ? "You" : "Assistant"} · {formatTime(message.createdAt)}
                  </p>
                  <p className="text-sm leading-6 text-gray-100 whitespace-pre-wrap">{message.content || (isSending ? "..." : "")}</p>

                  {message.role === "assistant" && message.parsedResponse?.recommendedActions?.length ? (
                    <div className="mt-3 rounded-lg bg-white/5 border border-white/10 p-3">
                      <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">Recommended actions</p>
                      <ul className="space-y-1 text-sm text-cyan-200">
                        {message.parsedResponse.recommendedActions.slice(0, 4).map((action, index) => (
                          <li key={`${message.id}-action-${index}`}>{index + 1}. {action}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>

            <form onSubmit={onSubmit} className="border-t border-white/10 p-4 sm:p-5">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about deployments, latency, cost, or pipelines..."
                  className="flex-1 h-12 rounded-xl border border-white/15 bg-[#0f1723] px-4 text-sm text-white outline-none focus:border-cyan-400/60"
                />
                <button
                  type="submit"
                  disabled={isSending || !workspaceId || !input.trim()}
                  className="h-12 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800/60 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isSending ? "Sending" : "Send"}
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
            </form>
          </section>

          <aside className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#101625] to-[#0c111d] p-4 sm:p-5 h-fit xl:sticky xl:top-6">
            <h2 className="text-lg font-semibold">System Insights</h2>
            <p className="text-xs text-gray-400 mt-1 mb-4">Supporting infrastructure signals referenced by the assistant.</p>

            {insightItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/20 p-3 text-sm text-gray-400">
                Ask a question to load contextual insights.
              </div>
            ) : (
              <ul className="space-y-2.5">
                {insightItems.map((item) => (
                  <li
                    key={item.label}
                    className="rounded-lg border border-white/10 bg-white/[0.04] p-3 flex items-center justify-between gap-3"
                  >
                    <span className="text-sm text-gray-200">{item.label}</span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        item.level === "high"
                          ? "bg-rose-500/20 text-rose-300"
                          : item.level === "medium"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {item.value}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {latestAssistantMessage?.parsedResponse?.riskLevel ? (
              <div className="mt-4 rounded-lg border border-cyan-400/25 bg-cyan-500/10 p-3">
                <p className="text-xs uppercase tracking-wider text-cyan-200">Assistant risk level</p>
                <p className="text-sm text-cyan-100 mt-1">{latestAssistantMessage.parsedResponse.riskLevel}</p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
