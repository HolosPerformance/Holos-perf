import React, { useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CheckCircle, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const resolveSelectionLabels = (answer, sourceQuestion) => {
  if (!Array.isArray(answer)) return answer;
  const choices = sourceQuestion?.selectOptions?.choices || [];
  return answer.map(val => {
    const i = parseInt(val, 10);
    if (!isNaN(i) && choices[i] !== undefined) return choices[i].label || val;
    return val; // compatibilité avec l'ancienne valeur texte
  });
};

const isQuestionVisible = (q, currentResponses, allQuestions = []) => {
  if (!q.condition) return true;
  const answer = currentResponses[q.condition.questionId];
  const sourceQuestion = allQuestions.find(sq => sq.id === q.condition.questionId);
  const resolved = resolveSelectionLabels(answer, sourceQuestion);
  // Support both new multi-values (expectedValues) and legacy single value (expectedValue)
  const expectedValues = q.condition.expectedValues?.length > 0
    ? q.condition.expectedValues
    : (q.condition.expectedValue ? [q.condition.expectedValue] : []);
  const conditionMet = Array.isArray(resolved)
    ? resolved.some(r => expectedValues.includes(r))
    : expectedValues.includes(resolved);
  const conditionType = q.condition.type || 'show';
  if (conditionType === 'show' && !conditionMet) return false;
  if (conditionType === 'hide' && conditionMet) return false;
  return true;
};

export default function CustomQuestionnaireForm({ questionnaire, user, onComplete, templateId, userEmail, forceDate, onSuccess, eventId, existingResponseId }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [responses, setResponses] = useState({});
  const [localScaleValues, setLocalScaleValues] = useState({});
  const [template, setTemplate] = useState(questionnaire);
  const [currentUser, setCurrentUser] = useState(user);
  const [loadedResponseId, setLoadedResponseId] = useState(null);

  React.useEffect(() => {
    if (templateId && !questionnaire) {
      base44.entities.QuestionnaireTemplate.get(templateId)
        .then(found => setTemplate(found))
        .catch(() => {});
    }
    if (userEmail && !user) {
      base44.auth.me()
        .then(userData => setCurrentUser(userData))
        .catch(() => {});
    }
    if (existingResponseId && !loadedResponseId) {
      base44.entities.QuestionnaireResponse.get(existingResponseId)
        .then(existingResponse => {
          if (existingResponse?.responses) {
            setResponses(existingResponse.responses);
            setLoadedResponseId(existingResponseId);
          }
        })
        .catch(() => {});
    }
  }, [templateId, questionnaire, userEmail, user, existingResponseId, loadedResponseId]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const currentTemplate = template || questionnaire;
    const activeUser = currentUser || user;

    if (!currentTemplate || !activeUser) {
      toast.error('Données manquantes, veuillez réessayer');
      return;
    }

    // Construire les réponses finales en excluant les questions cachées par leurs conditions
    const allQuestions = currentTemplate.questions;
    const finalResponses = { ...responses };
    currentTemplate.questions.forEach(q => {
      if (!isQuestionVisible(q, responses, allQuestions)) {
        delete finalResponses[q.id];
        return;
      }
      if (q.type === 'scale' && finalResponses[q.id] === undefined && localScaleValues[q.id] !== undefined) {
        finalResponses[q.id] = localScaleValues[q.id];
      }
      // Si le slider n'a jamais été touché, utiliser la valeur du milieu par défaut
      if (q.type === 'scale' && finalResponses[q.id] === undefined && q.scaleOptions) {
        const min = q.scaleOptions.min ?? 0;
        const max = q.scaleOptions.max ?? 100;
        finalResponses[q.id] = Math.round((min + max) / 2);
      }
    });

    // Vérifier les champs obligatoires uniquement sur les questions visibles
    const missingRequired = currentTemplate.questions.filter(q => {
      if (!isQuestionVisible(q, responses, allQuestions)) return false;
      if (!q.required) return false;
      const val = finalResponses[q.id];
      if (Array.isArray(val)) return val.length === 0;
      return val === undefined || val === null || val === '';
    });

    if (missingRequired.length > 0) {
      toast.error(`Veuillez remplir tous les champs obligatoires : ${missingRequired.map(q => q.athleteLabel || q.label).join(', ')}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const submissionDate = forceDate ? new Date(forceDate + 'T12:00:00').toISOString() : new Date().toISOString();

      // Si existingResponseId est fourni, mettre à jour la réponse existante
      if (existingResponseId) {
        await base44.entities.QuestionnaireResponse.update(existingResponseId, {
          responses: finalResponses,
          submitted_date: submissionDate
        });
        toast.success('Questionnaire mis à jour !');
      } else {
        // Sinon, créer une nouvelle réponse
        await base44.entities.QuestionnaireResponse.create({
          template_id: currentTemplate.id,
          event_id: eventId || null,
          athlete_email: activeUser.email,
          athlete_name: activeUser.full_name,
          responses: finalResponses,
          submitted_date: submissionDate
        });
        toast.success('Questionnaire envoyé !');
      }

      setSubmitted(true);

      if (onSuccess) {
        setTimeout(() => onSuccess(), 1500);
      } else if (onComplete) {
        setTimeout(() => onComplete(), 1500);
      }
    } catch (error) {
      toast.error(`Erreur lors de l'envoi : ${error.message}`);
      setIsSubmitting(false);
    }
  };

  const currentTemplate = template || questionnaire;
  
  if (!currentTemplate) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  if (submitted) {
    return (
      <Card className="shadow-lg border-0 bg-gradient-to-br from-emerald-50 to-teal-50">
        <CardContent className="py-12">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800">Merci !</h3>
            <p className="text-slate-500 mt-1">Ton questionnaire a été envoyé</p>
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl border-0 bg-gradient-to-br from-white to-slate-50">
      <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
        <div className="flex items-start gap-4">
          {currentTemplate.style?.headerImage && (
            <img 
              src={currentTemplate.style.headerImage} 
              alt="Logo"
              className="w-16 h-16 object-cover rounded-lg shadow-md"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          <div className="flex-1">
            <CardTitle className="text-xl md:text-2xl mb-1">{currentTemplate.name}</CardTitle>
            {currentTemplate.description && (
              <p className="text-purple-100 text-sm">{currentTemplate.description}</p>
            )}
          </div>
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {currentTemplate.questions.map((q, index) => {
            if (!isQuestionVisible(q, responses, currentTemplate.questions)) return null;
            
            return (
            <motion.div 
              key={q.id} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-5 bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
            >
              <div className="mb-4">
                <Label className="text-lg font-semibold text-slate-800 flex items-start gap-2">
                  <span className="flex-shrink-0 w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <span className="flex-1">
                    {q.athleteLabel || q.label}
                    {q.required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                </Label>
                {q.description && (
                  <p className="text-sm text-slate-600 mt-2 ml-0 sm:ml-9">{q.description}</p>
                )}
              </div>

              {q.type === 'scale' && q.scaleOptions && (
                <div className="space-y-4 ml-0 sm:ml-9">
                  <div className="flex justify-between text-sm font-medium text-slate-700">
                    <span className="px-3 py-1 bg-slate-100 rounded-full">{q.scaleOptions.minLabel}</span>
                    <span className="px-3 py-1 bg-slate-100 rounded-full">{q.scaleOptions.maxLabel}</span>
                  </div>
                  <div className="relative py-2">
                    <input
                      type="range"
                      min={q.scaleOptions.min}
                      max={q.scaleOptions.max}
                      value={localScaleValues[q.id] ?? responses[q.id] ?? Math.round(((q.scaleOptions.min ?? 0) + (q.scaleOptions.max ?? 100)) / 2)}
                      onChange={(e) => setLocalScaleValues({ ...localScaleValues, [q.id]: Number(e.target.value) })}
                      onMouseUp={(e) => setResponses({ ...responses, [q.id]: Number(e.target.value) })}
                      onTouchEnd={(e) => setResponses({ ...responses, [q.id]: Number(e.target.value) })}
                      required={q.required}
                      className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                      style={{ background: q.scaleOptions.color || '#3b82f6', transform: q.scaleOptions.reversed ? 'scaleX(-1)' : 'none' }}
                    />
                  </div>
                  {q.scaleOptions.showNumbers && (
                    <div className="text-center">
                      <div 
                        className="inline-block px-6 py-3 rounded-xl text-2xl font-bold text-white shadow-lg"
                        style={{ backgroundColor: q.scaleOptions.color || '#3b82f6' }}
                      >
                        {localScaleValues[q.id] ?? responses[q.id] ?? Math.round(((q.scaleOptions.min ?? 0) + (q.scaleOptions.max ?? 100)) / 2)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {q.type === 'text' && (
                <div className="ml-0 sm:ml-9">
                  <Input 
                    placeholder="Votre réponse..." 
                    value={responses[q.id] || ''}
                    onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })}
                    required={q.required}
                    className="h-11 text-base shadow-sm"
                  />
                </div>
              )}

              {q.type === 'textarea' && (
                <div className="ml-0 sm:ml-9">
                  <Textarea 
                    placeholder="Votre réponse..." 
                    rows={4}
                    value={responses[q.id] || ''}
                    onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })}
                    required={q.required}
                    className="text-base shadow-sm"
                  />
                </div>
              )}

              {q.type === 'number' && (
                <div className="ml-0 sm:ml-9">
                  <Input 
                    type="number" 
                    placeholder="0"
                    value={responses[q.id] || ''}
                    onChange={(e) => setResponses({ ...responses, [q.id]: Number(e.target.value) })}
                    required={q.required}
                    className="h-11 text-base shadow-sm"
                  />
                </div>
              )}

              {q.type === 'select' && q.selectOptions?.choices && (
                <div className="ml-0 sm:ml-9">
                  <p className="text-xs text-slate-400 mb-2">
                    {q.selectOptions?.multiSelect ? 'Plusieurs choix possibles' : 'Un seul choix possible'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {q.selectOptions.choices.map((choice, choiceIndex) => {
                      const isBlack = choice.color?.toLowerCase() === '#000000' || choice.color?.toLowerCase() === '#000' || choice.color?.toLowerCase() === 'black';
                      const textColor = isBlack ? '#ffffff' : '#000000';
                      const displayLabel = choice.label || `Choix ${choiceIndex + 1}`;
                      const choiceKey = String(choiceIndex);
                      const currentSelection = Array.isArray(responses[q.id]) ? responses[q.id] : (responses[q.id] ? [responses[q.id]] : []);
                      const isSelected = currentSelection.includes(choiceKey);

                      const toggle = () => {
                        setResponses(prev => {
                          const prevSel = Array.isArray(prev[q.id]) ? prev[q.id] : (prev[q.id] ? [prev[q.id]] : []);
                          if (q.selectOptions?.multiSelect) {
                            const already = prevSel.includes(choiceKey);
                            const next = already ? prevSel.filter(v => v !== choiceKey) : [...prevSel, choiceKey];
                            return { ...prev, [q.id]: next };
                          } else {
                            const already = prevSel.includes(choiceKey);
                            return { ...prev, [q.id]: already ? [] : [choiceKey] };
                          }
                        });
                      };

                      return (
                        <button
                          key={choiceIndex}
                          type="button"
                          onClick={toggle}
                          className="flex items-center gap-3 p-3 border-2 rounded-lg transition-all hover:scale-105"
                          style={{
                            backgroundColor: choice.color || '#ffffff',
                            borderColor: isSelected ? '#000000' : '#e2e8f0',
                            boxShadow: isSelected ? '0 0 0 3px rgba(0,0,0,0.35)' : 'none'
                          }}
                        >
                          {choice.image && (
                            <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden bg-white">
                              <img
                                src={choice.image}
                                alt={displayLabel}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            </div>
                          )}
                          <div className="flex-1 text-left font-medium" style={{ color: textColor }}>
                            {displayLabel}
                          </div>
                          {isSelected && (
                            <div
                              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: isBlack ? '#ffffff' : '#000000', color: isBlack ? '#000000' : '#ffffff' }}
                            >
                              ✓
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          );
          })}

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Envoyer les réponses
                </>
              )}
            </Button>
          </motion.div>
        </form>
      </CardContent>
    </Card>
  );
}