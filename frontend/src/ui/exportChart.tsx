// Exportiert SVG- oder Canvas-basierte Charts als PNG/SVG – ohne externe Libraries.
export type PngExportOptions = {
  width?: number;      // z. B. 1920
  height?: number;     // z. B. 1080
  background?: string; // z. B. "#ffffff"
  pixelRatio?: number; // z. B. 2 (Retina)
  filename?: string;   // z. B. "chart.png"
};

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;

  // Falls viewBox existiert: Breite/Höhe daraus setzen für korrektes Rasterisieren
  if (clone.hasAttribute('viewBox')) {
    const [, , w, h] = (clone.getAttribute('viewBox') ?? '0 0 0 0').split(/\s+/).map(Number);
    if (!clone.getAttribute('width'))  clone.setAttribute('width', String(w || 0));
    if (!clone.getAttribute('height')) clone.setAttribute('height', String(h || 0));
  }
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // Recharts nutzt oft CSS. Minimal: style inline lassen (wird von Browser auf img gerendert).
  return new XMLSerializer().serializeToString(clone);
}

export async function exportNodeAsPNG(node: HTMLElement, opts: PngExportOptions = {}) {
  const {
    width,
    height,
    background = '#ffffff',
    pixelRatio = 2,
    filename = 'chart.png',
  } = opts;

  // 1) Canvas-Fall (z. B. Chart.js)
  const canvas = node.querySelector('canvas') as HTMLCanvasElement | null;
  if (canvas) {
    const w = width ?? canvas.width;
    const h = height ?? canvas.height;

    const out = document.createElement('canvas');
    out.width = Math.round(w * pixelRatio);
    out.height = Math.round(h * pixelRatio);
    const ctx = out.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0, out.width, out.height);

    downloadDataUrl(out.toDataURL('image/png'), filename);
    return;
  }

  // 2) SVG-Fall (Recharts rendert SVG)
  const svg = node.querySelector('svg') as SVGSVGElement | null;
  if (!svg) throw new Error('Kein <svg> in der Chart-Node gefunden.');

  const svgText = serializeSvg(svg);
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const targetW = Math.round((width ?? img.naturalWidth) * pixelRatio);
      const targetH = Math.round((height ?? img.naturalHeight) * pixelRatio);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(img, 0, 0, targetW, targetH);

      downloadDataUrl(canvas.toDataURL('image/png'), filename);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.src = url;
  });
}

export function exportNodeAsSVG(node: HTMLElement, filename = 'chart.svg') {
  const svg = node.querySelector('svg') as SVGSVGElement | null;
  if (!svg) throw new Error('Kein <svg> in der Chart-Node gefunden.');
  const text = serializeSvg(svg);
  const blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyNodeAsPNGToClipboard(node: HTMLElement, opts: PngExportOptions = {}) {
  const { width, height, background = '#ffffff', pixelRatio = 2 } = opts;

  // Render identisch zu exportNodeAsPNG, aber schreibe ins Clipboard
  let canvasOut: HTMLCanvasElement | null = null;

  const canvas = node.querySelector('canvas') as HTMLCanvasElement | null;
  if (canvas) {
    const w = width ?? canvas.width;
    const h = height ?? canvas.height;
    const out = document.createElement('canvas');
    out.width = Math.round(w * pixelRatio);
    out.height = Math.round(h * pixelRatio);
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    canvasOut = out;
  } else {
    const svg = node.querySelector('svg') as SVGSVGElement | null;
    if (!svg) throw new Error('Kein Canvas/SVG gefunden.');
    const svgText = serializeSvg(svg);
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const targetW = Math.round((width ?? img.naturalWidth) * pixelRatio);
        const targetH = Math.round((height ?? img.naturalHeight) * pixelRatio);
        const out = document.createElement('canvas');
        out.width = targetW;
        out.height = targetH;
        const ctx = out.getContext('2d')!;
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        URL.revokeObjectURL(url);
        canvasOut = out;
        resolve();
      };
      img.src = url;
    });
  }

  if (!canvasOut) throw new Error('Canvas konnte nicht erzeugt werden.');
  const blob = await new Promise<Blob | null>((resolve) =>
    canvasOut!.toBlob((b) => resolve(b), 'image/png')
  );
  if (!blob) throw new Error('Clipboard-Blob fehlgeschlagen.');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
