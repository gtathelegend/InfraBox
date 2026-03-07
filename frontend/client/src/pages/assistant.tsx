import { Bot, SendHorizonal, User } from "lucide-react";
import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RippleButton } from "@/components/ui/ripple-button";
import { useChat } from "@/hooks/use-chat";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function AssistantPage() {
  const [text, setText] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const chat = useChat();

  const sendMessage = async () => {
    if (!text.trim() || chat.isPending) return;
    const userMessage = text.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setText("");

    try {
      const data = await chat.mutateAsync(userMessage);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I could not reach the assistant service. Please try again.",
        },
      ]);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">AI DevOps Assistant</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ask deployment, incident, or optimization questions in natural language.
        </p>
      </div>

      <Card className="glass-card rounded-2xl">
        <CardHeader className="border-b border-slate-200/80">
          <CardTitle className="text-lg">Assistant Chat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          {messages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              Ask a question to start the conversation.
            </div>
          ) : null}

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
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

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Suggested prompts:{" "}
            <span className="font-medium text-slate-800">
              Why will deployment fail?
            </span>{" "}
            |{" "}
            <span className="font-medium text-slate-800">
              How can I reduce cloud costs?
            </span>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Ask Infrabox assistant..."
              className="h-11"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void sendMessage();
              }}
            />
            <RippleButton
              className="h-11 bg-primary text-white hover:bg-primary/90"
              onClick={() => void sendMessage()}
              disabled={!text.trim() || chat.isPending}
            >
              <SendHorizonal className="h-4 w-4" />
              {chat.isPending ? "Sending..." : "Send"}
            </RippleButton>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
