/**
 * Capture a poster frame from a local video file in the browser (no server
 * processing needed). Returns null if the browser cannot decode the file.
 */
export async function captureVideoFrame(file: Blob, maxWidth = 720): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), 15000);
      video.onloadeddata = () => { clearTimeout(t); resolve(); };
      video.onerror = () => { clearTimeout(t); reject(new Error('decode')); };
    });
    const target = Math.min(1.5, (video.duration || 0) * 0.1);
    if (target > 0) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 5000);
        video.onseeked = () => { clearTimeout(t); resolve(); };
        video.currentTime = target;
      });
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, maxWidth / w);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8));
    if (blob && blob.type === 'image/webp') return blob;
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  } catch {
    return null;
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
