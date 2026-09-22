import React, { useState, useEffect } from 'react';
import { supabase as base44, supabaseRaw } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Plus, Edit2, Trash2, Save, X, Database } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function QuestionBank() {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [previewValue, setPreviewValue] = useState(50);
  const queryClient = useQueryClient();

  const [newQuestion, setNewQuestion] = useState({
    label: '',
    athleteLabel: '',
    description: '',
    type: 'scale',
    required: false,
    selectOptions: {
      choices: [
        { label: '', color: '#3b82f6', image: '' },
        { label: '', color: '#34a853', image: '' },
        { label: '', color: '#fbbc04', image: '' },
        { label: '', color: '#ea4335', image: '' }
      ]
    },
    scaleOptions: {
      min: 0,
      max: 100,
      reversed: false,
      showNumbers: false,
      minLabel: '0',
      maxLabel: '100',
      color: '#3b82f6'
    }
  });

  const predefinedColors = [
    { name: 'Rouge', value: '#ea4335' },
    { name: 'Orange', value: '#ff6d00' },
    { name: 'Jaune', value: '#fbbc04' },
    { name: 'Vert', value: '#34a853' },
    { name: 'Cyan', value: '#00bcd4' },
    { name: 'Bleu', value: '#4285f4' },
    { name: 'Violet', value: '#9c27b0' },
    { name: 'Rose', value: '#e91e63' },
    { name: 'Marron', value: '#795548' },
    { name: 'Gris', value: '#9e9e9e' },
    { name: 'Noir', value: '#000000' },
    { name: 'Blanc', value: '#ffffff' }
  ];

  const isAdmin = user?.user_status === 'admin';

  const { data: questions = [] } = useQuery({
    queryKey: ['question-bank'],
    queryFn: () => base44.entities.QuestionBankItem.list('-created_at', 200),
    enabled: !!user && isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.QuestionBankItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-bank'] });
      toast.success('Question ajoutée à la banque');
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QuestionBankItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-bank'] });
      toast.success('Question mise à jour');
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.QuestionBankItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-bank'] });
      toast.success('Question supprimée de la banque');
    },
  });

  const resetForm = () => {
    setNewQuestion({
      label: '',
      athleteLabel: '',
      description: '',
      type: 'scale',
      required: false,
      selectOptions: {
        choices: [
          { label: '', color: '#3b82f6', image: '' },
          { label: '', color: '#34a853', image: '' },
          { label: '', color: '#fbbc04', image: '' },
          { label: '', color: '#ea4335', image: '' }
        ]
      },
      scaleOptions: {
        min: 0,
        max: 100,
        reversed: false,
        showNumbers: false,
        minLabel: '0',
        maxLabel: '100',
        color: '#3b82f6'
      }
    });
    setIsCreating(false);
    setEditingQuestion(null);
    setShowColorPicker(false);
  };

  const handleSaveQuestion = () => {
    if (!newQuestion.label) {
      toast.error('Le libellé est obligatoire');
      return;
    }

    const questionData = {
      ...newQuestion,
      created_by_email: user.email,
      selectOptions: newQuestion.type === 'select' ? {
        choices: (newQuestion.selectOptions?.choices || []).map(choice => ({
          label: choice.label || '',
          color: choice.color || '#3b82f6',
          image: choice.image || ''
        }))
      } : undefined,
      scaleOptions: newQuestion.type === 'scale' ? {
        min: newQuestion.scaleOptions?.min ?? 0,
        max: newQuestion.scaleOptions?.max ?? 100,
        reversed: newQuestion.scaleOptions?.reversed || false,
        showNumbers: newQuestion.scaleOptions?.showNumbers ?? false,
        minLabel: newQuestion.scaleOptions?.minLabel || '0',
        maxLabel: newQuestion.scaleOptions?.maxLabel || '100',
        color: newQuestion.scaleOptions?.color || '#3b82f6'
      } : undefined
    };

    if (editingQuestion) {
      updateMutation.mutate({ id: editingQuestion.id, data: questionData });
    } else {
      createMutation.mutate(questionData);
    }
  };

  const startEdit = (question) => {
    setNewQuestion({
      label: question.label,
      athleteLabel: question.athleteLabel || '',
      description: question.description || '',
      type: question.type,
      required: question.required || false,
      selectOptions: question.selectOptions || {
        choices: [
          { label: '', color: '#3b82f6', image: '' },
          { label: '', color: '#34a853', image: '' },
          { label: '', color: '#fbbc04', image: '' },
          { label: '', color: '#ea4335', image: '' }
        ]
      },
      scaleOptions: question.scaleOptions || {
        min: 0,
        max: 100,
        reversed: false,
        showNumbers: false,
        minLabel: '0',
        maxLabel: '100',
        color: '#3b82f6'
      }
    });
    setEditingQuestion(question);
    setIsCreating(true);
  };

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <p className="text-slate-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link to={createPageUrl('Questionnaires')}>
            <Button variant="outline" className="gap-2 mb-4">
              <ArrowLeft className="w-4 h-4" />
              Retour à la bibliothèque
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
                <Database className="w-8 h-8 text-purple-600" />
                Banque de questions
              </h1>
              <p className="text-slate-600 text-sm md:text-base mt-1">
                Créez et gérez vos questions réutilisables
              </p>
            </div>
            {!isCreating && (
              <Button onClick={() => setIsCreating(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Nouvelle question
              </Button>
            )}
          </div>
        </div>

        {isCreating && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>{editingQuestion ? 'Modifier la question' : 'Créer une question'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="q-label">Libellé interne (admin, dashboard) *</Label>
                  <Input
                    id="q-label"
                    value={newQuestion.label}
                    onChange={(e) => setNewQuestion({ ...newQuestion, label: e.target.value })}
                    placeholder="Ex: Comment vous sentez-vous ?"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="q-athlete-label">Libellé athlète (optionnel)</Label>
                  <Input
                    id="q-athlete-label"
                    value={newQuestion.athleteLabel || ''}
                    onChange={(e) => setNewQuestion({ ...newQuestion, athleteLabel: e.target.value })}
                    placeholder="Si vide, le libellé interne sera utilisé"
                  />
                  <p className="text-xs text-slate-500">Ce texte sera affiché aux athlètes lors de la réponse</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="q-description">Description (optionnel)</Label>
                  <Input
                    id="q-description"
                    value={newQuestion.description || ''}
                    onChange={(e) => setNewQuestion({ ...newQuestion, description: e.target.value })}
                    placeholder="Phrase courte pour décrire la question"
                  />
                  <p className="text-xs text-slate-500">Apparaîtra sous le libellé pour préciser la question</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="q-type">Type de réponse</Label>
                    <Select
                      value={newQuestion.type}
                      onValueChange={(value) => setNewQuestion({ ...newQuestion, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scale">Échelle (0-100)</SelectItem>
                        <SelectItem value="text">Texte court</SelectItem>
                        <SelectItem value="textarea">Texte long</SelectItem>
                        <SelectItem value="number">Nombre</SelectItem>
                        <SelectItem value="select">Choix multiples</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newQuestion.required}
                        onChange={(e) => setNewQuestion({ ...newQuestion, required: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700">Question obligatoire</span>
                    </label>
                  </div>
                </div>

                {newQuestion.type === 'scale' && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                    <h4 className="font-medium text-slate-800 text-sm">Options de l'échelle</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="min-value">Valeur minimale</Label>
                        <Input
                          id="min-value"
                          type="number"
                          value={newQuestion.scaleOptions?.min ?? 0}
                          onChange={(e) => setNewQuestion({
                            ...newQuestion,
                            scaleOptions: { ...newQuestion.scaleOptions, min: Number(e.target.value) }
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max-value">Valeur maximale</Label>
                        <Input
                          id="max-value"
                          type="number"
                          value={newQuestion.scaleOptions?.max ?? 100}
                          onChange={(e) => setNewQuestion({
                            ...newQuestion,
                            scaleOptions: { ...newQuestion.scaleOptions, max: Number(e.target.value) }
                          })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="min-label">Label valeur minimale</Label>
                        <Input
                          id="min-label"
                          value={newQuestion.scaleOptions?.minLabel || ''}
                          onChange={(e) => setNewQuestion({
                            ...newQuestion,
                            scaleOptions: { ...newQuestion.scaleOptions, minLabel: e.target.value }
                          })}
                          placeholder="Ex: Très faible"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max-label">Label valeur maximale</Label>
                        <Input
                          id="max-label"
                          value={newQuestion.scaleOptions?.maxLabel || ''}
                          onChange={(e) => setNewQuestion({
                            ...newQuestion,
                            scaleOptions: { ...newQuestion.scaleOptions, maxLabel: e.target.value }
                          })}
                          placeholder="Ex: Très élevé"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Couleur de l'échelle</Label>
                      
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowColorPicker(!showColorPicker)}
                          className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors w-full"
                        >
                          <div 
                            className="w-10 h-10 rounded-full flex-shrink-0"
                            style={{ 
                              backgroundColor: newQuestion.scaleOptions?.color || '#3b82f6',
                              border: (newQuestion.scaleOptions?.color || '#3b82f6').toLowerCase() === '#ffffff' ? '2px solid #000' : '2px solid #e2e8f0'
                            }}
                          />
                          <span className="text-sm text-slate-700">
                            {predefinedColors.find(c => c.value === newQuestion.scaleOptions?.color)?.name || 'Personnalisée'}
                          </span>
                        </button>

                        {showColorPicker && (
                          <div className="absolute z-10 mt-2 p-4 bg-white border rounded-lg shadow-lg w-full">
                            <div className="space-y-4">
                              <div className="grid grid-cols-6 gap-3">
                                {predefinedColors.map((color) => (
                                  <button
                                    key={color.value}
                                    type="button"
                                    onClick={() => {
                                      setNewQuestion({
                                        ...newQuestion,
                                        scaleOptions: { ...newQuestion.scaleOptions, color: color.value }
                                      });
                                      setShowColorPicker(false);
                                    }}
                                    className="flex items-center justify-center relative"
                                    title={color.name}
                                  >
                                    <div 
                                      className="w-10 h-10 rounded-full hover:scale-110 transition-transform"
                                      style={{ 
                                        backgroundColor: color.value,
                                        border: color.value === '#ffffff' ? '2px solid #000' : '2px solid #e2e8f0',
                                        boxShadow: newQuestion.scaleOptions?.color === color.value ? '0 0 0 3px #3b82f6' : 'none'
                                      }}
                                    />
                                  </button>
                                ))}
                              </div>

                              <div className="space-y-2 pt-2 border-t">
                                <Label htmlFor="custom-color" className="text-xs">Code couleur personnalisé</Label>
                                <div className="flex gap-2">
                                  <Input
                                    id="custom-color"
                                    value={newQuestion.scaleOptions?.color || '#3b82f6'}
                                    onChange={(e) => setNewQuestion({
                                      ...newQuestion,
                                      scaleOptions: { ...newQuestion.scaleOptions, color: e.target.value }
                                    })}
                                    placeholder="#3b82f6"
                                    className="flex-1 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="reversed"
                          checked={newQuestion.scaleOptions?.reversed || false}
                          onCheckedChange={(checked) => setNewQuestion({
                            ...newQuestion,
                            scaleOptions: { ...newQuestion.scaleOptions, reversed: checked }
                          })}
                        />
                        <Label htmlFor="reversed" className="text-sm cursor-pointer">
                          Échelle inversée (100 → 0)
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="show-numbers"
                          checked={newQuestion.scaleOptions?.showNumbers ?? true}
                          onCheckedChange={(checked) => setNewQuestion({
                            ...newQuestion,
                            scaleOptions: { ...newQuestion.scaleOptions, showNumbers: checked }
                          })}
                        />
                        <Label htmlFor="show-numbers" className="text-sm cursor-pointer">
                          Afficher les chiffres aux sportifs
                        </Label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-slate-600">Aperçu de l'échelle :</Label>
                      <div className="bg-white p-4 rounded border">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-slate-700">{newQuestion.scaleOptions?.minLabel}</span>
                          <span className="text-slate-700">{newQuestion.scaleOptions?.maxLabel}</span>
                        </div>
                        <div className="relative">
                          <input
                            type="range"
                            min={newQuestion.scaleOptions?.min ?? 0}
                            max={newQuestion.scaleOptions?.max ?? 100}
                            value={previewValue}
                            onChange={(e) => setPreviewValue(Number(e.target.value))}
                            className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                            style={{
                              background: newQuestion.scaleOptions?.color || '#3b82f6',
                              border: (newQuestion.scaleOptions?.color || '#3b82f6').toLowerCase() === '#ffffff' ? '1px solid #000' : 'none',
                              transform: newQuestion.scaleOptions?.reversed ? 'scaleX(-1)' : 'none'
                            }}
                          />
                        </div>
                        {newQuestion.scaleOptions?.showNumbers && (
                          <div className="text-center mt-2 text-lg font-semibold" style={{ color: newQuestion.scaleOptions?.color }}>
                            {previewValue}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {newQuestion.type === 'select' && (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-4">
                    <h4 className="font-medium text-slate-800 text-sm">Options de choix multiples</h4>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="multi-select-bank"
                        checked={newQuestion.selectOptions?.multiSelect ?? false}
                        onCheckedChange={(checked) => setNewQuestion({ ...newQuestion, selectOptions: { ...newQuestion.selectOptions, multiSelect: checked } })}
                      />
                      <Label htmlFor="multi-select-bank" className="text-sm cursor-pointer">Permettre plusieurs réponses</Label>
                    </div>
                    <div className="space-y-3">
                      {(newQuestion.selectOptions?.choices || []).map((choice, index) => (
                        <div key={index} className="p-3 bg-white border rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700">Choix {index + 1}</span>
                            {(newQuestion.selectOptions?.choices || []).length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newChoices = [...(newQuestion.selectOptions?.choices || [])];
                                  newChoices.splice(index, 1);
                                  setNewQuestion({
                                    ...newQuestion,
                                    selectOptions: { ...newQuestion.selectOptions, choices: newChoices }
                                  });
                                }}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor={`choice-label-${index}`} className="text-xs">Intitulé</Label>
                            <Input
                              id={`choice-label-${index}`}
                              value={choice.label || ''}
                              onChange={(e) => {
                                const newChoices = [...(newQuestion.selectOptions?.choices || [])];
                                newChoices[index] = { ...newChoices[index], label: e.target.value };
                                setNewQuestion({
                                  ...newQuestion,
                                  selectOptions: { ...newQuestion.selectOptions, choices: newChoices }
                                });
                              }}
                              placeholder="Ex: Très bien"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor={`choice-color-${index}`} className="text-xs">Couleur</Label>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowColorPicker(showColorPicker === index ? false : index);
                                  }}
                                  className="flex items-center gap-2 p-2 border rounded-lg hover:bg-slate-50 transition-colors w-full"
                                >
                                  <div 
                                    className="w-6 h-6 rounded-full flex-shrink-0"
                                    style={{ 
                                      backgroundColor: choice.color || '#3b82f6',
                                      border: '1px solid #e2e8f0'
                                    }}
                                  />
                                  <span className="text-xs text-slate-700 truncate">
                                    {predefinedColors.find(c => c.value === choice.color)?.name || 'Personnalisée'}
                                  </span>
                                </button>

                                {showColorPicker === index && (
                                  <div className="absolute z-10 mt-2 p-3 bg-white border rounded-lg shadow-lg w-64">
                                    <div className="grid grid-cols-6 gap-2 mb-2">
                                      {predefinedColors.map((color) => (
                                        <button
                                          key={color.value}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const newChoices = [...(newQuestion.selectOptions?.choices || [])];
                                            newChoices[index] = { ...newChoices[index], color: color.value };
                                            setNewQuestion({
                                              ...newQuestion,
                                              selectOptions: { ...newQuestion.selectOptions, choices: newChoices }
                                            });
                                            setShowColorPicker(false);
                                          }}
                                          title={color.name}
                                        >
                                          <div 
                                            className="w-8 h-8 rounded-full hover:scale-110 transition-transform"
                                            style={{ 
                                              backgroundColor: color.value,
                                              border: '1px solid #e2e8f0'
                                            }}
                                          />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`choice-image-${index}`} className="text-xs">Image</Label>
                              <Input
                                id={`choice-image-file-${index}`}
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const path = `questionnaire-images/${Date.now()}_${file.name}`;
                                    const { error: uploadError } = await supabaseRaw.storage.from('questionnaire-images').upload(path, file, { upsert: true });
                                    if (uploadError) { toast.error('Erreur upload'); return; }
                                    const { data: { publicUrl } } = supabaseRaw.storage.from('questionnaire-images').getPublicUrl(path);
                                    const newChoices = [...(newQuestion.selectOptions?.choices || [])];
                                    newChoices[index] = { ...newChoices[index], image: publicUrl };
                                    setNewQuestion({
                                      ...newQuestion,
                                      selectOptions: { ...newQuestion.selectOptions, choices: newChoices }
                                    });
                                    toast.success('Image téléchargée');
                                  }
                                }}
                                className="text-xs cursor-pointer"
                              />
                              <Input
                                id={`choice-image-url-${index}`}
                                value={choice.image || ''}
                                onChange={(e) => {
                                  const newChoices = [...(newQuestion.selectOptions?.choices || [])];
                                  newChoices[index] = { ...newChoices[index], image: e.target.value };
                                  setNewQuestion({
                                    ...newQuestion,
                                    selectOptions: { ...newQuestion.selectOptions, choices: newChoices }
                                  });
                                }}
                                placeholder="ou URL"
                                className="text-xs"
                              />
                            </div>
                          </div>

                          {choice.image && (
                            <div className="mt-2">
                              <img 
                                src={choice.image} 
                                alt="Aperçu"
                                className="w-16 h-16 object-cover rounded border"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const newChoices = [...(newQuestion.selectOptions?.choices || [])];
                        newChoices.push({ label: '', color: '#3b82f6', image: '' });
                        setNewQuestion({
                          ...newQuestion,
                          selectOptions: { ...newQuestion.selectOptions, choices: newChoices }
                        });
                      }}
                      className="w-full gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Nouveau choix
                    </Button>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSaveQuestion} className="gap-2 flex-1">
                    <Save className="w-4 h-4" />
                    {editingQuestion ? 'Mettre à jour' : 'Enregistrer dans la banque'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {questions.map((question, index) => (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800">{question.label}</p>
                      {question.athleteLabel && (
                        <p className="text-sm text-slate-600 mt-1">
                          Vue athlète: {question.athleteLabel}
                        </p>
                      )}
                      {question.description && (
                        <p className="text-xs text-slate-500 mt-1">{question.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">{question.type}</Badge>
                        {question.required && <Badge variant="outline" className="text-xs bg-amber-50">Obligatoire</Badge>}
                        {question.type === 'scale' && question.scaleOptions && (
                          <>
                            <Badge variant="outline" className="text-xs" style={{ backgroundColor: question.scaleOptions.color + '20', color: question.scaleOptions.color }}>
                              {question.scaleOptions.min} - {question.scaleOptions.max}
                            </Badge>
                            {question.scaleOptions.reversed && (
                              <Badge variant="outline" className="text-xs bg-purple-50">Inversé</Badge>
                            )}
                            {!question.scaleOptions.showNumbers && (
                              <Badge variant="outline" className="text-xs bg-blue-50">Sans chiffres</Badge>
                            )}
                          </>
                        )}
                      </div>

                      {/* Aperçu échelle */}
                      {question.type === 'scale' && question.scaleOptions && (
                        <div className="mt-3 text-xs text-slate-600 flex items-center gap-2">
                          <span className="font-medium">{question.scaleOptions.minLabel}</span>
                          <div
                            className="flex-1 h-2 rounded-full"
                            style={{ background: question.scaleOptions.color || '#3b82f6', opacity: 0.7 }}
                          />
                          <span className="font-medium">{question.scaleOptions.maxLabel}</span>
                        </div>
                      )}

                      {/* Aperçu QCM */}
                      {question.type === 'select' && question.selectOptions?.choices && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {question.selectOptions.choices.map((choice, idx) => (
                            <div
                              key={idx}
                              className="text-xs px-2 py-1 rounded border flex items-center gap-1"
                              style={{
                                backgroundColor: choice.color || '#ffffff',
                                borderColor: '#000000',
                                color: '#000000'
                              }}
                            >
                              {choice.image && (
                                <img
                                  src={choice.image}
                                  alt=""
                                  className="w-4 h-4 object-cover rounded"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              )}
                              {choice.label || `Choix ${idx + 1}`}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(question)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Supprimer cette question de la banque ?')) {
                            deleteMutation.mutate(question.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-700"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {questions.length === 0 && !isCreating && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2"
            >
              <Card>
                <CardContent className="py-12 text-center">
                  <Database className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 text-sm">
                    Aucune question dans la banque pour le moment
                  </p>
                  <p className="text-slate-400 text-xs mt-2">
                    Créez votre première question pour commencer à construire votre bibliothèque
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}