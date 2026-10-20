import type { Seat } from './types';

// Capture the current canvas and offer share/download; copy a deep link.
export async function shareView(canvas: HTMLCanvasElement, seat: Seat | null) {
  const url = new URL(location.href);
  if (seat) url.searchParams.set('seat', seat.id);

  await new Promise<void>((resolve) =>
    canvas.toBlob(async (blob) => {
      if (blob && navigator.share && 'canShare' in navigator) {
        const file = new File([blob], 'seat-view.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], url: url.toString(), title: 'My seat view' }); } catch { /* cancelled */ }
          return resolve();
        }
      }
      if (blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'seat-view.png';
        a.click();
        URL.revokeObjectURL(a.href);
      }
      try { await navigator.clipboard.writeText(url.toString()); } catch { /* ignore */ }
      resolve();
    }, 'image/png'),
  );
}
