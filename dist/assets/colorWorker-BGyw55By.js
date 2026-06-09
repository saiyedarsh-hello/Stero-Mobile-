(function() {
	self.onmessage = async (b) => {
		const { url: i } = b.data;
		if (!i) {
			self.postMessage({ error: "No URL provided" });
			return;
		}
		try {
			const r = await (await fetch(i)).blob(), d = await createImageBitmap(r), l = new OffscreenCanvas(1, 1).getContext("2d");
			l.drawImage(d, 0, 0, 1, 1);
			const m = l.getImageData(0, 0, 1, 1).data, f = m[0], p = m[1], u = m[2];
			let s = f / 255, t = p / 255, a = u / 255;
			const e = Math.max(s, t, a), o = Math.min(s, t, a);
			let n = 0, g = 0, h = (e + o) / 2;
			if (e !== o) {
				const c = e - o;
				switch (g = h > .5 ? c / (2 - e - o) : c / (e + o), e) {
					case s:
						n = (t - a) / c + (t < a ? 6 : 0);
						break;
					case t:
						n = (a - s) / c + 2;
						break;
					case a:
						n = (s - t) / c + 4;
						break;
				}
				n /= 6;
			}
			const w = Math.round(n * 360), M = Math.round(g * 100), x = Math.max(5, Math.min(25, Math.round(h * 100))), N = M < 8 ? 0 : Math.max(30, M);
			self.postMessage({
				h: w,
				s: N,
				l: x
			});
		} catch (r) {
			self.postMessage({ error: r.message });
		}
	};
})();
