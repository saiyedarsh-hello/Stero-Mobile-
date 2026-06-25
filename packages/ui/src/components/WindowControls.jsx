import { Minus, Square, X } from 'lucide-react';

export default function WindowControls() {
  const handleMinimize = () => window.electron?.minimize();
  const handleMaximize = () => window.electron?.maximize();
  const handleClose = () => window.electron?.close();

  return (
    <div className="absolute top-0 right-0 z-50 flex h-12 items-start justify-end pointer-events-auto" style={{ WebkitAppRegion: 'no-drag' }}>
      <button
        onClick={handleMinimize}
        className="flex h-full w-[46px] items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-colors"
      >
        <Minus size={16} />
      </button>
      <button
        onClick={handleMaximize}
        className="flex h-full w-[46px] items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-colors"
      >
        <Square size={13} />
      </button>
      <button
        onClick={handleClose}
        className="flex h-full w-[46px] items-center justify-center text-white/60 hover:bg-[#e81123] hover:text-white transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
