
"use client";

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Sparkles } from 'lucide-react';
import { Asset } from '@/shared/types';

const GeminiAssistantPanel = dynamic(() => import('./GeminiAssistant'), { ssr: false });

interface GeminiAssistantLauncherProps {
  assets?: Asset[];
  canUseAI?: boolean;
}

const GeminiAssistantLauncher: React.FC<GeminiAssistantLauncherProps> = ({ assets = [], canUseAI = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const handleOpen = () => {
    setHasMounted(true);
    setIsOpen(true);
  };

  if (!canUseAI) return null;

  return (
    <>
      {!isOpen && (
        <button
          onClick={handleOpen}
          aria-label="Open AI assistant"
          className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-qet-800 to-accent-500 text-white rounded-full shadow-lg hover:shadow-xl transition-transform hover:scale-105 z-50 flex items-center gap-2"
        >
          <Sparkles size={24} />
          <span className="font-semibold hidden md:inline">Ask AI Assistant</span>
        </button>
      )}
      {/* Mounted lazily on first open; stays mounted afterwards so message history survives minimizing. */}
      {hasMounted && (
        <GeminiAssistantPanel assets={assets} isOpen={isOpen} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
};

export default GeminiAssistantLauncher;
