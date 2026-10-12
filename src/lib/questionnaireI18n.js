// Traductions des questionnaires.
//
// Le français est la langue de base : c'est le texte saisi normalement dans
// l'éditeur. Chaque langue ajoutée est stockée :
//   - pour le questionnaire : template.translations = { languages: ['en'], name: { en }, description: { en } }
//   - pour chaque question  : question.translations = { en: { athleteLabel, description, minLabel, maxLabel, choices: [] } }
//   - pour l'assignation    : template.athlete_languages = { [email]: 'en' }
// Tous les réglages (type, échelle, couleurs, conditions…) restent communs aux
// langues, et les réponses sont enregistrées par identifiant de question (et
// par index de choix) : une traduction ne change jamais les données.

export const BASE_LANGUAGE = 'fr';

export const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
];

export const languageInfo = (code) => LANGUAGES.find(l => l.code === code) || { code, label: code, flag: '🏳️' };

// Langues proposées par un questionnaire : le français + les langues ajoutées
export function templateLanguages(template) {
  const extra = (template?.translations?.languages || []).filter(code => code !== BASE_LANGUAGE);
  return [BASE_LANGUAGE, ...extra];
}

export function athleteLanguage(template, email) {
  const lang = template?.athlete_languages?.[email];
  return lang && templateLanguages(template).includes(lang) ? lang : BASE_LANGUAGE;
}

const pick = (translated, fallback) => (translated && String(translated).trim() ? translated : fallback);

// Nom et description du questionnaire dans la langue demandée (français si non traduit)
export function localizeTemplate(template, lang) {
  if (!template || !lang || lang === BASE_LANGUAGE) return template;
  const t = template.translations || {};
  return {
    ...template,
    name: pick(t.name?.[lang], template.name),
    description: pick(t.description?.[lang], template.description),
  };
}

// Question à afficher dans la langue demandée. Ne sert qu'à l'affichage : la
// logique (conditions, validation) doit continuer d'utiliser la question
// d'origine, dont les libellés de choix servent de référence.
export function localizeQuestion(question, lang) {
  if (!question || !lang || lang === BASE_LANGUAGE) return question;
  const t = question.translations?.[lang];
  if (!t) return question;
  const localized = {
    ...question,
    athleteLabel: pick(t.athleteLabel, question.athleteLabel || question.label),
    description: pick(t.description, question.description),
  };
  if (question.scaleOptions) {
    localized.scaleOptions = {
      ...question.scaleOptions,
      minLabel: pick(t.minLabel, question.scaleOptions.minLabel),
      maxLabel: pick(t.maxLabel, question.scaleOptions.maxLabel),
    };
  }
  if (question.selectOptions?.choices) {
    localized.selectOptions = {
      ...question.selectOptions,
      choices: question.selectOptions.choices.map((choice, i) => ({
        ...choice,
        label: pick(t.choices?.[i], choice.label),
      })),
    };
  }
  return localized;
}

// Une question a-t-elle au moins un texte traduit dans cette langue ?
export function isQuestionTranslated(question, lang) {
  const t = question?.translations?.[lang];
  if (!t) return false;
  return [t.athleteLabel, t.description, t.minLabel, t.maxLabel, ...(t.choices || [])]
    .some(v => v && String(v).trim());
}

