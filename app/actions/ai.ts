
"use server";

import { GoogleGenAI } from "@google/genai";
import { ASSET_DISTRIBUTION } from "@/constants";

const apiKey = process.env.API_KEY;

export async function generateAiResponse(
    userMsg: string, 
    assetsSnapshot: any[], 
    images?: string[], 
    documents?: { name: string; content: string; type: string }[]
) {
    if (!apiKey || apiKey === "your_gemini_api_key_here") {
        throw new Error("AI is not configured. Set API_KEY in environment for Gemini assistant.");
    }

    try {
        const genAI = new GoogleGenAI({ apiKey });

        const context = `
            You are an AI assistant for the QET (Quantum Edge Technologies) Asset Management System.
            Current System Data Snapshot:
            - Total Assets in view: ${assetsSnapshot.length} items.
            - Sample Assets: ${assetsSnapshot.slice(0, 10).map(a => a.name).join(', ')}.
            - Categories: ${ASSET_DISTRIBUTION.map(d => `${d.name} (${d.value}%)`).join(', ')}.
            
            Answer professionally and concisely. If asked to draft a policy or letter, use formal Nigerian enterprise tone.
        `;

        // Build multimodal content - Gemini API expects an array of parts
        const parts: any[] = [
            context + "\n\nUser Query: " + (userMsg || 'Please analyze the provided content.')
        ];

        // Add images if provided
        if (images && images.length > 0) {
            for (const imageDataUrl of images) {
                // Extract base64 data and mime type from data URL
                const matches = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
                if (matches) {
                    const mimeType = matches[1];
                    const base64Data = matches[2];
                    parts.push({
                        inlineData: {
                            data: base64Data,
                            mimeType: mimeType
                        }
                    });
                }
            }
        }

        // Add document content if provided
        if (documents && documents.length > 0) {
            let docText = '\n\nDocuments provided:\n';
            for (const doc of documents) {
                if (doc.type === 'application/pdf') {
                    docText += `\nPDF Document: ${doc.name}\n[PDF content - please analyze the document structure and extract relevant information]\n`;
                } else {
                    // For text documents, include the content
                    docText += `\nDocument: ${doc.name}\nContent:\n${doc.content}\n`;
                }
            }
            parts.push(docText);
        }

        const result = await genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: parts,
        });
        
        // @google/genai: result.text is the convenience accessor
        if (result.text) {
            return result.text;
        }
        // Fallback: extract from candidates[0].content.parts
        const res = result as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
        console.log("Response structure:", JSON.stringify(result, null, 2));
        return "I received a response but couldn't parse it properly. Please check server logs.";
    } catch (error: any) {
        console.error("AI Generation Error:", error);
        console.error("Error details:", {
            message: error?.message,
            code: error?.code,
            status: error?.status,
            statusCode: error?.statusCode,
            response: error?.response,
            stack: error?.stack
        });
        
        // Provide more helpful error messages
        if (error?.message?.includes('API key')) {
            throw new Error("Invalid API key. Please check your API_KEY in the .env file.");
        }
        if (error?.status === 401 || error?.statusCode === 401) {
            throw new Error("Authentication failed. Please check your API key.");
        }
        if (error?.status === 429 || error?.statusCode === 429) {
            throw new Error("Rate limit exceeded. Please try again later.");
        }
        
        throw new Error(`Failed to generate AI response: ${error?.message || 'Unknown error'}`);
    }
}
