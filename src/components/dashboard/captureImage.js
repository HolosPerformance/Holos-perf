import html2canvas from 'html2canvas';

// Export d'un bloc du dashboard en image PNG (résolution ×2, fond blanc).
// Le bloc est rendu hors écran à largeur fixe (voir ZoomableChartCard et
// CaptureButton), puis ramené dans la zone visible de la copie capturée.

export const EXPORT_SCALE = 2;
// Largeur de fenêtre simulée pour la copie capturée : mise en page « ordinateur »
// (colonnes côte à côte) même depuis un téléphone
const CAPTURE_WINDOW_WIDTH = 1440;

export const slugify = (str) => (str || 'graphique')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'graphique';

// Dans la copie : tout le contenu est montré, sans barre de défilement.
// Listes défilantes déroulées, tableaux larges élargis, rangées horizontales
// défilantes passées à la ligne.
function expandScrollableContent(root) {
  root.querySelectorAll('*').forEach(el => {
    const cls = typeof el.className === 'string' ? el.className : '';
    if (/\bmax-h-/.test(cls)) el.style.maxHeight = 'none';
    if (/\boverflow-(x-|y-)?(auto|scroll)\b/.test(cls)) {
      el.style.overflow = 'visible';
      if (/\bflex\b/.test(cls) && !/\bflex-col\b/.test(cls)) el.style.flexWrap = 'wrap';
    }
  });
  // Un tableau plus large que la zone d'export élargit l'image
  if (root.scrollWidth > root.clientWidth) root.style.width = `${root.scrollWidth}px`;
}

// `element` : bloc rendu hors écran portant l'id `exportId`
export async function captureToPng(element, { exportId, fileName, expand = false }) {
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: EXPORT_SCALE,
    logging: false,
    windowWidth: Math.max(window.innerWidth, CAPTURE_WINDOW_WIDTH),
    // Boutons (capture, agrandir…) exclus de l'image
    ignoreElements: (el) => el.hasAttribute?.('data-capture-ignore'),
    // Dans la copie capturée, le bloc est ramené dans la zone visible
    onclone: (doc) => {
      const el = doc.getElementById(exportId);
      if (!el) return;
      el.style.left = '0px';
      el.style.top = '0px';
      if (expand) expandScrollableContent(el);
    },
  });
  const link = document.createElement('a');
  link.download = `${slugify(fileName)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