// Textes fixes du formulaire rempli par l'athlète
const UI_STRINGS = {
  fr: {
    answerPlaceholder: 'Votre réponse...',
    multiChoice: 'Plusieurs choix possibles',
    singleChoice: 'Un seul choix possible',
    choice: 'Choix',
    submit: 'Envoyer les réponses',
    submitting: 'Envoi en cours...',
    thanks: 'Merci !',
    sent: 'Ton questionnaire a été envoyé',
    loading: 'Chargement...',
    missingRequired: 'Veuillez remplir tous les champs obligatoires :',
    toastSent: 'Questionnaire envoyé !',
    toastUpdated: 'Questionnaire mis à jour !',
    toastMissingData: 'Données manquantes, veuillez réessayer',
    toastError: "Erreur lors de l'envoi :",
  },
  en: {
    answerPlaceholder: 'Your answer...',
    multiChoice: 'Several answers possible',
    singleChoice: 'One answer only',
    choice: 'Choice',
    submit: 'Submit answers',
    submitting: 'Sending...',
    thanks: 'Thank you!',
    sent: 'Your questionnaire has been sent',
    loading: 'Loading...',
    missingRequired: 'Please fill in all required fields:',
    toastSent: 'Questionnaire sent!',
    toastUpdated: 'Questionnaire updated!',
    toastMissingData: 'Missing data, please try again',
    toastError: 'Error while sending:',
  },
  es: {
    answerPlaceholder: 'Tu respuesta...',
    multiChoice: 'Varias respuestas posibles',
    singleChoice: 'Una sola respuesta',
    choice: 'Opción',
    submit: 'Enviar respuestas',
    submitting: 'Enviando...',
    thanks: '¡Gracias!',
    sent: 'Tu cuestionario ha sido enviado',
    loading: 'Cargando...',
    missingRequired: 'Por favor, rellena todos los campos obligatorios:',
    toastSent: '¡Cuestionario enviado!',
    toastUpdated: '¡Cuestionario actualizado!',
    toastMissingData: 'Faltan datos, inténtalo de nuevo',
    toastError: 'Error al enviar:',
  },
  it: {
    answerPlaceholder: 'La tua risposta...',
    multiChoice: 'Più risposte possibili',
    singleChoice: 'Una sola risposta',
    choice: 'Scelta',
    submit: 'Invia le risposte',
    submitting: 'Invio in corso...',
    thanks: 'Grazie!',
    sent: 'Il tuo questionario è stato inviato',
    loading: 'Caricamento...',
    missingRequired: 'Compila tutti i campi obbligatori:',
    toastSent: 'Questionario inviato!',
    toastUpdated: 'Questionario aggiornato!',
    toastMissingData: 'Dati mancanti, riprova',
    toastError: "Errore durante l'invio:",
  },
  de: {
    answerPlaceholder: 'Deine Antwort...',
    multiChoice: 'Mehrere Antworten möglich',
    singleChoice: 'Nur eine Antwort möglich',
    choice: 'Auswahl',
    submit: 'Antworten senden',
    submitting: 'Wird gesendet...',
    thanks: 'Danke!',
    sent: 'Dein Fragebogen wurde gesendet',
    loading: 'Wird geladen...',
    missingRequired: 'Bitte fülle alle Pflichtfelder aus:',
    toastSent: 'Fragebogen gesendet!',
    toastUpdated: 'Fragebogen aktualisiert!',
    toastMissingData: 'Fehlende Daten, bitte erneut versuchen',
    toastError: 'Fehler beim Senden:',
  },
  pt: {
    answerPlaceholder: 'A tua resposta...',
    multiChoice: 'Várias respostas possíveis',
    singleChoice: 'Apenas uma resposta',
    choice: 'Opção',
    submit: 'Enviar respostas',
    submitting: 'A enviar...',
    thanks: 'Obrigado!',
    sent: 'O teu questionário foi enviado',
    loading: 'A carregar...',
    missingRequired: 'Preenche todos os campos obrigatórios:',
    toastSent: 'Questionário enviado!',
    toastUpdated: 'Questionário atualizado!',
    toastMissingData: 'Dados em falta, tenta novamente',
    toastError: 'Erro ao enviar:',
  },
  nl: {
    answerPlaceholder: 'Jouw antwoord...',
    multiChoice: 'Meerdere antwoorden mogelijk',
    singleChoice: 'Slechts één antwoord',
    choice: 'Keuze',
    submit: 'Antwoorden versturen',
    submitting: 'Bezig met versturen...',
    thanks: 'Bedankt!',
    sent: 'Je vragenlijst is verstuurd',
    loading: 'Laden...',
    missingRequired: 'Vul alle verplichte velden in:',
    toastSent: 'Vragenlijst verstuurd!',
    toastUpdated: 'Vragenlijst bijgewerkt!',
    toastMissingData: 'Gegevens ontbreken, probeer het opnieuw',
    toastError: 'Fout bij het versturen:',
  },
};

export const uiStrings = (lang) => ({ ...UI_STRINGS[BASE_LANGUAGE], ...(UI_STRINGS[lang] || {}) });
