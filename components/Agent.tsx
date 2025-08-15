// components/Agent.tsx
"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createFeedback } from "@/lib/actions/general.action";

type SavedMessage = { role: "user" | "assistant"; content: string };

interface AgentProps {
  userName: string;
  userId?: string;
  profileImage?: string;
  email?: string;
  role?: string;
  interviewId?: string;
  feedbackId?: string;
  type: "generate" | "interview";
  questions?: string[];
}

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

export default function Agent({
  userName,
  userId,
  profileImage = "/user-avatar.png",
  email,
  role,
  interviewId,
  feedbackId,
  type,
  questions = [],
}: AgentProps) {
  const router = useRouter();

  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [lastMessage, setLastMessage] = useState("");

  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== "undefined" ? window.speechSynthesis : null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const latestMessagesRef = useRef<SavedMessage[]>([]);

  useEffect(() => {
    latestMessagesRef.current = messages;
    if (messages.length > 0) setLastMessage(messages[messages.length - 1].content);
  }, [messages]);

  // Prepare SpeechRecognition if available
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      recognitionRef.current = null;
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;
  }, []);

  const speak = (text: string) =>
    new Promise<void>((resolve) => {
      const synth = synthRef.current;
      if (!synth) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.onstart = () => setIsSpeaking(true);
      u.onend = () => {
        setIsSpeaking(false);
        resolve();
      };
      u.onerror = () => {
        setIsSpeaking(false);
        resolve();
      };
      synth.cancel();
      synth.speak(u);
    });

  const startRecognition = (timeoutMs = 20000) =>
    new Promise<string>((resolve, reject) => {
      const rec = recognitionRef.current;
      if (!rec) return reject(new Error("SpeechRecognition not supported"));

      let done = false;
      const onResult = (ev: any) => {
        if (done) return;
        done = true;
        try {
          const t = ev.results[0][0].transcript;
          cleanup();
          resolve(t);
        } catch (e) {
          cleanup();
          reject(e);
        }
      };
      const onError = (ev: any) => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error(ev?.error || "Recognition error"));
      };
      const onEnd = () => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error("No speech detected"));
      };

      function cleanup() {
        if (!rec) return; // Add this line to check if rec is null
        try {
          rec.removeEventListener("result", onResult);
          rec.removeEventListener("error", onError);
          rec.removeEventListener("end", onEnd);
        } catch {}
        try {
          rec.stop();
        } catch {}
        setListening(false);
      }

      rec.addEventListener("result", onResult);
      rec.addEventListener("error", onError);
      rec.addEventListener("end", onEnd);

      setListening(true);
      try {
        rec.start();
      } catch (e) {
        cleanup();
        return reject(e);
      }

      // timeout fallback
      setTimeout(() => {
        if (!done) {
          done = true;
          cleanup();
          reject(new Error("listening timed out"));
        }
      }, timeoutMs);
    });

  const askQuestionFlow = async (index: number) => {
    if (!questions || index >= questions.length) {
      // end of interview
      await speak("Thank you. The interview is complete. Ending now.");
      setCallStatus(CallStatus.FINISHED);
      return;
    }

    const q = questions[index];
    // push assistant question
    setMessages((prev) => [...prev, { role: "assistant", content: q }]);

    // speak the question and then listen
    await speak(q);

    // Try recognition, else fallback to text input
    let answer = "";
    try {
      answer = await startRecognition(20000);
    } catch (err) {
      // no STT: open prompt fallback to enter text manually
      // For simplicity, we prompt (you can replace with nicer UI)
      answer = window.prompt("Couldn't capture audio. Please type your answer:") || "";
    }

    if (!answer) {
      // if still no answer, we move on
      setMessages((prev) => [...prev, { role: "user", content: "[no answer]" }]);
    } else {
      setMessages((prev) => [...prev, { role: "user", content: answer }]);
    }

    // Send to server for a short follow-up / acknowledgement
    try {
      const res = await fetch("/api/gemini/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          answer,
          history: latestMessagesRef.current,
          user: { userName, userId, profileImage, email, role },
        }),
      });
      const data = await res.json();
      if (data?.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        await speak(data.reply);
      }
    } catch (err) {
      console.error("Followup error", err);
    }

    // move to next
    setCurrentQIndex((prev) => prev + 1);
    // small delay
    setTimeout(() => askQuestionFlow(index + 1), 700);
  };

  useEffect(() => {
    const saveFeedbackIfFinished = async () => {
      if (callStatus !== CallStatus.FINISHED) return;
      try {
        const payload = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const { success, feedbackId: id } = await createFeedback({
          interviewId: interviewId!,
          userId: userId!,
          transcript: payload,
          feedbackId,
        });

        if (success && id) {
          router.push(`/interview/${interviewId}/feedback`);
        } else {
          router.push("/");
        }
      } catch (e) {
        console.error("save feedback failed", e);
        router.push("/");
      }
    };

    saveFeedbackIfFinished();
  }, [callStatus]);

  const handleCall = async () => {
    setCallStatus(CallStatus.CONNECTING);

    // small delay to emulate connecting
    setTimeout(async () => {
      setCallStatus(CallStatus.ACTIVE);
      // greet
      await speak(`Hello ${userName}. Let's start the interview.`);
      // start asking questions if interview type
      if (type === "interview") {
        setCurrentQIndex(0);
        askQuestionFlow(0);
      } else {
        // generate mode - you might redirect to generation page or just greet
        await speak("Interview generation mode active.");
        setCallStatus(CallStatus.FINISHED);
      }
    }, 500);
  };

  const handleDisconnect = () => {
    setCallStatus(CallStatus.FINISHED);
    recognitionRef.current?.stop();
    synthRef.current?.cancel();
  };

  return (
    <>
      <div className="call-view">
        {/* AI Interviewer Card */}
        <div className="card-interviewer">
          <div className="avatar">
            <Image src="/ai-avatar.png" alt="profile-image" width={65} height={54} className="object-cover" />
            {isSpeaking && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>
        </div>

        {/* User Profile Card */}
        <div className="card-border">
          <div className="card-content">
            <Image src={profileImage} alt="profile-image" width={120} height={120} className="rounded-full object-cover" />
            <h3>{userName}</h3>
            <p className="text-sm text-muted">{email}</p>
            <p className="text-sm">{role}</p>
          </div>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript">
            <p key={lastMessage} className={cn("transition-opacity duration-500 opacity-0", "animate-fadeIn opacity-100")}>
              {lastMessage}
            </p>
          </div>
        </div>
      )}

      <div className="w-full flex justify-center">
        {callStatus !== CallStatus.ACTIVE ? (
          <button className="relative btn-call" onClick={handleCall}>
            <span className={cn("absolute animate-ping rounded-full opacity-75", callStatus !== CallStatus.CONNECTING && "hidden")} />
            <span className="relative">{callStatus === CallStatus.INACTIVE || callStatus === CallStatus.FINISHED ? "Call" : ". . ."}</span>
          </button>
        ) : (
          <button className="btn-disconnect" onClick={handleDisconnect}>End</button>
        )}
      </div>

      <div className="mt-4 text-center">
        {listening && <div className="text-yellow-500">Listening…</div>}
      </div>
    </>
  );
}
