// Créneaux de questionnaires d'un club ou d'une équipe : le matin (avant la
// séance) et le soir (après l'entraînement). Un questionnaire n'appartient
// qu'à un seul créneau.

export const SLOTS = ['morning', 'evening'];

export const SLOT_LABELS = {
  morning: { icon: '☀️', title: 'Matin', hint: 'avant la séance' },
  evening: { icon: '🌙', title: 'Soir', hint: "après l'entraînement" },
};

// Heure à partir de laquelle le questionnaire du soir est mis en avant
export const EVENING_START_HOUR = 14;

// Questionnaires du matin du club (avec migration depuis l'ancien champ)
export function clubMorningIds(club) {
  if (!club) return [];
  if (club.default_questionnaire_template_ids?.length) return club.default_questionnaire_template_ids;
  return club.default_questionnaire_template_id ? [club.default_questionnaire_template_id] : [];
}

export function clubEveningIds(club) {
  return club?.evening_questionnaire_template_ids || [];
}

export function teamMorningIds(team) {
  return team?.questionnaire_template_ids || [];
}

export function teamEveningIds(team) {
  return team?.evening_questionnaire_template_ids || [];
}

// Tous les questionnaires du club ou de l'équipe, matin et soir confondus
export function allClubIds(club) {
  return Array.from(new Set([...clubMorningIds(club), ...clubEveningIds(club)]));
}

export function allTeamIds(team) {
  return Array.from(new Set([...teamMorningIds(team), ...teamEveningIds(team)]));
}

// Active ou désactive un questionnaire dans un créneau. L'ajouter à un créneau
// le retire de l'autre. Renvoie les nouvelles listes { morning, evening }.
export function toggleInSlot({ morning, evening }, templateId, slot) {
  const lists = { morning: [...morning], evening: [...evening] };
  const other = slot === 'morning' ? 'evening' : 'morning';
  if (lists[slot].includes(templateId)) {
    lists[slot] = lists[slot].filter(id => id !== templateId);
  } else {
    lists[slot] = [...lists[slot], templateId];
    lists[other] = lists[other].filter(id => id !== templateId);
  }
  return lists;
}

// Créneau à mettre en avant selon l'heure. La journée de questionnaire
// commence à 5h, donc entre minuit et 5h on est encore « le soir ».
export function currentSlot(date = new Date()) {
  const hour = date.getHours();
  return hour >= 5 && hour < EVENING_START_HOUR ? 'morning' : 'evening';
}
