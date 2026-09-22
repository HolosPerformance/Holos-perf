import React, { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

// Wraps a chart in a relative container with a "zoom in" button (top-right).
// Clicking it opens the same chart, rendered larger, in a modal with a
// "zoom out" button (also top-right) to return to the normal view.
// `children` is a render-prop: (isZoomed, height) => ReactNode
// `headerExtra` (optional) renders next to the zoom button, e.g. a per-chart
// control such as the "statistiques avancées" toggle.
export default function ZoomableChartCard({ title, zoomedHeight = 500, headerExtra, children }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="relative">
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {headerExtra}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Agrandir le graphique"
            title="Agrandir"
            className="p-1.5 rounded-md bg-white/90 hover:bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
        {children(false)}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideCloseButton className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto p-6 pt-14">
          <DialogTitle className="sr-only">{title || 'Graphique agrandi'}</DialogTitle>
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            {headerExtra}
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
          {children(true, zoomedHeight)}
        </DialogContent>
      </Dialog>
    </>
  );
}
