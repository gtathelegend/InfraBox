import { Bot, SendHorizontal, User } from "lucide-react";
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RippleButton } from "@/components/ui/ripple-button";
import { useWorkspace } from "@/context/workspace-context";
import { apiRequest } from "@/lib/queryClient";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

export default function AssistantPage() {
  const { selectedRepo } = useWorkspace();
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      content:
        "Ask anything about deployment risks, pipeline bottlenecks, or cost anomalies.",
    },
  ]);
  const [input, setInput] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const sendMessage = async () => {
    const prompt = input.trim();
    if (!prompt || isSending) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: prompt,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const response = await apiRequest("POST", "/api/ai/chat", {
        message: prompt,
        ...(selectedRepo?.id ? { repositoryId: selectedRepo.id } : {}),
      });
      const payload = (await response.json()) as { reply?: string };
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: payload.reply?.trim() || "No response from assistant.",
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Unable to process this request right now.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">AI DevOps Assistant</h1>
        <p className="mt-1 text-sm text-slate-600">
          Context-aware responses for
          {selectedRepo ? ` ${selectedRepo.fullName}` : " the selected repository"}.
        </p>
      </div>

      <Card className="glass-card rounded-2xl">
        <CardHeader className="border-b border-slate-200/80">
          <CardTitle className="text-lg">Assistant Chat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </span>
                ) : null}
                <div
                  className={`max-w-[85%] rounded-2xl border p-4 text-sm ${
                    message.role === "assistant"
                      ? "border-slate-200 bg-white text-slate-700"
                      : "border-primary/20 bg-primary/10 text-slate-800"
                  }`}
                >
                  <p>{message.content}</p>
                </div>
                {message.role === "user" ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                    <User className="h-4 w-4" />
                  </span>
                ) : null}
              </div>
            ))}

            {isSending ? (
              <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.25s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.12s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
              </div>
            ) : null}

            <div ref={endRef} />
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Suggested prompts:{" "}
            <span className="font-medium text-slate-800">Why will deployment fail?</span> |{" "}
            <span className="font-medium text-slate-800">How can I reduce cloud costs?</span>
          </div>

          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <Input
              placeholder="Ask Infrabox assistant..."
              className="h-11"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <RippleButton
              type="submit"
              className="h-11 bg-primary text-white hover:bg-primary/90"
              disabled={isSending}
            >
              <SendHorizontal className="h-4 w-4" />
              Send
            </RippleButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
