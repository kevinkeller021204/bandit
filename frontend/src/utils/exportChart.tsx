export type PngExportOptions = {
  width?: number;
  height?: number;
  background?: string;
  pixelRatio?: number;
  filename?: string;
};

/**
* Trigger a download from a data URL by synthesizing an <a download> click.
*/
function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/**
* Serialize an <svg> node to a standalone SVG string.
* - Clones the node
* - Ensures width/height are set (derived from viewBox if necessary)
* - Adds xmlns to make the blob self-contained
*/
function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (clone.hasAttribute('viewBox')) {
    const [, , w, h] = (clone.getAttribute('viewBox') ?? '0 0 0 0').split(/\s+/).map(Number);
    if (!clone.getAttribute('width')) clone.setAttribute('width', String(w || 0));
    if (!clone.getAttribute('height')) clone.setAttribute('height', String(h || 0));
  }
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  return new XMLSerializer().serializeToString(clone);
}

/**
* Export the first <canvas> or <svg> inside `node` as a PNG.
*
* Canvas path:
* - Copies the canvas into a new canvas sized by width/height (or source size)
* - Applies pixelRatio and background
*
* SVG path:
* - Serializes the SVG to a blob URL
* - Draws it into a canvas, then downloads a PNG data URL
*
* Notes / Caveats
* - Cross-origin images inside canvas/SVG can taint the canvas and block toDataURL.
* - For SVG using external fonts, ensure fonts are loaded before exporting.
*/
export async function exportNodeAsPNG(node: HTMLElement, opts: PngExportOptions = {}) {
  const {
    width,
    height,
    background = '#ffffff',
    pixelRatio = 2,
    filename = 'chart.png',
  } = opts;

  // 1) Canvas branch: prefer a direct canvas if present
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

  // 2) SVG branch
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

/**
* Export the first <svg> inside `node` as a .svg file.
*/
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
