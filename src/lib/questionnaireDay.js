import { format, subDays, subHours } from 'date-fns';

// Journée de questionnaire : de 5h du matin à 5h le lendemain. Une réponse
// envoyée le mardi à 2h compte pour le lundi. Calculé en heure locale.
export const DAY_START_HOUR = 5;

// Jour de questionnaire ('yyyy-MM-dd') d'un instant donné (maintenant par défaut)
export function questionnaireDay(date = new Date()) {
  return format(subHours(date, DAY_START_HOUR), 'yyyy-MM-dd');
}

// Jour de questionnaire précédent (« hier »)
export function previousQuestionnaireDay(date = new Date()) {
  return format(subDays(subHours(date, DAY_START_HOUR), 1), 'yyyy-MM-dd');
}

// Jour de questionnaire auquel une réponse est rattachée
export function responseDay(response) {
  return response?.submitted_date ? questionnaireDay(new Date(response.submitted_date)) : null;
}

// Heure d'envoi ('HH:mm', heure locale) d'une réponse, ou null quand elle
// n'est pas connue : réponse saisie après coup pour un jour passé. Son heure
// enregistrée est alors fixée à midi pile (voir CustomQuestionnaireForm) et
// elle a été créée un autre jour que celui auquel elle est rattachée.
export function responseTime(response) {
  if (!response?.submitted_date) return null;
  const submitted = new Date(response.submitted_date);
  if (Number.isNaN(submitted.getTime())) return null;
  const forcedNoon = submitted.getHours() === 12 && submitted.getMinutes() === 0
    && submitted.getSeconds() === 0 && submitted.getMilliseconds() === 0;
  if (forcedNoon) return null;
  if (response.created_at && questionnaireDay(new Date(response.created_at)) !== questionnaireDay(submitted)) return null;
  return format(submitted, 'HH:mm');
}

// Heure de saisie ('HH:mm') d'un journal d'entraînement, si saisi le jour même
export function trainingLogTime(log) {
  if (!log?.created_at || !log.training_date) return null;
  const created = new Date(log.created_at);
  if (Number.isNaN(created.getTime()) || questionnaireDay(created) !== log.training_date) return null;
  return format(created, 'HH:mm');
}
