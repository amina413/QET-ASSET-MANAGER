import { NextRequest } from 'next/server';
import { ok, err, handleError } from '@/lib/api';
import { requirePermission } from '@/lib/auth-helpers';
import { checkRateLimit } from '@/lib/rate-limit';
import { AiQuerySchema } from '@/lib/validation';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission('view_all_reports');
    if (error) return error;

    // Check API key before consuming rate-limit quota
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return err('AI assistant is not configured. Set GEMINI_API_KEY in your environment.', 503);
    }

    const quota = await checkRateLimit({
      key: `ai:${user.id}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!quota.allowed) {
      return new Response(JSON.stringify({ success: false, error: 'AI assistant quota exceeded. Please try again later.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
      });
    }

    const body = await req.json();
    const { message, assetsSnapshot, images, documents } = AiQuerySchema.parse(body);

    const genAI = new GoogleGenAI({ apiKey });

    // System context is kept in systemInstruction, separate from user input,
    // to prevent prompt injection via the message or document fields.
    const systemInstruction = `You are an AI assistant for the QET Asset Management System.
Total assets in system: ${assetsSnapshot.length}.
Sample assets: ${assetsSnapshot.slice(0, 10).map((a: { name?: string }) => a.name).join(', ')}.
Answer professionally. Use formal Nigerian enterprise tone for policy/letter drafts.`;

    const userParts: unknown[] = [{ text: message }];

    if (images?.length) {
      for (const img of images) {
        // Format validated by AiQuerySchema (whitelist: jpeg/png/gif/webp)
        const match = img.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          userParts.push({ inlineData: { data: match[2], mimeType: match[1] } });
        }
      }
    }

    if (documents?.length) {
      let docText = '\n\nAttached documents:\n';
      for (const doc of documents) {
        docText += `\nDocument: ${doc.name}\n${doc.content.slice(0, 10000)}\n`;
      }
      userParts.push({ text: docText });
    }

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: userParts }] as Parameters<typeof genAI.models.generateContent>[0]['contents'],
      config: { systemInstruction },
    });

    const text = result.text ?? (result as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return err('No response generated', 500);

    return ok({ text });
  } catch (error) {
    return handleError(error);
  }
}
