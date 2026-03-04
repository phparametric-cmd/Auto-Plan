
import React, { useState, useEffect, useRef } from 'react';
import { Language } from '../types';
import { getTranslation } from '../services/i18n';

interface AssistantProps {
  step: number;
  isWelcome?: boolean;
  customMessage?: { title: string, text: string };
  lang: Language;
  onClose?: () => void;
}

const Assistant: React.FC<AssistantProps> = ({ step, isWelcome, customMessage, lang, onClose }) => {
  const t = getTranslation(lang);
  const [isAutoShowing, setIsAutoShowing] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [isBlurred, setIsBlurred] = useState(false);
  const [triggerTypewriter, setTriggerTypewriter] = useState(0);
  
  const visitedSteps = useRef<Set<number>>(new Set());

  const currentKey = isWelcome ? -1 : step;
  
  const current = customMessage 
    ? customMessage 
    : (isWelcome 
        ? { 
            title: t.semaHi, 
            text: t.semaWelcome 
          }
        : {
            title: t.sema,
            text: t.guidance[step] || t.guidance[0]
          }
      );

  useEffect(() => {
    let index = 0;
    setDisplayedText("");
    const fullText = current.text;
    const intervalId = setInterval(() => {
      setDisplayedText((prev) => fullText.slice(0, index + 1));
      index++;
      if (index >= fullText.length) {
        clearInterval(intervalId);
      }
    }, 25);
    return () => clearInterval(intervalId);
  }, [current.text, triggerTypewriter, customMessage]);

  useEffect(() => {
    const isFirstTime = !visitedSteps.current.has(currentKey);

    if (isFirstTime || customMessage) {
      setIsAutoShowing(true);
      setTriggerTypewriter(prev => prev + 1);
      setIsBlurred(true);
      
      if (!customMessage) {
        visitedSteps.current.add(currentKey);
      }
    } else {
      setIsAutoShowing(false);
      setIsBlurred(false);
    }
  }, [step, isWelcome, currentKey, customMessage]);

  useEffect(() => {
    const handleUserAction = () => {
      setIsBlurred(false);
      setIsAutoShowing(false);
    };

    if (isBlurred || isAutoShowing) {
      window.addEventListener('pointerdown', handleUserAction);
      window.addEventListener('keydown', handleUserAction);
    }

    return () => {
      window.removeEventListener('pointerdown', handleUserAction);
      window.removeEventListener('keydown', handleUserAction);
    };
  }, [isBlurred, isAutoShowing]);

  const handleAssistantClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsAutoShowing(true);
    setTriggerTypewriter(prev => prev + 1); 
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAutoShowing(false);
    setIsBlurred(false);
    if (onClose) onClose();
  };

  const characterUrl = "https://raw.githubusercontent.com/phparametric-cmd/ph/f2e0dc8491ee031bf035fabfa134af6caa2bb2c9/%D0%BF%D0%BE%D0%BC%D0%BE%D1%88%D0%BD%D0%B8%D0%BA%202%20.gif";

  return (
    <>
      <div 
        className={`fixed inset-0 z-[550] bg-slate-900/20 backdrop-blur-md transition-all duration-1000 pointer-events-none ${isBlurred ? 'opacity-100' : 'opacity-0'}`} 
      />

      <div className="hidden lg:flex fixed bottom-32 left-4 items-end gap-2 z-[600] pointer-events-none transition-all duration-500">
        <div 
          onClick={handleAssistantClick}
          className="relative w-56 h-56 flex-shrink-0 pointer-events-auto cursor-pointer hover:scale-105 active:scale-95 transition-transform"
        >
          <img src={characterUrl} alt="Sema" className="w-full h-full object-contain brightness-110 drop-shadow-2xl" />
        </div>
        <div className={`mb-20 max-w-[300px] transition-all duration-700 ${isAutoShowing ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
          <div className="bg-white/95 backdrop-blur-3xl p-6 rounded-[36px] rounded-bl-none border border-slate-100 shadow-2xl relative pointer-events-auto">
            <button 
              onClick={handleClose}
              className="absolute top-4 right-4 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-[#ff5f1f] transition-colors"
            >
              <i className="fas fa-times text-[10px]"></i>
            </button>
            <h4 className="text-[12px] font-black uppercase tracking-widest text-[#ff5f1f] mb-1">{current.title}</h4>
            <p className="text-[14px] font-bold text-slate-800 leading-relaxed pr-4">{displayedText}</p>
            <div className="absolute -bottom-2 left-0 w-6 h-6 bg-white border-l border-b border-slate-100 transform rotate-45" />
          </div>
        </div>
      </div>

      <div className={`lg:hidden fixed bottom-24 right-4 left-4 sm:left-auto sm:w-64 z-[650] pointer-events-none transition-all duration-500 ${isAutoShowing ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className={`bg-white/90 backdrop-blur-xl p-3 rounded-2xl border border-slate-200 shadow-xl flex items-start gap-3 relative transition-all ${isAutoShowing ? 'pointer-events-auto' : 'pointer-events-none'}`}>
          <button 
            onClick={handleClose}
            className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-[#ff5f1f] transition-colors"
          >
            <i className="fas fa-times text-[8px]"></i>
          </button>
          <div 
            onClick={handleAssistantClick}
            className="w-10 h-10 flex-shrink-0 pointer-events-auto active:scale-90 transition-transform"
          >
             <img src={characterUrl} className="w-full h-full object-contain" alt="Sema" />
          </div>
          <div className="flex-1 flex flex-col gap-0.5 pr-4">
            <h4 className="text-[9px] font-black uppercase tracking-widest text-[#ff5f1f]">{current.title}</h4>
            <p className="text-[11px] font-bold text-slate-800 leading-tight">{displayedText}</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Assistant;
