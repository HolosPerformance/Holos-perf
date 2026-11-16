import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Loader2 } from 'lucide-react';
import { EXPORT_WIDTH_FULL, iconButtonClass } from './ZoomableChartCard';
import { captureToPng } from './captureImage';

const EXPORT_PADDING = 16;

// Bouton « appareil photo » exportant un bloc du dashboard (tableau, liste,
// panneau d'analyse…) en image PNG, comme les graphiques (voir
// ZoomableChartCard). Le bloc est rendu hors écran à largeur fixe
// (`exportWidth`), entièrement déroulé, avec son titre (`heading`) en tête :
// l'image est la même quel que soit l'écran utilisé.
// `render` : () => ReactNode, le contenu à capturer
export default function CaptureButton({ title, heading, render, exportWidth = EXPORT_WIDTH_FULL, className = '' }) {
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef(null);
  const exportId = useRef(`block-export-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (!exporting) return;
    let cancelled = false;
    // Laisse le temps au contenu hors écran de mesurer sa taille et de se dessiner
    const timer = setTimeout(async () => {
      try {
        await captureToPng(exportRef.current, { exportId, fileName: title, expand: true });
      } catch (err) {
        console.error('Erreur export image :', err);
      } finally {
        if (!cancelled) setExporting(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [exporting]);

  return (
    <>
      <button
        type="button"
        data-capture-ignore
        onClick={(e) => { e.stopPropagation(); setExporting(true); }}
        disabled={exporting}
        aria-label="Exporter en image"
        title="Exporter en image"
        className={`${iconButtonClass} ${className}`}
      >
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
      </button>

      {exporting && createPortal(
        <div
          id={exportId}
          ref={exportRef}
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: -exportWidth - 10000,
            top: 0,
            width: exportWidth,
            padding: EXPORT_PADDING,
            boxSizing: 'border-box',
            background: '#ffffff',
            pointerEvents: 'none',
          }}
        >
          {heading && <h3 className="font-semibold text-slate-800 text-lg mb-3">{heading}</h3>}
          {render()}
        </div>,
        document.body
      )}
    </>
  );
}
