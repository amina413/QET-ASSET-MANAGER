import { NextRequest } from 'next/server';
import { ok, err, handleError } from '@/backend/lib/api';
import { requireAuth } from '@/backend/lib/auth-helpers';
import { AiQuerySchema } from '@/backend/lib/validation';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;

export async function POST(req: NextRequest) {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return err('AI assistant is not configured. Set GEMINI_API_KEY in your environment.', 503);
    }

    const body = await req.json();
    const { message, assetsSnapshot, images, documents } = AiQuerySchema.parse(body);

    const genAI = new GoogleGenAI({ apiKey });

    const context = `You are an AI assistant for the QET Asset Management System.
Total assets in system: ${assetsSnapshot.length}.
Sample assets: ${assetsSnapshot.slice(0, 10).map((a: { name?: string }) => a.name).join(', ')}.
Answer professionally. Use formal Nigerian enterprise tone for policy/letter drafts.`;

    const parts: unknown[] = [`${context}\n\nUser: ${message}`];

    if (images?.length) {
      for (const img of images) {
        const match = img.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          parts.push({ inlineData: { data: match[2], mimeType: match[1] } });
        }
      }
    }

    if (documents?.length) {
      let docText = '\n\nAttached documents:\n';
      for (const doc of documents) {
        docText += `\nDocument: ${doc.name}\n${doc.type === 'application/pdf' ? '[PDF - analyze structure]' : doc.content.slice(0, 10000)}\n`;
      }
      parts.push(docText);
    }

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: parts as Parameters<typeof genAI.models.generateContent>[0]['contents'],
    });

    const text = result.text ?? (result as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return err('No response generated', 500);

    return ok({ text });
  } catch (error) {
    return handleError(error);
  }
}
