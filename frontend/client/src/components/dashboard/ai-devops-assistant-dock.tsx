import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Minimize2, SendHorizontal, Sparkles, X } from "lucide-react";
import * as React from "react";

import { useWorkspace } from "@/context/workspace-context";
import { apiRequest } from "@/lib/queryClient";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: number;
  role: ChatRole;
  content: string;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionResultLike = {
  transcript: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
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

const toReadableTtsError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return "ElevenLabs unavailable. Using browser fallback voice.";
  }

  const raw = error.message ?? "";
  const match = raw.match(/\{[\s\S]*\}$/);
  if (!match) {
    return raw || "ElevenLabs unavailable. Using browser fallback voice.";
  }

  try {
    const parsed = JSON.parse(match[0]) as { message?: string };
    if (parsed.message && parsed.message.trim().length > 0) {
      return `ElevenLabs failed: ${parsed.message}`;
    }
  } catch {
    return raw;
  }

  return raw;
};

const pickBrowserFemaleVoice = (voices: SpeechSynthesisVoice[]) =>
  voices.find((voice) =>
    /female|woman|zira|samantha|aria|jenny|sonia|neural/i.test(
      `${voice.name} ${voice.voiceURI}`,
    ),
  ) ??
  voices.find((voice) => /^en/i.test(voice.lang)) ??
  null;

export function AiDevopsAssistantDock() {
  const { selectedRepo } = useWorkspace();
  const [dockInput, setDockInput] = React.useState("");
  const [popupInput, setPopupInput] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isPopupOpen, setIsPopupOpen] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [speechError, setSpeechError] = React.useState<string | null>(null);
  const [supportsSpeechInput, setSupportsSpeechInput] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);

  const messageCounter = React.useRef(0);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = React.useRef<string | null>(null);
  const activeInputRef = React.useRef<"dock" | "popup">("dock");

  const stopAudioPlayback = React.useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const appendMessage = React.useCallback((role: ChatRole, content: string) => {
    messageCounter.current += 1;
    setMessages((prev) => [...prev, { id: messageCounter.current, role, content }]);
  }, []);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const speak = React.useCallback(
    async (text: string) => {
      if (typeof window === "undefined") {
        return;
      }

      const cleanText = text.trim();
      if (!cleanText) {
        return;
      }

      stopAudioPlayback();
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      try {
        const response = await apiRequest("POST", "/api/ai/tts", { text: cleanText });
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audioUrlRef.current = audioUrl;
        audio.onended = () => {
          stopAudioPlayback();
        };
        await audio.play();
        return;
      } catch (error) {
        setSpeechError(toReadableTtsError(error));
        if (!("speechSynthesis" in window)) {
          return;
        }
        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = pickBrowserFemaleVoice(voices);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.lang = "en-US";
        window.speechSynthesis.speak(utterance);
      }
    },
    [stopAudioPlayback],
  );

  React.useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      stopAudioPlayback();
      recognitionRef.current?.stop();
    };
  }, [stopAudioPlayback]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const browserWindow = window as BrowserWithSpeech;
    const SpeechRecognition =
      browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupportsSpeechInput(false);
      return;
    }

    setSupportsSpeechInput(true);
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
      if (!transcript) {
        return;
      }
      setSpeechError(null);

      if (activeInputRef.current === "popup") {
        setPopupInput((prev) => `${prev} ${transcript}`.trim());
      } else {
        setDockInput((prev) => `${prev} ${transcript}`.trim());
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setSpeechError(
        event.error === "not-allowed"
          ? "Microphone permission denied."
          : "Speech recognition failed.",
      );
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.getVoices();
  }, []);

  const toggleListening = React.useCallback(
    (target: "dock" | "popup") => {
      if (!supportsSpeechInput || !recognitionRef.current) {
        setSpeechError("Speech-to-text is not supported in this browser.");
        return;
      }

      if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
        return;
      }

      activeInputRef.current = target;
      setSpeechError(null);
      setIsListening(true);

      try {
        recognitionRef.current.start();
      } catch {
        setIsListening(false);
        setSpeechError("Speech recognition is already active. Try again.");
      }
    },
    [isListening, supportsSpeechInput],
  );

  const sendPrompt = React.useCallback(
    (rawPrompt: string, source: "dock" | "popup") => {
      const prompt = rawPrompt.trim();
      if (!prompt || isSending) return;

      appendMessage("user", prompt);
      setSpeechError(null);
      setIsPopupOpen(true);
      setIsSending(true);

      if (source === "popup") {
        setPopupInput("");
      } else {
        setDockInput("");
      }

      (async () => {
        try {
          const response = await apiRequest("POST", "/api/ai/chat", {
            message: prompt,
            ...(selectedRepo?.id ? { repositoryId: selectedRepo.id } : {}),
          });
          const payload = (await response.json()) as { reply?: string };
          const reply = payload.reply?.trim() || getAssistantFallbackReply(prompt);
          appendMessage("assistant", reply);
          await speak(reply);
        } catch {
          const fallback = getAssistantFallbackReply(prompt);
          appendMessage("assistant", fallback);
          await speak(fallback);
        } finally {
          setIsSending(false);
        }
      })();
    },
    [appendMessage, isSending, selectedRepo?.id, speak],
  );

  const minimizePopup = () => {
    setIsPopupOpen(false);
  };

  const closePopup = () => {
    setIsPopupOpen(false);
    setPopupInput("");
    setMessages([]);
  };

  return (
    <>
      <AnimatePresence>
        {isPopupOpen ? (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4"
          >
            <div className="pointer-events-auto flex h-[min(320px,calc(100vh-7rem))] w-[min(430px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-slate-900">Infrabox AI Assistant</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                    onClick={minimizePopup}
                    type="button"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                    onClick={closePopup}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50/60 p-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-xl px-3 py-2 text-xs ${
                        message.role === "user"
                          ? "bg-primary text-white"
                          : "border border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {isSending ? (
                  <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.25s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.12s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                  </div>
                ) : null}

                {speechError ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">
                    {speechError}
                  </div>
                ) : null}

                <div ref={messagesEndRef} />
              </div>

              <form
                className="border-t border-slate-200 p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendPrompt(popupInput, "popup");
                }}
              >
                <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <input
                    value={popupInput}
                    onChange={(event) => setPopupInput(event.target.value)}
                    placeholder="Ask Infrabox AI..."
                    className="h-8 flex-1 border-none bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                  />
                  {supportsSpeechInput ? (
                    <button
                      className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                        isListening
                          ? "border-red-300 bg-red-50 text-red-600"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                      type="button"
                      onClick={() => toggleListening("popup")}
                      title="Voice input"
                    >
                      {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    </button>
                  ) : null}
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    type="submit"
                    disabled={isSending}
                  >
                    <SendHorizontal className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
        <div className="pointer-events-auto w-[min(460px,calc(100vw-2rem))] space-y-2">
          {!isPopupOpen && speechError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {speechError}
            </div>
          ) : null}
          <form
            className="flex items-center gap-3 rounded-full border border-white/60 bg-white/85 px-4 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur-xl"
            onSubmit={(event) => {
              event.preventDefault();
              sendPrompt(dockInput, "dock");
            }}
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <input
              value={dockInput}
              onChange={(event) => setDockInput(event.target.value)}
              placeholder="Ask Infrabox AI about your infrastructure..."
              className="h-9 flex-1 border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            {supportsSpeechInput ? (
              <button
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                  isListening
                    ? "border-red-300 bg-red-50 text-red-600"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                type="button"
                onClick={() => toggleListening("dock")}
                title="Voice input"
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            ) : null}
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isSending}
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
