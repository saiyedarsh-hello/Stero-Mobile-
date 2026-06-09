self.onmessage = async (e) => {
  const { url } = e.data;
  if (!url) {
    self.postMessage({ error: 'No URL provided' });
    return;
  }
  
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, 1, 1);
    const imageData = ctx.getImageData(0, 0, 1, 1).data;
    
    const r = imageData[0];
    const g = imageData[1];
    const b = imageData[2];

    let rNorm = r / 255;
    let gNorm = g / 255;
    let bNorm = b / 255;
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
        case gNorm: h = (bNorm - rNorm) / d + 2; break;
        case bNorm: h = (rNorm - gNorm) / d + 4; break;
      }
      h /= 6;
    }

    const hDeg = Math.round(h * 360);
    const sPct = Math.round(s * 100);

    const lPct = Math.max(5, Math.min(25, Math.round(l * 100)));
    const sFinal = sPct < 8 ? 0 : Math.max(30, sPct);

    self.postMessage({ h: hDeg, s: sFinal, l: lPct });
  } catch (err) {
    self.postMessage({ error: err.message });
  }
};
