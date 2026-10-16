// ─── Zones douloureuses (question « Zones douloureuses » des questionnaires) ───
//
// Réponse enregistrée : { [zoneId]: intensité 1-10 }, ex. { genou_d: 6 }.
// Chaque zone correspond à une localisation et un côté du module médical, pour
// pré-remplir une fiche blessure. Côté = côté de l'athlète : de face, sa
// gauche est à droite du schéma ; de dos, elle est à gauche.

export const PAIN_INTENSITY_DEFAULT = 5;
export const PAIN_INTENSITY_MAX = 10;

// Formes dans un repère 200 × 360 (une silhouette par vue)
export const PAIN_ZONES = [
  // Face
  { id: 'tete', view: 'front', location: 'tete', side: 'na', label: 'Tête', shape: { cx: 100, cy: 40, r: 25 } },
  { id: 'epaule_d', view: 'front', location: 'epaule', side: 'droit', label: 'Épaule', shape: { cx: 70, cy: 85, r: 12 } },
  { id: 'epaule_g', view: 'front', location: 'epaule', side: 'gauche', label: 'Épaule', shape: { cx: 130, cy: 85, r: 12 } },
  { id: 'bras_d', view: 'front', location: 'bras', side: 'droit', label: 'Bras', shape: { x: 50, y: 95, width: 15, height: 55, rx: 7 } },
  { id: 'bras_g', view: 'front', location: 'bras', side: 'gauche', label: 'Bras', shape: { x: 135, y: 95, width: 15, height: 55, rx: 7 } },
  { id: 'coude_d', view: 'front', location: 'coude', side: 'droit', label: 'Coude', shape: { cx: 57, cy: 155, r: 10 } },
  { id: 'coude_g', view: 'front', location: 'coude', side: 'gauche', label: 'Coude', shape: { cx: 143, cy: 155, r: 10 } },
  { id: 'avant_bras_d', view: 'front', location: 'avant_bras', side: 'droit', label: 'Avant-bras', shape: { x: 50, y: 163, width: 14, height: 36, rx: 7 } },
  { id: 'avant_bras_g', view: 'front', location: 'avant_bras', side: 'gauche', label: 'Avant-bras', shape: { x: 136, y: 163, width: 14, height: 36, rx: 7 } },
  { id: 'poignet_d', view: 'front', location: 'poignet', side: 'droit', label: 'Poignet', shape: { cx: 57, cy: 205, r: 7 } },
  { id: 'poignet_g', view: 'front', location: 'poignet', side: 'gauche', label: 'Poignet', shape: { cx: 143, cy: 205, r: 7 } },
  { id: 'main_d', view: 'front', location: 'main', side: 'droit', label: 'Main', shape: { cx: 57, cy: 222, rx: 8, ry: 10 } },
  { id: 'main_g', view: 'front', location: 'main', side: 'gauche', label: 'Main', shape: { cx: 143, cy: 222, rx: 8, ry: 10 } },
  { id: 'thorax', view: 'front', location: 'thorax', side: 'na', label: 'Thorax / côtes', shape: { cx: 100, cy: 105, rx: 30, ry: 25 } },
  { id: 'abdomen', view: 'front', location: 'abdomen', side: 'na', label: 'Abdomen', shape: { cx: 100, cy: 150, rx: 28, ry: 20 } },
  { id: 'aine_d', view: 'front', location: 'adducteurs', side: 'droit', label: 'Aine / adducteurs', shape: { x: 72, y: 172, width: 27, height: 16, rx: 6 } },
  { id: 'aine_g', view: 'front', location: 'adducteurs', side: 'gauche', label: 'Aine / adducteurs', shape: { x: 101, y: 172, width: 27, height: 16, rx: 6 } },
  { id: 'quadriceps_d', view: 'front', location: 'quadriceps', side: 'droit', label: 'Quadriceps', shape: { x: 70, y: 191, width: 20, height: 46, rx: 8 } },
  { id: 'quadriceps_g', view: 'front', location: 'quadriceps', side: 'gauche', label: 'Quadriceps', shape: { x: 110, y: 191, width: 20, height: 46, rx: 8 } },
  { id: 'genou_d', view: 'front', location: 'genou', side: 'droit', label: 'Genou', shape: { cx: 80, cy: 249, r: 11 } },
  { id: 'genou_g', view: 'front', location: 'genou', side: 'gauche', label: 'Genou', shape: { cx: 120, cy: 249, r: 11 } },
  { id: 'tibia_d', view: 'front', location: 'tibia', side: 'droit', label: 'Tibia', shape: { x: 73, y: 262, width: 14, height: 42, rx: 7 } },
  { id: 'tibia_g', view: 'front', location: 'tibia', side: 'gauche', label: 'Tibia', shape: { x: 113, y: 262, width: 14, height: 42, rx: 7 } },
  { id: 'cheville_d', view: 'front', location: 'cheville', side: 'droit', label: 'Cheville', shape: { cx: 80, cy: 314, r: 8 } },
  { id: 'cheville_g', view: 'front', location: 'cheville', side: 'gauche', label: 'Cheville', shape: { cx: 120, cy: 314, r: 8 } },
  { id: 'pied_d', view: 'front', location: 'pied', side: 'droit', label: 'Pied', shape: { cx: 80, cy: 336, rx: 11, ry: 15 } },
  { id: 'pied_g', view: 'front', location: 'pied', side: 'gauche', label: 'Pied', shape: { cx: 120, cy: 336, rx: 11, ry: 15 } },
  // Dos
  { id: 'nuque', view: 'back', location: 'cou', side: 'na', label: 'Nuque / cou', shape: { x: 90, y: 62, width: 20, height: 14, rx: 4 } },
  { id: 'haut_dos', view: 'back', location: 'dos', side: 'na', label: 'Haut du dos', shape: { cx: 100, cy: 105, rx: 30, ry: 25 } },
  { id: 'lombaires', view: 'back', location: 'dos', side: 'na', label: 'Lombaires', shape: { cx: 100, cy: 150, rx: 28, ry: 20 } },
  { id: 'fessier_g', view: 'back', location: 'hanche', side: 'gauche', label: 'Fessier / hanche', shape: { x: 71, y: 170, width: 28, height: 22, rx: 8 } },
  { id: 'fessier_d', view: 'back', location: 'hanche', side: 'droit', label: 'Fessier / hanche', shape: { x: 101, y: 170, width: 28, height: 22, rx: 8 } },
  { id: 'ischios_g', view: 'back', location: 'ischios', side: 'gauche', label: 'Ischio-jambiers', shape: { x: 70, y: 195, width: 20, height: 46, rx: 8 } },
  { id: 'ischios_d', view: 'back', location: 'ischios', side: 'droit', label: 'Ischio-jambiers', shape: { x: 110, y: 195, width: 20, height: 46, rx: 8 } },
  { id: 'mollet_g', view: 'back', location: 'mollet', side: 'gauche', label: 'Mollet', shape: { x: 72, y: 256, width: 16, height: 46, rx: 8 } },
  { id: 'mollet_d', view: 'back', location: 'mollet', side: 'droit', label: 'Mollet', shape: { x: 112, y: 256, width: 16, height: 46, rx: 8 } },
  { id: 'achille_g', view: 'back', location: 'tendon_achille', side: 'gauche', label: "Tendon d'Achille", shape: { x: 75, y: 305, width: 10, height: 16, rx: 4 } },
  { id: 'achille_d', view: 'back', location: 'tendon_achille', side: 'droit', label: "Tendon d'Achille", shape: { x: 115, y: 305, width: 10, height: 16, rx: 4 } },
];

// Parties non cliquables dessinées pour que la silhouette de dos reste lisible
export const BACK_DECOR = [
  { cx: 100, cy: 40, r: 25 },
  { cx: 70, cy: 85, r: 12 }, { cx: 130, cy: 85, r: 12 },
  { x: 50, y: 95, width: 15, height: 104, rx: 7 }, { x: 135, y: 95, width: 15, height: 104, rx: 7 },
  { cx: 80, cy: 336, rx: 11, ry: 15 }, { cx: 120, cy: 336, rx: 11, ry: 15 },
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
