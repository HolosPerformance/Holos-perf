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
    painHint: "Touche les zones qui te font mal, puis indique l'intensité (1 = légère, 10 = très forte)",
    painFront: 'Devant',
    painBack: 'Derrière',
    painIntensity: 'Intensité',
    painNone: 'Aucune douleur',
    painLeft: 'G',
    painRight: 'D',
    painShowBack: 'Voir de dos',
    painShowFront: 'Voir de face',
    painLeftFull: 'Gauche',
    painRightFull: 'Droite',
    painMale: 'Homme',
    painFemale: 'Femme',
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
    painHint: 'Tap the areas that hurt, then rate the intensity (1 = mild, 10 = very strong)',
    painFront: 'Front',
    painBack: 'Back',
    painIntensity: 'Intensity',
    painNone: 'No pain',
    painLeft: 'L',
    painRight: 'R',
    painShowBack: 'Show back',
    painShowFront: 'Show front',
    painLeftFull: 'Left',
    painRightFull: 'Right',
    painMale: 'Male',
    painFemale: 'Female',
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
    painHint: 'Toca las zonas que te duelen e indica la intensidad (1 = leve, 10 = muy fuerte)',
    painFront: 'Frente',
    painBack: 'Espalda',
    painIntensity: 'Intensidad',
    painNone: 'Sin dolor',
    painLeft: 'I',
    painRight: 'D',
    painShowBack: 'Ver espalda',
    painShowFront: 'Ver frente',
    painLeftFull: 'Izquierda',
    painRightFull: 'Derecha',
    painMale: 'Hombre',
    painFemale: 'Mujer',
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
    painHint: "Tocca le zone che ti fanno male e indica l'intensità (1 = lieve, 10 = molto forte)",
    painFront: 'Fronte',
    painBack: 'Retro',
    painIntensity: 'Intensità',
    painNone: 'Nessun dolore',
    painLeft: 'S',
    painRight: 'D',
    painShowBack: 'Vedi retro',
    painShowFront: 'Vedi fronte',
    painLeftFull: 'Sinistra',
    painRightFull: 'Destra',
    painMale: 'Uomo',
    painFemale: 'Donna',
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
    painHint: 'Tippe auf die schmerzenden Stellen und gib die Stärke an (1 = leicht, 10 = sehr stark)',
    painFront: 'Vorne',
    painBack: 'Hinten',
    painIntensity: 'Stärke',
    painNone: 'Keine Schmerzen',
    painLeft: 'L',
    painRight: 'R',
    painShowBack: 'Rückseite zeigen',
    painShowFront: 'Vorderseite zeigen',
    painLeftFull: 'Links',
    painRightFull: 'Rechts',
    painMale: 'Mann',
    painFemale: 'Frau',
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
    painHint: 'Toca nas zonas que te doem e indica a intensidade (1 = ligeira, 10 = muito forte)',
    painFront: 'Frente',
    painBack: 'Costas',
    painIntensity: 'Intensidade',
    painNone: 'Sem dor',
    painLeft: 'E',
    painRight: 'D',
    painShowBack: 'Ver costas',
    painShowFront: 'Ver frente',
    painLeftFull: 'Esquerda',
    painRightFull: 'Direita',
    painMale: 'Homem',
    painFemale: 'Mulher',
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
    painHint: 'Tik op de plekken die pijn doen en geef de intensiteit aan (1 = licht, 10 = zeer sterk)',
    painFront: 'Voorkant',
    painBack: 'Achterkant',
    painIntensity: 'Intensiteit',
    painNone: 'Geen pijn',
    painLeft: 'L',
    painRight: 'R',
    painShowBack: 'Achterkant tonen',
    painShowFront: 'Voorkant tonen',
    painLeftFull: 'Links',
    painRightFull: 'Rechts',
    painMale: 'Man',
    painFemale: 'Vrouw',
  },
};

export const uiStrings = (lang) => ({ ...UI_STRINGS[BASE_LANGUAGE], ...(UI_STRINGS[lang] || {}) });
