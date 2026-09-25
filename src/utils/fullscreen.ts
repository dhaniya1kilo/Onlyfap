type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitDisplayingFullscreen?: boolean };
type WebkitDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type WebkitEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export function isFullscreen(): boolean {
  const d = document as WebkitDoc;
  return Boolean(document.fullscreenElement || d.webkitFullscreenElement);
}

/**
 * Toggle fullscreen for a container (keeps our overlay UI). Falls back to the
 * native video player on iOS Safari, which only supports video fullscreen.
 */
export async function toggleFullscreen(container: HTMLElement | null, video?: HTMLVideoElement | null): Promise<void> {
  const d = document as WebkitDoc;
  try {
    if (isFullscreen()) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else await d.webkitExitFullscreen?.();
      return;
    }
    const el = container as WebkitEl | null;
    if (el?.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el?.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else (video as WebkitVideo | null | undefined)?.webkitEnterFullscreen?.();
  } catch {
    (video as WebkitVideo | null | undefined)?.webkitEnterFullscreen?.();
  }
}
