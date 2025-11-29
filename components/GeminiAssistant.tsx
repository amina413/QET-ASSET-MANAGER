
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { MessageSquare, X, Send, Sparkles, Loader2 } from 'lucide-react';
import { MOCK_ASSETS, ASSET_DISTRIBUTION } from '../constants';

interface Message {
  role: 'user' | 'model';
  text: string;
}

const GeminiAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I am your PTDF Asset Assistant. Ask me about asset values, disposal policies, or drafting reports.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !process.env.API_KEY) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Contextual data to help the AI be specific
      const context = `
        You are an AI assistant for the PTDF (Petroleum Technology Development Fund) Asset Management System.
        Current System Data Snapshot:
        - Total Assets in view: ${MOCK_ASSETS.length} items.
        - Sample Assets: ${MOCK_ASSETS.map(a => a.name).join(', ')}.
        - Categories: ${ASSET_DISTRIBUTION.map(d => `${d.name} (${d.value}%)`).join(', ')}.
        
        Answer professionally and concisely. If asked to draft a policy or letter, use formal Nigerian enterprise tone.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { role: 'user', parts: [{ text: context + "\n\nUser Query: " + userMsg }] }
        ]
      });

      const text = response.text || "I couldn't generate a response at this time.";
      setMessages(prev => [...prev, { role: 'model', text }]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error connecting to the AI service." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-ptdf-800 to-accent-500 text-white rounded-full shadow-lg hover:shadow-xl transition-transform hover:scale-105 z-50 flex items-center gap-2"
        >
          <Sparkles size={24} />
          <span className="font-semibold hidden md:inline">Ask AI Assistant</span>
        </button>
      )}

      {/* Chat Interface */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 flex flex-col animate-slideIn overflow-hidden font-sans">
          {/* Header */}
          <div className="bg-gradient-to-r from-ptdf-800 to-accent-500 p-4 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Sparkles size={18} />
              <h3 className="font-bold">PTDF AI Assistant</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
                  msg.role === 'user' 
                  ? 'bg-ptdf-600 text-white rounded-tr-none' 
                  : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
               <div className="flex justify-start">
                 <div className="bg-white p-3 rounded-lg rounded-tl-none border border-slate-200 shadow-sm">
                   <Loader2 size={16} className="animate-spin text-ptdf-600" />
                 </div>
               </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about assets, reports..." 
              className="flex-1 px-4 py-2 bg-slate-100 rounded-full text-sm outline-none focus:ring-2 focus:ring-ptdf-500"
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !input}
              className="p-2 bg-ptdf-600 text-white rounded-full hover:bg-ptdf-700 disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default GeminiAssistant;
