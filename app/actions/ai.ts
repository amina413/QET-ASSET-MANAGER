
"use server";

import { GoogleGenAI } from "@google/genai";
import { ASSET_DISTRIBUTION } from "@/constants";

const apiKey = process.env.API_KEY;

export async function generateAiResponse(userMsg: string, assetsSnapshot: any[]) {
    if (!apiKey) {
        throw new Error("Missing API Key");
    }

    try {
        const genAI = new GoogleGenAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const context = `
            You are an AI assistant for the ABDC (Abdulkadeer and Co.) Asset Management System.
            Current System Data Snapshot:
            - Total Assets in view: ${assetsSnapshot.length} items.
            - Sample Assets: ${assetsSnapshot.slice(0, 10).map(a => a.name).join(', ')}.
            - Categories: ${ASSET_DISTRIBUTION.map(d => `${d.name} (${d.value}%)`).join(', ')}.
            
            Answer professionally and concisely. If asked to draft a policy or letter, use formal Nigerian enterprise tone.
        `;

        const result = await model.generateContent([context, "User Query: " + userMsg]);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("AI Generation Error:", error);
        throw new Error("Failed to generate AI response");
    }
}
