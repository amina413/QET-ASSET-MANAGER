
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, Loader2, Mic, MicOff, Image as ImageIcon, FileText, Volume2, VolumeX } from 'lucide-react';
import { generateAiResponse } from '../app/actions/ai';
import { ASSET_DISTRIBUTION } from '../constants';
import { Asset } from '../types';

interface Message {
  role: 'user' | 'model';
  text: string;
  images?: string[]; // base64 image data URLs
  documents?: { name: string; content: string; type: string }[];
  audioUrl?: string; // for voice messages
}

interface GeminiAssistantProps {
  assets?: Asset[];
}

const GeminiAssistant: React.FC<GeminiAssistantProps> = ({ assets = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I am your QET Asset Assistant. Ask me about asset values, disposal policies, or drafting reports. You can also upload images, documents, or use voice input.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [attachedDocuments, setAttachedDocuments] = useState<{ name: string; content: string; type: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
        setIsRecording(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        alert('Speech recognition error. Please try again.');
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }

    // Initialize text-to-speech
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() && attachedImages.length === 0 && attachedDocuments.length === 0) return;

    const userMsg = input;
    const userImages = [...attachedImages];
    const userDocs = [...attachedDocuments];
    
    setInput('');
    setAttachedImages([]);
    setAttachedDocuments([]);
    
    setMessages(prev => [...prev, { 
      role: 'user', 
      text: userMsg || (userImages.length > 0 ? 'Analyze this image' : 'Analyze this document'),
      images: userImages.length > 0 ? userImages : undefined,
      documents: userDocs.length > 0 ? userDocs : undefined
    }]);
    setIsLoading(true);

    try {
      const text = await generateAiResponse(userMsg, assets, userImages, userDocs);
      const newMessage: Message = { role: 'model', text: text || "I couldn't generate a response at this time." };
      setMessages(prev => [...prev, newMessage]);
      
      // Auto-play voice response if enabled
      if (isSpeaking && synthRef.current) {
        speakText(text);
      }
    } catch (error: any) {
      console.error("AI Error:", error);
      const errorMessage = error?.message || "Sorry, I encountered an error connecting to the AI service.";
      setMessages(prev => [...prev, { role: 'model', text: `Error: ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const speakText = (text: string) => {
    if (!synthRef.current) return;
    
    synthRef.current.cancel(); // Cancel any ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    setIsSpeaking(true);
    synthRef.current.speak(utterance);
  };

  const toggleVoiceOutput = () => {
    if (isSpeaking) {
      synthRef.current?.cancel();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      // Speak the last AI message
      const lastAiMessage = [...messages].reverse().find(m => m.role === 'model');
      if (lastAiMessage?.text) {
        speakText(lastAiMessage.text);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image file.`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} is too large. Maximum size is 10MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setAttachedImages(prev => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} is too large. Maximum size is 5MB.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        // Extract text from file
        let textContent = '';
        
        if (file.type === 'text/plain' || file.type.startsWith('text/')) {
          textContent = content.split(',')[1] ? atob(content.split(',')[1]) : '';
        } else if (file.type === 'application/pdf') {
          // For PDF, we'll send the base64 data and let the AI handle it
          textContent = content;
        } else {
          textContent = content;
        }

        setAttachedDocuments(prev => [...prev, {
          name: file.name,
          content: textContent,
          type: file.type
        }]);
      };

      if (file.type === 'application/pdf' || file.type.startsWith('text/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    }
    
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeDocument = (index: number) => {
    setAttachedDocuments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-qet-800 to-accent-500 text-white rounded-full shadow-lg hover:shadow-xl transition-transform hover:scale-105 z-50 flex items-center gap-2"
        >
          <Sparkles size={24} />
          <span className="font-semibold hidden md:inline">Ask AI Assistant</span>
        </button>
      )}

      {/* Chat Interface */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 flex flex-col animate-slideIn overflow-hidden font-sans">
          {/* Header */}
          <div className="bg-gradient-to-r from-qet-800 to-accent-500 p-4 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Sparkles size={18} />
              <h3 className="font-bold">QET AI Assistant</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user'
                  ? 'bg-qet-600 text-white rounded-tr-none'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-sm'
                  }`}>
                  {msg.text}
                  
                  {/* Display images */}
                  {msg.images && msg.images.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {msg.images.map((img, imgIdx) => (
                        <img key={imgIdx} src={img} alt={`Uploaded ${imgIdx + 1}`} className="max-w-full h-auto rounded mt-2" />
                      ))}
                    </div>
                  )}
                  
                  {/* Display documents */}
                  {msg.documents && msg.documents.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {msg.documents.map((doc, docIdx) => (
                        <div key={docIdx} className="text-xs opacity-80 flex items-center gap-1">
                          <FileText size={12} />
                          {doc.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-lg rounded-tl-none border border-slate-200 shadow-sm">
                  <Loader2 size={16} className="animate-spin text-qet-600" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Attached Files Preview */}
          {(attachedImages.length > 0 || attachedDocuments.length > 0) && (
            <div className="px-3 pt-2 pb-1 bg-slate-50 border-t border-slate-200">
              <div className="flex flex-wrap gap-2">
                {attachedImages.map((img, idx) => (
                  <div key={`img-${idx}`} className="relative">
                    <img src={img} alt={`Preview ${idx + 1}`} className="w-16 h-16 object-cover rounded border" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {attachedDocuments.map((doc, idx) => (
                  <div key={`doc-${idx}`} className="relative bg-white border rounded p-2 flex items-center gap-2 text-xs">
                    <FileText size={14} />
                    <span className="max-w-[100px] truncate">{doc.name}</span>
                    <button
                      onClick={() => removeDocument(idx)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-3 bg-white border-t border-slate-100">
            <div className="flex gap-2 mb-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                multiple
              />
              <input
                ref={documentInputRef}
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                onChange={handleDocumentUpload}
                className="hidden"
                multiple
              />
              
              <button
                onClick={() => imageInputRef.current?.click()}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Upload Image"
              >
                <ImageIcon size={18} />
              </button>
              <button
                onClick={() => documentInputRef.current?.click()}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Upload Document"
              >
                <FileText size={18} />
              </button>
              <button
                onClick={toggleRecording}
                className={`p-2 rounded-lg transition-colors ${
                  isRecording 
                    ? 'bg-red-500 text-white hover:bg-red-600' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title={isRecording ? 'Stop Recording' : 'Voice Input'}
              >
                {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button
                onClick={toggleVoiceOutput}
                className={`p-2 rounded-lg transition-colors ${
                  isSpeaking 
                    ? 'bg-qet-600 text-white hover:bg-qet-700' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title={isSpeaking ? 'Stop Voice Output' : 'Enable Voice Output'}
              >
                {isSpeaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Ask about assets, reports..."
                className="flex-1 px-4 py-2 bg-slate-100 rounded-full text-sm outline-none focus:ring-2 focus:ring-qet-500"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && attachedImages.length === 0 && attachedDocuments.length === 0)}
                className="p-2 bg-qet-600 text-white rounded-full hover:bg-qet-700 disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GeminiAssistant;
