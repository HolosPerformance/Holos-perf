// Types de séance d'une saisie. Un questionnaire dont la première question est
// un QCM à choix multiples peut en porter plusieurs (ex. « Séance autre » et
// « Musculation ») : `session_types` les liste tous, `session_type` garde le
// premier pour les usages qui n'en attendent qu'un.

// Libellés des choix cochés, dans l'ordre du questionnaire (pas dans l'ordre
// des clics). Accepte l'indice du choix ou l'ancienne valeur texte.
export function selectedChoiceLabels(rawVal, question) {
  if (rawVal === undefined || rawVal === null) return [];
  const values = Array.isArray(rawVal) ? rawVal : [rawVal];
  const choices = question?.selectOptions?.choices || [];
  return values
    .map(val => {
      const idx = parseInt(val, 10);
      return (!isNaN(idx) && choices[idx]) ? { order: idx, label: choices[idx].label } : { order: Infinity, label: val };
    })
    .sort((a, b) => a.order - b.order)
    .map(c => c.label)
    .filter((label, i, all) => label && all.indexOf(label) === i);
}

export const sessionTypesOf = (log) => (log.session_types?.length ? log.session_types : [log.session_type]);

// Une saisie passe le filtre si au moins un de ses types est retenu
export const matchesSessionTypes = (log, filters) => sessionTypesOf(log).some(type => filters.includes(type));
