import { useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useShallow } from 'zustand/react/shallow';
import { Globe, Check, Search } from 'lucide-react';
import { motion } from 'framer-motion';

const LANGUAGES = [
  { id: 'english', name: 'English', native: 'English' },
  { id: 'hindi', name: 'Hindi', native: 'हिंदी' },
  { id: 'spanish', name: 'Spanish', native: 'Español' },
  { id: 'korean', name: 'Korean', native: '한국어' },
  { id: 'japanese', name: 'Japanese', native: '日本語' },
  { id: 'french', name: 'French', native: 'Français' },
  { id: 'german', name: 'German', native: 'Deutsch' },
  { id: 'portuguese', name: 'Portuguese', native: 'Português' },
];

export default function LanguageModal({ onSelect }) {
  const { updateAppSetting } = usePlayerStore(useShallow(state => ({
    updateAppSetting: state.updateAppSetting
  })));
  const [selected, setSelected] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Allow matching against hardcoded list
  const filteredLanguages = LANGUAGES.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.native.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // If there's a search query and it doesn't exactly match any existing language, we show a custom option
  const exactMatch = LANGUAGES.find(l => l.name.toLowerCase() === searchQuery.toLowerCase());
  const showCustomOption = searchQuery.trim().length > 0 && !exactMatch;

  const handleSave = async () => {
    if (selected.length === 0) return;
    const joined = selected.join(',');
    await updateAppSetting('preferred_language', joined);
    onSelect(joined);
  };

  const toggleSelection = (lang) => {
    setSelected(prev => {
      if (prev.includes(lang)) return prev.filter(l => l !== lang);
      if (prev.length >= 3) return [...prev.slice(1), lang];
      return [...prev, lang];
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-[#141416]/50 backdrop-blur-3xl w-full max-w-md mx-4 max-h-[85vh] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
      >
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex flex-col items-center justify-center bg-white/5 relative overflow-hidden flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-3 z-10">
            <Globe size={20} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide z-10">Music Language</h2>
          <p className="text-xs text-gray-400 mt-1 z-10">Select up to 3 languages to discover music.</p>
        </div>

        {/* Content */}
        <div className="p-5 pt-4 flex-1 overflow-hidden flex flex-col">
          
          {/* Search Bar */}
          <div className="relative mb-4 flex-shrink-0">
            <Search 
              size={16} 
              className="absolute text-gray-400" 
              style={{ left: '1rem', top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}
            />
            <input 
              type="text"
              placeholder="Search language..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.75rem' }}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pr-4 text-sm text-white placeholder-gray-500 outline-none focus:bg-white/10 focus:border-white/30 transition-all shadow-inner relative"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-[150px]">
            <div className="grid grid-cols-2 gap-3">
            {filteredLanguages.map((lang) => (
              <button
                key={lang.id}
                onClick={() => toggleSelection(lang.id)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all duration-300 ${
                  selected.includes(lang.id)
                    ? 'bg-white/10 border-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
                    : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex flex-col items-start text-left min-w-0">
                  <span className={`text-sm font-bold truncate w-full ${selected.includes(lang.id) ? 'text-white' : 'text-gray-300'}`}>
                    {lang.name}
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium truncate w-full">
                    {lang.native}
                  </span>
                </div>
                {selected.includes(lang.id) && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-4 h-4 rounded-full bg-white flex items-center justify-center flex-shrink-0 ml-2"
                  >
                    <Check size={10} className="text-black" />
                  </motion.div>
                )}
              </button>
            ))}

            {showCustomOption && (
              <button
                onClick={() => toggleSelection(searchQuery.trim())}
                className={`col-span-2 flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-300 ${
                  selected.includes(searchQuery.trim())
                    ? 'bg-white/10 border-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
                    : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex flex-col items-start text-left">
                  <span className={`text-sm font-bold ${selected.includes(searchQuery.trim()) ? 'text-white' : 'text-gray-300'}`}>
                    Use "{searchQuery.trim()}"
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    Search YouTube for {searchQuery.trim()} music
                  </span>
                </div>
                {selected.includes(searchQuery.trim()) && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-5 h-5 rounded-full bg-white flex items-center justify-center"
                  >
                    <Check size={12} className="text-black" />
                  </motion.div>
                )}
              </button>
            )}

            {!showCustomOption && filteredLanguages.length === 0 && (
              <div className="col-span-2 text-center text-sm text-gray-500 py-4">No languages found.</div>
            )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between bg-white/5 flex-shrink-0">
          <span className="text-sm text-gray-400 font-medium ml-2">
            {selected.length} / 3 selected
          </span>
          <button 
            onClick={handleSave}
            disabled={selected.length === 0}
            className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
              selected.length > 0 
                ? 'bg-white text-black hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95' 
                : 'bg-white/10 text-gray-500 cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        </div>

      </motion.div>
    </div>
  );
}
