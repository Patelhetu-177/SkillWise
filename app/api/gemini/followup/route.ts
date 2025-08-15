// app/api/gemini/followup/route.ts
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { question, answer, history, user } = body;

    const prompt = `You are a professional job interviewer. The candidate was asked:
"${question}"
They answered:
"${answer}"

Based on this answer, provide either:
- a short acknowledgement and a brief follow-up question if clarification is needed, OR
- a short positive acknowledgement and "Moving on" if the answer is sufficient.

Keep the reply <= 30 words. Output only the reply text, no extra commentary.`;

    const { text } = await generateText({
      model: google("gemini-2.0-flash-001"),
      prompt,
    });

    return new Response(JSON.stringify({ reply: text }), { status: 200 });
  } catch (err: any) {
    console.error("followup error:", err);
    return new Response(JSON.stringify({ error: err?.message || "error" }), { status: 500 });
  }
}
