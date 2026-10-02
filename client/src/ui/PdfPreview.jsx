import { useEffect, useRef, useState } from 'react';
import { Spinner } from './Bits';

const MAX_PAGES = 10;

// Renders a PDF (object URL) page by page with PDF.js, so previews work everywhere,
// including mobile browsers that can't show PDFs inline.
const PdfPreview = ({ url }) => {
  const ref = useRef(null);
  const [state, setState] = useState({ status: 'loading', pages: 0 });

  useEffect(() => {
    let cancelled = false;
    let doc;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        const container = ref.current;
        container.innerHTML = '';
        const width = Math.max(320, container.clientWidth - 24);
        const count = Math.min(doc.numPages, MAX_PAGES);
        for (let n = 1; n <= count && !cancelled; n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const ratio = window.devicePixelRatio || 1;
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width / ratio}px`;
          canvas.className = 'pdf-page';
          container.appendChild(canvas);
          await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
        }
        if (!cancelled) setState({ status: 'done', pages: doc.numPages });
      } catch (err) {
        if (!cancelled) setState({ status: 'error', pages: 0 });
      }
    })();
    return () => {
      cancelled = true;
      doc?.destroy();
    };
  }, [url]);

  return (
    <div className="pdf-preview">
      <div ref={ref} className="stack gap-12" style={{ alignItems: 'center' }} />
      {state.status === 'loading' && <div style={{ padding: 40 }}><Spinner size={24} /></div>}
      {state.status === 'error' && <p className="subtle" style={{ padding: 24 }}>Preview unavailable. Use Download to open the PDF.</p>}
      {state.status === 'done' && state.pages > MAX_PAGES && (
        <p className="subtle" style={{ fontSize: 12.5, padding: 8 }}>Showing the first {MAX_PAGES} of {state.pages} pages. Download to see the rest.</p>
      )}
    </div>
  );
};

export default PdfPreview;
