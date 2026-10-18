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
