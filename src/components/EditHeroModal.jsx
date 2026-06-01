import React, { useState } from 'react';
import { X, Image as ImageIcon, Check } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { HERO_BACKGROUNDS } from '../constants/heroBackgrounds';

export default function EditHeroModal({ onClose }) {
  const { appSettings, updateAppSetting } = usePlayerStore();
  
  const [title, setTitle] = useState(appSettings.dashboard_title || 'Lets Start a ride');
  const [coverPath, setCoverPath] = useState(appSettings.dashboard_cover_path || '');
  const [bgId, setBgId] = useState(appSettings.dashboard_bg_id || 'default');

  const handleSelectImage = async () => {
    if (!window.electron) return;
    const filePath = await window.electron.selectImageFile();
    if (filePath) {
      setCoverPath(filePath);
    }
  };

  const handleSave = async () => {
    await updateAppSetting('dashboard_title', title);
    await updateAppSetting('dashboard_cover_path', coverPath);
    await updateAppSetting('dashboard_bg_id', bgId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#141416] w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col scale-100 transition-transform">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <h2 className="text-lg font-bold text-white tracking-wide">Customize Dashboard Banner</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6">
          
          {/* Title Field */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Banner Title</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-white/30 focus:bg-white/10 transition-all shadow-inner"
              placeholder="e.g. Lets Start a ride"
            />
          </div>

          {/* Cover Image Field */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cover Image</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex-shrink-0 flex items-center justify-center overflow-hidden">
                {coverPath ? (
                  <img src={`media://${encodeURIComponent(coverPath)}`} alt="Cover Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={24} className="text-gray-500" />
                )}
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <button 
                  onClick={handleSelectImage}
                  className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors w-fit border border-white/5"
                >
                  Choose Image
                </button>
                {coverPath && (
                  <button 
                    onClick={() => setCoverPath('')}
                    className="text-xs text-red-400 hover:text-red-300 w-fit"
                  >
                    Remove Custom Cover
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Background Preset Field */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Background Style</label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              {HERO_BACKGROUNDS.map((bg) => (
                <div 
                  key={bg.id}
                  onClick={() => setBgId(bg.id)}
                  className={`relative cursor-pointer rounded-xl overflow-hidden h-16 transition-all ring-offset-2 ring-offset-[#141416] ${
                    bgId === bg.id ? 'ring-2 ring-white scale-[1.02]' : 'ring-1 ring-white/10 hover:ring-white/30'
                  }`}
                >
                  <div className={`absolute inset-0 ${bg.classes}`}></div>
                  {bg.showGlow && (
                    <>
                      <div className="absolute top-0 right-0 w-full h-full rounded-full bg-purple-500/30 blur-xl pointer-events-none" />
                      <div className="absolute bottom-0 left-0 w-full h-full rounded-full bg-cyan-500/20 blur-xl pointer-events-none" />
                    </>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                    <span className="text-xs font-bold text-white drop-shadow-md z-10">{bg.name}</span>
                  </div>
                  {bgId === bg.id && (
                    <div className="absolute top-1 right-1 bg-white rounded-full p-0.5 z-20 shadow-md">
                      <Check size={10} className="text-black" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3 bg-white/5">
          <button 
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 rounded-xl text-sm font-bold bg-white text-black hover:bg-gray-200 transition-colors shadow-lg active:scale-95"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
