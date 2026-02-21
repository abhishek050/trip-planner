import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function GET() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: "Say hello in one sentence.",
    });

    return Response.json({
      success: true,
      text: response.text,
    });
  } catch (err) {
    return Response.json({ success: false, error: err }, { status: 500 });
  }
}