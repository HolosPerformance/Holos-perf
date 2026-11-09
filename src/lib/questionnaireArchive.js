// Archivage des questionnaires : ils ne sont jamais supprimés de la base, pour
// que leurs réponses gardent leur lien et leurs intitulés. Les entraîneurs les
// voient comme supprimés ; seuls les administrateurs les retrouvent.
//
// `is_active: false` suffit à les retirer des écrans des athlètes, des rappels
// et de l'assignation automatique. Le dashboard coach masque leurs réponses, et
// un déclencheur SQL les retire des séances à venir. Les assignations sont
// conservées : une restauration rend le questionnaire et ses réponses, mais pas
// les liens retirés des séances.

export const isArchived = (template) => !!template?.archived_at;

export const archivePayload = (email) => ({
  is_active: false,
  archived_at: new Date().toISOString(),
  archived_by_email: email,
});

export const RESTORE_PAYLOAD = {
  is_active: true,
  archived_at: null,
  archived_by_email: null,
};
