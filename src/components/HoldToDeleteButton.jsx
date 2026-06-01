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
      <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none">
        {progress > 0 && (
          <circle
            cx="16"
            cy="16"
            r={radius}
            stroke="white"
            strokeWidth="2.5"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-none shadow-[0_0_8px_rgba(255,255,255,0.8)] drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
          />
        )}
      </svg>
      <button
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsHolding(true); setProgress(0); }}
        onMouseUp={(e) => { e.preventDefault(); e.stopPropagation(); setIsHolding(false); setProgress(0); }}
        onMouseLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsHolding(false); setProgress(0); }}
        className="text-white opacity-80 hover:opacity-100 hover:text-red-400 p-1.5 rounded-full transition-colors flex items-center justify-center z-10 hover:bg-white/10 active:scale-95"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
