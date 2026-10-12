import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, Camera, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import html2canvas from 'html2canvas';
import { useIsMobile } from '@/hooks/use-mobile';

// Format fixe des captures : 16:9 (diaporama), exporté en résolution ×2.
const EXPORT_WIDTH = 1600;
const EXPORT_HEIGHT = 900;
const EXPORT_PADDING = 16;
const EXPORT_SCALE = 2;
// Place prise par le titre du graphique dans la capture
const EXPORT_TITLE_HEIGHT = 44;
export const EXPORT_CHART_HEIGHT = EXPORT_HEIGHT - 2 * EXPORT_PADDING - EXPORT_TITLE_HEIGHT;
export const EXPORT_CHART_WIDTH = EXPORT_WIDTH - 2 * EXPORT_PADDING;

const slugify = (str) => (str || 'graphique')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'graphique';

const iconButtonClass = 'p-1.5 rounded-md bg-white/90 hover:bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-60';

// Wraps a chart in a relative container with a "zoom in" button (top-right).
// Clicking it opens the same chart, rendered larger, in a modal with a
// "zoom out" button (also top-right) to return to the normal view.
// A camera button exports the chart as a PNG of fixed size (16:9), rendered
// off-screen so the image is identical whatever the screen size.
// `children` is a render-prop: (isZoomed, height, exporting) => ReactNode
// `headerExtra` (optional) renders next to the zoom button, e.g. a per-chart
// control such as the "statistiques avancées" toggle.
export default function ZoomableChartCard({ title, zoomedHeight = 500, headerExtra, children }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef(null);
  const exportId = useRef(`chart-export-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (!exporting) return;
    let cancelled = false;
    // Laisse le temps au graphique hors écran de mesurer sa taille et de se dessiner
    const timer = setTimeout(async () => {
      try {
        const canvas = await html2canvas(exportRef.current, {
          backgroundColor: '#ffffff',
          scale: EXPORT_SCALE,
          width: EXPORT_WIDTH,
          height: EXPORT_HEIGHT,
          logging: false,
          // Dans la copie capturée, le graphique est ramené dans la zone visible
          onclone: (doc) => {
            const el = doc.getElementById(exportId);
            if (el) { el.style.left = '0px'; el.style.top = '0px'; }
          },
        });
        if (cancelled) return;
        const link = document.createElement('a');
        link.download = `${slugify(title)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        console.error('Erreur export graphique :', err);
      } finally {
        if (!cancelled) setExporting(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [exporting]);

  const exportButton = (
    <button
      type="button"
      onClick={() => setExporting(true)}
      disabled={exporting}
      aria-label="Exporter le graphique en image"
      title="Exporter en image (16:9)"
      className={iconButtonClass}
    >
      {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
    </button>
  );

  return (
    <>
      <div className="relative">
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {headerExtra}
          {exportButton}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Agrandir le graphique"
            title="Agrandir"
            className={iconButtonClass}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
        {children(false)}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideCloseButton className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto p-2 pt-14 sm:p-6 sm:pt-14">
          <DialogTitle className="sr-only">{title || 'Graphique agrandi'}</DialogTitle>
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            {headerExtra}
            {exportButton}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Réduire le graphique"
              title="Réduire"
              className="p-1.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 shadow-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
          {children(true, isMobile ? Math.min(zoomedHeight, Math.round(window.innerHeight * 0.7)) : zoomedHeight)}
        </DialogContent>
      </Dialog>

      {exporting && createPortal(
        <div
          id={exportId}
          ref={exportRef}
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: -EXPORT_WIDTH - 10000,
            top: 0,
            width: EXPORT_WIDTH,
            height: EXPORT_HEIGHT,
            padding: EXPORT_PADDING,
            boxSizing: 'border-box',
            background: '#ffffff',
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {children(true, EXPORT_CHART_HEIGHT, true)}
        </div>,
        document.body
      )}
    </>
  );
}
