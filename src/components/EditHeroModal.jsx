import { useState } from 'react';
import { X, Image as ImageIcon, Check } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';

export default function EditHeroModal({ onClose }) {
  const { appSettings, updateAppSetting } = usePlayerStore();
  
  const [title, setTitle] = useState(appSettings.dashboard_title || 'music');
  const [coverPath, setCoverPath] = useState(appSettings.dashboard_cover_path || '');

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
                  <img src={`media://local/?path=${encodeURIComponent(coverPath)}`} alt="Cover Preview" className="w-full h-full object-cover" />
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
