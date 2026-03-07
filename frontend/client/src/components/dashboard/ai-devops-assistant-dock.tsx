import { AnimatePresence, motion } from "framer-motion";
import { Minimize2, SendHorizontal, Sparkles, X } from "lucide-react";
import * as React from "react";
import { useWorkspace } from "@/context/workspace-context";
import { apiRequest } from "@/lib/queryClient";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: number;
  role: ChatRole;
  content: string;
};

const getAssistantFallbackReply = (prompt: string) => {
  const text = prompt.toLowerCase();

  if (text.includes("deployment") && text.includes("fail")) {
    return "Prediction detected high memory growth in Payment Service. Recommended action: increase container memory and add autoscaling.";
  }

  if (text.includes("highest risk") || text.includes("highest-risk")) {
    return "Payment Service has the highest risk score right now due to memory saturation during traffic spikes.";
  }

  if (text.includes("cost") || text.includes("cloud")) {
    return "To reduce cloud cost, rightsize underutilized workers, shift batch jobs to spot nodes, and enable autoscaling cooldown tuning.";
  }

  if (text.includes("pipeline") || text.includes("bottleneck")) {
    return "Pipeline bottleneck is in the test stage. Cache misses are increasing execution time and delaying deployment readiness.";
  }

  return "I can help with failure prediction, risk hotspots, cost optimization, and pipeline bottlenecks. Ask me about any service or metric.";
};

export function AiDevopsAssistantDock() {
  const { selectedRepo } = useWorkspace();
  const [dockInput, setDockInput] = React.useState("");
  const [popupInput, setPopupInput] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isPopupOpen, setIsPopupOpen] = React.useState(false);
  const [isTyping, setIsTyping] = React.useState(false);

  const messageCounter = React.useRef(0);
  const typingTimeout = React.useRef<number | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  const appendMessage = React.useCallback((role: ChatRole, content: string) => {
    messageCounter.current += 1;
    setMessages((prev) => [
      ...prev,
      { id: messageCounter.current, role, content },
    ]);
  }, []);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  React.useEffect(() => {
    return () => {
      if (typingTimeout.current) {
        window.clearTimeout(typingTimeout.current);
      }
    };
  }, []);

  const sendPrompt = React.useCallback(
    (rawPrompt: string) => {
      const prompt = rawPrompt.trim();
      if (!prompt) return;

      appendMessage("user", prompt);
      setDockInput("");
      setPopupInput("");
      setIsPopupOpen(true);
      setIsTyping(true);

      if (typingTimeout.current) {
        window.clearTimeout(typingTimeout.current);
      }

      typingTimeout.current = window.setTimeout(() => {
        (async () => {
          try {
            const response = await apiRequest("POST", "/api/ai/chat", {
              message: prompt,
              ...(selectedRepo?.id ? { repositoryId: selectedRepo.id } : {}),
            });
            const payload = (await response.json()) as { reply?: string };
            appendMessage(
              "assistant",
              payload.reply?.trim() || getAssistantFallbackReply(prompt),
            );
          } catch {
            appendMessage("assistant", getAssistantFallbackReply(prompt));
          } finally {
            setIsTyping(false);
          }
        })();
      }, 550);
    },
    [appendMessage, selectedRepo?.id],
  );

  const closePopup = () => {
    setIsPopupOpen(false);
    setIsTyping(false);
    setMessages([]);
    setDockInput("");
    setPopupInput("");

    if (typingTimeout.current) {
      window.clearTimeout(typingTimeout.current);
      typingTimeout.current = null;
    }
  };

  return (
    <>
      <AnimatePresence>
        {isPopupOpen ? (
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="fixed bottom-[92px] left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex h-[min(500px,calc(100vh-180px))] w-[min(700px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-slate-900">
                    Infrabox AI DevOps Assistant
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                    onClick={() => setIsPopupOpen(false)}
                    type="button"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                    onClick={closePopup}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/50 p-5">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                        message.role === "user"
                          ? "bg-primary text-white"
                          : "border border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {message.content}
                    </div>
                  </motion.div>
                ))}

                {isTyping ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2"
                  >
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.25s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.12s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                  </motion.div>
                ) : null}

                <div ref={messagesEndRef} />
              </div>

              <form
                className="border-t border-slate-200 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendPrompt(popupInput);
                }}
              >
                <div className="flex items-center gap-3 rounded-full border border-white/60 bg-white px-4 py-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <input
                    value={popupInput}
                    onChange={(event) => setPopupInput(event.target.value)}
                    placeholder="Ask Infrabox AI about your infrastructure..."
                    className="h-9 flex-1 border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                  <button
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary/90"
                    type="submit"
                  >
                    <SendHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
        <form
          className="pointer-events-auto flex w-[min(600px,calc(100vw-2rem))] items-center gap-3 rounded-full border border-white/60 bg-white/85 px-4 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur-xl"
          onSubmit={(event) => {
            event.preventDefault();
            sendPrompt(dockInput);
          }}
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <input
            value={dockInput}
            onChange={(event) => setDockInput(event.target.value)}
            placeholder="Ask Infrabox AI about your infrastructure..."
            className="h-9 flex-1 border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary/90"
            type="submit"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </form>
      </div>
    </>
  );
}
