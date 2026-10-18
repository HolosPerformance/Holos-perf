// ─── Zones douloureuses (question « Zones douloureuses » des questionnaires) ───
//
// Réponse enregistrée : { [zoneId]: intensité 1-10 }, ex. { genou_d: 6 }.
// Chaque zone correspond à une localisation et un côté du module médical, pour
// pré-remplir une fiche blessure. Côté = côté de l'athlète : de face, sa
// gauche est à droite du schéma ; de dos, elle est à gauche.

// Échelle d'intensité : réglée par question dans scaleOptions { min, max,
// minLabel, maxLabel, showNumbers } (comme une question « Échelle ») ; 1 à 10
// avec les chiffres affichés par défaut
// (questions créées avant ce réglage et ancien questionnaire de séance).
export const PAIN_SCALE_DEFAULT = { min: 1, max: 10, minLabel: '', maxLabel: '', showNumbers: true };

export function painScaleOf(question) {
  const o = question?.scaleOptions || {};
  const min = Number.isFinite(Number(o.min)) && o.min !== '' && o.min != null ? Number(o.min) : PAIN_SCALE_DEFAULT.min;
  const max = Number.isFinite(Number(o.max)) && o.max !== '' && o.max != null ? Number(o.max) : PAIN_SCALE_DEFAULT.max;
  return max > min
    ? { min, max, minLabel: o.minLabel || '', maxLabel: o.maxLabel || '', showNumbers: o.showNumbers !== false }
    : { ...PAIN_SCALE_DEFAULT };
}

// Valeur proposée quand une zone est touchée : le milieu de l'échelle
export const painScaleMiddle = (scale) => Math.round((scale.min + scale.max) / 2);

// Une zone est cochée si elle a une valeur (0 compris) ou true (ancien format)
export const isPainZoneOn = (v) => v !== undefined && v !== null && v !== false;

// Zones cliquables : localisation et côté du module médical. Le dessin de
// chaque zone (silhouettes homme / femme, devant / derrière) est dans
// components/questionnaire/bodyArt.js. Les zones des membres existent dans les
// deux vues (même identifiant devant et derrière).
const SIDED = [
  ['epaule', 'epaule', 'Épaule'],
  ['bras', 'bras', 'Bras'],
  ['coude', 'coude', 'Coude'],
  ['avant_bras', 'avant_bras', 'Avant-bras'],
  ['poignet', 'poignet', 'Poignet'],
  ['main', 'main', 'Main'],
  ['aine', 'adducteurs', 'Aine / adducteurs'],
  ['quadriceps', 'quadriceps', 'Quadriceps'],
  ['genou', 'genou', 'Genou'],
  ['tibia', 'tibia', 'Tibia'],
  ['mollet', 'mollet', 'Mollet'],
  ['cheville', 'cheville', 'Cheville'],
  ['pied', 'pied', 'Pied'],
  ['fessier', 'hanche', 'Fessier / hanche'],
  ['ischios', 'ischios', 'Ischio-jambiers'],
  ['achille', 'tendon_achille', "Tendon d'Achille"],
];

export const PAIN_ZONES = [
  { id: 'tete', location: 'tete', side: 'na', label: 'Tête' },
  { id: 'cou', location: 'cou', side: 'na', label: 'Cou' },
  { id: 'nuque', location: 'cou', side: 'na', label: 'Nuque' },
  { id: 'thorax', location: 'thorax', side: 'na', label: 'Thorax / côtes' },
  { id: 'abdomen', location: 'abdomen', side: 'na', label: 'Abdomen' },
  { id: 'haut_dos', location: 'dos', side: 'na', label: 'Haut du dos' },
  { id: 'lombaires', location: 'dos', side: 'na', label: 'Lombaires' },
  ...SIDED.flatMap(([base, location, label]) => [
    { id: `${base}_g`, location, side: 'gauche', label },
    { id: `${base}_d`, location, side: 'droit', label },
  ]),
];

// Zones de l'ancien questionnaire de séance (training_logs.douleurs_zones, valeurs true)
const LEGACY_ZONES = {
  tete: { location: 'tete', side: 'na', label: 'Tête' },
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
// `scale` : échelle de la question (painScaleOf), recopiée dans chaque zone
export function painZonesOf(value, scale = PAIN_SCALE_DEFAULT) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value)
    .filter(([, v]) => isPainZoneOn(v))
    .map(([id, v]) => {
      const info = painZoneInfo(id);
      return info && { id, intensity: typeof v === 'number' ? v : null, scaleMax: scale.max, ...info };
    })
    .filter(Boolean);
}

// Intensité lisible, ex. « 6/10 » ou « 65/100 »
export const formatPainIntensity = (zone) => (zone.intensity != null ? `${zone.intensity}/${zone.scaleMax ?? PAIN_SCALE_DEFAULT.max}` : null);

// Texte court d'une réponse, ex. « Genou droit (6/10), Lombaires (3/10) »
export function formatPainValue(value, scale = PAIN_SCALE_DEFAULT) {
  const zones = painZonesOf(value, scale);
  if (zones.length === 0) return 'Aucune douleur';
  return zones.map(z => (z.intensity != null ? `${z.fullLabel} (${formatPainIntensity(z)})` : z.fullLabel)).join(', ');
}
