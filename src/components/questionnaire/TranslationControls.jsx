import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Languages, Trash2 } from 'lucide-react';
import { LANGUAGES, BASE_LANGUAGE, languageInfo, templateLanguages } from '@/lib/questionnaireI18n';

// Bouton « Ajouter une traduction » : ouvre la liste des langues pas encore ajoutées
export function AddTranslationButton({ languages, onAdd, className = '' }) {
  const [open, setOpen] = useState(false);
  const available = LANGUAGES.filter(l => l.code !== BASE_LANGUAGE && !languages.includes(l.code));
  if (available.length === 0) return null;
  return (
    <div className={className}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(o => !o)} className="gap-2 border-teal-300 text-teal-700 hover:bg-teal-50">
        <Languages className="w-4 h-4" />Ajouter une traduction
      </Button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-2">
          {available.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => { onAdd(l.code); setOpen(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-teal-200 bg-white text-sm hover:bg-teal-50"
            >
              <span>{l.flag}</span>{l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Traductions d'une question : mêmes réglages que la question d'origine, seuls
// les textes vus par l'athlète sont traduisibles. Un champ laissé vide reprend
// le texte français.
export function QuestionTranslations({ question, setQuestion, languages, onAddLanguage }) {
  const [activeLang, setActiveLang] = useState(languages[0] || null);
  const lang = languages.includes(activeLang) ? activeLang : languages[0];
  const t = (lang && question.translations?.[lang]) || {};

  const update = (patch) => setQuestion({
    ...question,
    translations: { ...(question.translations || {}), [lang]: { ...t, ...patch } },
  });

  const addLanguage = (code) => { onAddLanguage(code); setActiveLang(code); };

  return (
    <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="font-medium text-slate-800 text-sm flex items-center gap-2">
          <Languages className="w-4 h-4 text-teal-600" />Traductions
        </h4>
        <AddTranslationButton languages={languages} onAdd={addLanguage} />
      </div>

      {languages.length === 0 ? (
        <p className="text-xs text-slate-500">
          Aucune traduction. Ajoutez une langue pour proposer cette question (et le questionnaire) dans une autre langue,
          avec exactement les mêmes réglages.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {languages.map(code => {
              const info = languageInfo(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setActiveLang(code)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border transition-colors ${
                    code === lang ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-700 border-teal-200 hover:bg-teal-100'
                  }`}
                >
                  <span>{info.flag}</span>{info.label}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-slate-500">Champ vide = texte français utilisé.</p>

          <div className="space-y-3 bg-white p-3 rounded-lg border border-teal-100">
            <div className="space-y-1.5">
              <Label className="text-sm">Libellé athlète</Label>
              <Input
                value={t.athleteLabel || ''}
                onChange={(e) => update({ athleteLabel: e.target.value })}
                placeholder={question.athleteLabel || question.label || 'Texte de la question'}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Description</Label>
              <Input
                value={t.description || ''}
                onChange={(e) => update({ description: e.target.value })}
                placeholder={question.description || 'Description (optionnel)'}
              />
            </div>

            {question.type === 'scale' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Label min</Label>
                  <Input value={t.minLabel || ''} onChange={(e) => update({ minLabel: e.target.value })} placeholder={question.scaleOptions?.minLabel || ''} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Label max</Label>
                  <Input value={t.maxLabel || ''} onChange={(e) => update({ maxLabel: e.target.value })} placeholder={question.scaleOptions?.maxLabel || ''} />
                </div>
              </div>
            )}

            {question.type === 'select' && (question.selectOptions?.choices || []).length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm">Choix</Label>
                {(question.selectOptions?.choices || []).map((choice, ci) => (
                  <div key={ci} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0 border" style={{ backgroundColor: choice.color || '#fff' }} />
                    <Input
                      value={t.choices?.[ci] || ''}
                      onChange={(e) => {
                        const choices = [...(t.choices || [])];
                        choices[ci] = e.target.value;
                        update({ choices });
                      }}
                      placeholder={choice.label || `Choix ${ci + 1}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Traductions du nom et de la description du questionnaire
export function QuestionnaireTranslations({ formData, setFormData, languages, onAddLanguage, onRemoveLanguage }) {
  const translations = formData.translations || {};
  const setField = (field, code, value) => setFormData({
    ...formData,
    translations: { ...translations, [field]: { ...(translations[field] || {}), [code]: value } },
  });

  return (
    <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Label className="font-medium flex items-center gap-2"><Languages className="w-4 h-4 text-teal-600" />Traductions</Label>
          <p className="text-xs text-slate-500 mt-0.5">
            Un seul questionnaire pour plusieurs langues : les réponses de toutes les langues sont regroupées dans le dashboard.
            La langue de chaque athlète se choisit à l'assignation.
          </p>
        </div>
        <AddTranslationButton languages={languages} onAdd={onAddLanguage} />
      </div>
      {languages.map(code => {
        const info = languageInfo(code);
        return (
          <div key={code} className="bg-white p-3 rounded-lg border border-teal-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{info.flag} {info.label}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveLanguage(code)} className="text-red-600 h-7 px-2" title="Supprimer cette traduction">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <Input
              value={translations.name?.[code] || ''}
              onChange={(e) => setField('name', code, e.target.value)}
              placeholder={formData.name ? `Nom : ${formData.name}` : 'Nom du questionnaire'}
            />
            <Input
              value={translations.description?.[code] || ''}
              onChange={(e) => setField('description', code, e.target.value)}
              placeholder={formData.description ? `Description : ${formData.description}` : 'Description'}
            />
          </div>
        );
      })}
    </div>
  );
}

// Langue dans laquelle un athlète assigné reçoit le questionnaire
export function AthleteLanguageSelect({ template, value, onChange }) {
  const languages = templateLanguages(template);
  if (languages.length < 2) return null;
  return (
    <select
      value={languages.includes(value) ? value : BASE_LANGUAGE}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      title="Langue du questionnaire pour cet athlète"
      className="text-xs border border-teal-200 rounded-md px-1.5 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-400"
    >
      {languages.map(code => (
        <option key={code} value={code}>{languageInfo(code).flag} {languageInfo(code).label}</option>
      ))}
    </select>
  );
}

// Résumé « 🇫🇷 3 · 🇪🇸 1 » des langues des athlètes assignés
export function AssignedLanguagesSummary({ template, assignedEmails, athleteLanguages }) {
  const languages = templateLanguages(template);
  if (languages.length < 2 || assignedEmails.length === 0) return null;
  const counts = {};
  assignedEmails.forEach(email => {
    const lang = languages.includes(athleteLanguages?.[email]) ? athleteLanguages[email] : BASE_LANGUAGE;
    counts[lang] = (counts[lang] || 0) + 1;
  });
  return (
    <p className="text-xs text-slate-500">
      {languages.filter(code => counts[code]).map(code => `${languageInfo(code).flag} ${counts[code]}`).join(' · ')}
    </p>
  );
}

// Ne garde que la langue des athlètes encore assignés, et pas le français (valeur par défaut)
export function cleanAthleteLanguages(athleteLanguages, assignedEmails) {
  return Object.fromEntries(Object.entries(athleteLanguages || {})
    .filter(([email, lang]) => assignedEmails.includes(email) && lang && lang !== BASE_LANGUAGE));
}