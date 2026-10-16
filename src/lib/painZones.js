// ─── Zones douloureuses (question « Zones douloureuses » des questionnaires) ───
//
// Réponse enregistrée : { [zoneId]: intensité 1-10 }, ex. { genou_d: 6 }.
// Chaque zone correspond à une localisation et un côté du module médical, pour
// pré-remplir une fiche blessure. Côté = côté de l'athlète : de face, sa
// gauche est à droite du schéma ; de dos, elle est à gauche.

export const PAIN_INTENSITY_DEFAULT = 5;
export const PAIN_INTENSITY_MAX = 10;

// Formes dans un repère 240 × 480 (une silhouette par vue). Les zones sont
// décrites pour le côté gauche du schéma ; l'autre côté est leur symétrique.
// `rot` : inclinaison de l'ellipse en degrés (bras écartés du corps).
const VIEW_W = 240;
const mirror = (shape) => ({ ...shape, cx: VIEW_W - shape.cx, rot: shape.rot ? -shape.rot : 0 });

// [base de l'id, localisation, libellé, forme côté gauche du schéma]
const FRONT_PAIRS = [
  ['epaule', 'epaule', 'Épaule', { cx: 75, cy: 111, rx: 13, ry: 14 }],
  ['bras', 'bras', 'Bras', { cx: 65, cy: 145, rx: 9, ry: 22, rot: 12 }],
  ['coude', 'coude', 'Coude', { cx: 59, cy: 173, rx: 9, ry: 9 }],
  ['avant_bras', 'avant_bras', 'Avant-bras', { cx: 52, cy: 204, rx: 8, ry: 20, rot: 14 }],
  ['poignet', 'poignet', 'Poignet', { cx: 46, cy: 233, rx: 7, ry: 6 }],
  ['main', 'main', 'Main', { cx: 40, cy: 258, rx: 10, ry: 17, rot: 12 }],
  ['aine', 'adducteurs', 'Aine / adducteurs', { cx: 107, cy: 232, rx: 11, ry: 9 }],
  ['quadriceps', 'quadriceps', 'Quadriceps', { cx: 96, cy: 270, rx: 15, ry: 32 }],
  ['genou', 'genou', 'Genou', { cx: 96, cy: 312, rx: 11, ry: 10 }],
  ['tibia', 'tibia', 'Tibia', { cx: 96, cy: 357, rx: 9, ry: 32 }],
  ['cheville', 'cheville', 'Cheville', { cx: 98, cy: 414, rx: 8, ry: 7 }],
  ['pied', 'pied', 'Pied', { cx: 97, cy: 442, rx: 12, ry: 12 }],
];
const BACK_PAIRS = [
  ['fessier', 'hanche', 'Fessier / hanche', { cx: 102, cy: 232, rx: 18, ry: 17 }],
  ['ischios', 'ischios', 'Ischio-jambiers', { cx: 96, cy: 276, rx: 14, ry: 30 }],
  ['mollet', 'mollet', 'Mollet', { cx: 95, cy: 352, rx: 12, ry: 30 }],
  ['achille', 'tendon_achille', "Tendon d'Achille", { cx: 99, cy: 408, rx: 5, ry: 11 }],
];

// De face, la gauche de l'athlète est à droite du schéma ; de dos, à gauche
function pairs(list, view) {
  const [leftSide, rightSide] = view === 'front' ? ['d', 'g'] : ['g', 'd'];
  const sideName = { g: 'gauche', d: 'droit' };
  return list.flatMap(([base, location, label, shape]) => [
    { id: `${base}_${leftSide}`, view, location, side: sideName[leftSide], label, shape },
    { id: `${base}_${rightSide}`, view, location, side: sideName[rightSide], label, shape: mirror(shape) },
  ]);
}

export const PAIN_ZONES = [
  // Devant
  { id: 'tete', view: 'front', location: 'tete', side: 'na', label: 'Tête', shape: { cx: 120, cy: 46, rx: 22, ry: 27 } },
  { id: 'thorax', view: 'front', location: 'thorax', side: 'na', label: 'Thorax / côtes', shape: { cx: 120, cy: 136, rx: 34, ry: 26 } },
  { id: 'abdomen', view: 'front', location: 'abdomen', side: 'na', label: 'Abdomen', shape: { cx: 120, cy: 188, rx: 30, ry: 24 } },
  ...pairs(FRONT_PAIRS, 'front'),
  // Derrière
  { id: 'nuque', view: 'back', location: 'cou', side: 'na', label: 'Nuque / cou', shape: { cx: 120, cy: 82, rx: 11, ry: 9 } },
  { id: 'haut_dos', view: 'back', location: 'dos', side: 'na', label: 'Haut du dos', shape: { cx: 120, cy: 136, rx: 36, ry: 28 } },
  { id: 'lombaires', view: 'back', location: 'dos', side: 'na', label: 'Lombaires', shape: { cx: 120, cy: 193, rx: 28, ry: 20 } },
  ...pairs(BACK_PAIRS, 'back'),
];

// Zones de l'ancien questionnaire de séance (training_logs.douleurs_zones, valeurs true)
const LEGACY_ZONES = {
  tete: { location: 'tete', side: 'na', label: 'Tête' },
  cou: { location: 'cou', side: 'na', label: 'Cou' },
  torse_haut: { location: 'thorax', side: 'na', label: 'Thorax' },
  torse_bas: { location: 'abdomen', side: 'na', label: 'Abdomen' },
  hanche: { location: 'hanche', side: 'na', label: 'Hanche' },
};
const LEGACY_SIDED = {
  epaule: ['epaule', 'Épaule'], bras: ['bras', 'Bras'], coude: ['coude', 'Coude'],
  avant_bras: ['avant_bras', 'Avant-bras'], poignet: ['poignet', 'Poignet'], cuisse: ['quadriceps', 'Cuisse'],
  genou: ['genou', 'Genou'], mollet: ['mollet', 'Mollet'], cheville: ['cheville', 'Cheville'], pied: ['pied', 'Pied'],
};

const SIDE_SUFFIX = { gauche: ' gauche', droit: ' droit', na: '' };

// Localisation, côté et libellé complet (« Genou droit ») d'une zone, ou null
export function painZoneInfo(id) {
  let zone = PAIN_ZONES.find(z => z.id === id) || LEGACY_ZONES[id] || null;
  if (!zone) {
    const m = /^(.*)_(gauche|droite?)$/.exec(id || '');
    const legacy = m && LEGACY_SIDED[m[1]];
    if (legacy) zone = { location: legacy[0], side: m[2] === 'gauche' ? 'gauche' : 'droit', label: legacy[1] };
  }
  if (!zone) return null;
  return { ...zone, fullLabel: `${zone.label}${SIDE_SUFFIX[zone.side] || ''}` };
}

// Zones d'une réponse : [{ id, intensity (null si non précisée), ...painZoneInfo }]
export function painZonesOf(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value)
    .filter(([, v]) => v)
    .map(([id, v]) => {
      const info = painZoneInfo(id);
      return info && { id, intensity: typeof v === 'number' ? v : null, ...info };
    })
    .filter(Boolean);
}

// Texte court d'une réponse, ex. « Genou droit (6), Lombaires (3) »
export function formatPainValue(value) {
  const zones = painZonesOf(value);
  if (zones.length === 0) return 'Aucune douleur';
  return zones.map(z => (z.intensity != null ? `${z.fullLabel} (${z.intensity})` : z.fullLabel)).join(', ');
}
