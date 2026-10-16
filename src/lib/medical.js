// ─── Module médical : référentiels et helpers ────────────────────────────────

export const INJURY_STATUSES = [
  { value: 'blesse',              label: 'Blessé',                      badge: 'bg-red-100 text-red-700 border-red-200',          dot: 'bg-red-500' },
  { value: 'reeducation',         label: 'Rééducation',                 badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  { value: 'reathletisation',     label: 'Réathlétisation',             badge: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500' },
  { value: 'reprise_progressive', label: 'Reprise terrain progressive', badge: 'bg-blue-100 text-blue-700 border-blue-200',       dot: 'bg-blue-500' },
];

// Statut affiché quand l'athlète n'a pas de blessure ouverte
export const AVAILABLE_STATUS = {
  value: 'disponible', label: 'Disponible', badge: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500',
};

export const INJURY_TYPES = [
  { value: 'musculaire',   label: 'Musculaire' },
  { value: 'tendineuse',   label: 'Tendineuse' },
  { value: 'ligamentaire', label: 'Ligamentaire' },
  { value: 'articulaire',  label: 'Articulaire' },
  { value: 'osseuse',      label: 'Osseuse / fracture' },
  { value: 'contusion',    label: 'Contusion' },
  { value: 'commotion',    label: 'Commotion cérébrale' },
  { value: 'autre',        label: 'Autre' },
];

export const BODY_LOCATIONS = [
  { value: 'tete',          label: 'Tête' },
  { value: 'cou',           label: 'Cou / cervicales' },
  { value: 'epaule',        label: 'Épaule' },
  { value: 'bras',          label: 'Bras' },
  { value: 'coude',         label: 'Coude' },
  { value: 'avant_bras',    label: 'Avant-bras' },
  { value: 'poignet',       label: 'Poignet' },
  { value: 'main',          label: 'Main / doigts' },
  { value: 'thorax',        label: 'Thorax / côtes' },
  { value: 'abdomen',       label: 'Abdomen' },
  { value: 'dos',           label: 'Dos / lombaires' },
  { value: 'hanche',        label: 'Hanche / bassin' },
  { value: 'adducteurs',    label: 'Adducteurs / aine' },
  { value: 'quadriceps',    label: 'Quadriceps' },
  { value: 'ischios',       label: 'Ischio-jambiers' },
  { value: 'genou',         label: 'Genou' },
  { value: 'tibia',         label: 'Tibia / jambe' },
  { value: 'mollet',        label: 'Mollet' },
  { value: 'tendon_achille', label: "Tendon d'Achille" },
  { value: 'cheville',      label: 'Cheville' },
  { value: 'pied',          label: 'Pied' },
  { value: 'autre',         label: 'Autre' },
];

export const SIDES = [
  { value: 'gauche',     label: 'Gauche' },
  { value: 'droit',      label: 'Droit' },
  { value: 'bilateral',  label: 'Bilatéral' },
  { value: 'na',         label: 'Non applicable' },
];

export const SEVERITIES = [
  { value: 'legere',  label: 'Légère' },
  { value: 'moderee', label: 'Modérée' },
  { value: 'severe',  label: 'Sévère' },
];

export const CONTEXTS = [
  { value: 'match',          label: 'Match / compétition' },
  { value: 'entrainement',   label: 'Entraînement' },
  { value: 'hors_sport',     label: 'Hors sport' },
];

export const labelOf = (list, value) => list.find(o => o.value === value)?.label || value || '—';

export const statusInfo = (status) =>
  INJURY_STATUSES.find(s => s.value === status) || AVAILABLE_STATUS;

export const todayISO = () => new Date().toLocaleDateString('en-CA');

export const formatDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// Nombre de jours entre deux dates ISO (fin incluse par défaut à aujourd'hui)
export const daysBetween = (startIso, endIso) => {
  if (!startIso) return 0;
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso || todayISO()}T00:00:00`);
  return Math.max(0, Math.round((end - start) / 86400000));
};
