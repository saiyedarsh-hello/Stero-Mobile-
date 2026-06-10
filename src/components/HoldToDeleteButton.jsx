import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

export default function HoldToDeleteButton({ onComplete }) {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timer;
    let interval;
    if (isHolding) {
      const startTime = Date.now();
      interval = setInterval(() => {
        const p = Math.min((Date.now() - startTime) / 1000 * 100, 100);
        setProgress(p);
      }, 16);
      
      timer = setTimeout(() => {
        setIsHolding(false);
        setProgress(0);
        onComplete();
      }, 1000);
    }

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [isHolding, onComplete]);

  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-8 h-8 group" title="Hold to delete">
      <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none z-0">
        {progress > 0 && (
          <circle
            cx="16"
            cy="16"
            r={radius}
            stroke="#f87171"
            strokeWidth="2"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-none drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]"
          />
        )}
      </svg>
      <button
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsHolding(true); setProgress(0); }}
        onMouseUp={(e) => { e.preventDefault(); e.stopPropagation(); setIsHolding(false); setProgress(0); }}
        onMouseLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsHolding(false); setProgress(0); }}
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg transition-all duration-300 border border-white/10 backdrop-blur-md z-10 ${
          isHolding 
            ? 'bg-red-500/40 text-white scale-100 border-red-500/50' 
            : 'bg-white/10 text-white/30 hover:bg-white/20 hover:text-red-400 scale-95'
        }`}
      >
        <Trash2 size={12} className={isHolding ? "animate-pulse text-red-200" : ""} />
      </button>
    </div>
  );
}
