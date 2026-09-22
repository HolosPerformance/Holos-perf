import React, { useState } from 'react';
import { supabase as base44, supabaseRaw } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Edit2, Trash2, Save, X, GripVertical, Copy, Database, ClipboardList
} from 'lucide-react';
import QuestionForm from './QuestionForm';

const EMPTY_QUESTION = {
  id: '', label: '', athleteLabel: '', description: '', type: 'scale', required: false,
  options: [], condition: null,
  selectOptions: { choices: [
    { label: '', color: '#3b82f6', image: '' },
    { label: '', color: '#34a853', image: '' }
  ]},
  scaleOptions: { min: 0, max: 100, reversed: false, showNumbers: false, minLabel: '0', maxLabel: '100', color: '#3b82f6' }
};



function AthletePreview({ questionnaire }) {
  const [responses, setResponses] = useState({});
  return (
    <Card className="bg-white">
      <CardContent className="p-6">
        <div className="space-y-6">
          {questionnaire.style?.headerImage ? (
            <div className="flex items-start gap-4">
              <img src={questionnaire.style.headerImage} alt="Logo" className="w-16 h-16 object-cover rounded-lg" onError={(e) => { e.target.style.display = 'none'; }} />
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{questionnaire.name}</h2>
                {questionnaire.description && <p className="text-slate-600 text-sm mt-1">{questionnaire.description}</p>}
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{questionnaire.name}</h2>
              {questionnaire.description && <p className="text-slate-600 text-sm mt-1">{questionnaire.description}</p>}
            </div>
          )}
          <div className="space-y-6">
            {questionnaire.questions.map((q, index) => {
              if (q.condition) {
                const expectedValues = q.condition.expectedValues?.length > 0
                  ? q.condition.expectedValues
                  : (q.condition.expectedValue ? [q.condition.expectedValue] : []);
                const answer = responses[q.condition.questionId];
                const met = Array.isArray(answer)
                  ? answer.some(a => expectedValues.includes(a))
                  : expectedValues.includes(answer);
                if (q.condition.type === 'show' && !met) return null;
                if (q.condition.type === 'hide' && met) return null;
              }
              return (
                <div key={q.id} className="space-y-3">
                  <Label className="text-base font-medium">
                    {index + 1}. {q.athleteLabel || q.label}
                    {q.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  {q.description && <p className="text-sm text-slate-600">{q.description}</p>}
                  {q.type === 'scale' && q.scaleOptions && (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>{q.scaleOptions.minLabel}</span><span>{q.scaleOptions.maxLabel}</span>
                      </div>
                      <input type="range" min={q.scaleOptions.min} max={q.scaleOptions.max}
                        value={responses[q.id] ?? Math.round((q.scaleOptions.min + q.scaleOptions.max) / 2)}
                        onChange={(e) => setResponses({ ...responses, [q.id]: Number(e.target.value) })}
                        className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                        style={{ background: q.scaleOptions.color || '#3b82f6', transform: q.scaleOptions.reversed ? 'scaleX(-1)' : 'none' }}
                      />
                      {q.scaleOptions.showNumbers && (
                        <div className="text-center text-lg font-semibold" style={{ color: q.scaleOptions.color }}>
                          {responses[q.id] ?? Math.round((q.scaleOptions.min + q.scaleOptions.max) / 2)}
                        </div>
                      )}
                    </div>
                  )}
                  {q.type === 'text' && <Input placeholder="Votre réponse..." />}
                  {q.type === 'textarea' && <Textarea placeholder="Votre réponse..." rows={3} />}
                  {q.type === 'number' && <Input type="number" placeholder="0" />}
                  {q.type === 'select' && q.selectOptions?.choices && (
                    <div className="grid grid-cols-2 gap-3">
                      {q.selectOptions.choices.map((choice, ci) => {
                        const isBlack = ['#000000', '#000', 'black'].includes(choice.color?.toLowerCase());
                        const label = choice.label || `Choix ${ci + 1}`;
                        return (
                          <button key={ci} type="button"
                            onClick={() => setResponses({ ...responses, [q.id]: label })}
                            className="flex items-center gap-3 p-3 border-2 rounded-lg transition-all hover:scale-105"
                            style={{ backgroundColor: choice.color || '#ffffff', borderColor: '#000', boxShadow: responses[q.id] === label ? '0 0 0 3px rgba(0,0,0,0.35)' : 'none' }}
                          >
                            {choice.image && <div className="w-16 h-16 rounded overflow-hidden"><img src={choice.image} alt={label} className="w-full h-full object-cover" /></div>}
                            <div className="flex-1 text-left font-medium" style={{ color: isBlack ? '#fff' : '#000' }}>{label}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {questionnaire.questions.length === 0 && <p className="text-center text-slate-500 py-8">Aucune question pour le moment</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function QuestionnaireEditorFull({ user, template, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    questions: template?.questions || [],
    is_active: template?.is_active ?? true,
    style: template?.style || { headerImage: '' }
  });
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [previewValue, setPreviewValue] = useState(50);
  const [showQuestionBank, setShowQuestionBank] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  const handleToggleActive = (checked) => {
    if (!checked && (template?.assigned_athletes || []).length > 0) {
      setShowDeactivateDialog(true);
    } else {
      setFormData({ ...formData, is_active: checked });
    }
  };

  const confirmDeactivate = () => {
    setFormData({ ...formData, is_active: false, _clearAssignments: true });
    setShowDeactivateDialog(false);
  };
  const [newQuestion, setNewQuestion] = useState({ ...EMPTY_QUESTION });

  const isAdmin = user?.user_status === 'admin';
  const isCoachPro = user?.user_status === 'coach_pro';
  const canCreateQuestionnaire = isAdmin || isCoachPro;

  const qc = useQueryClient();
  const { data: questionBankItems = [] } = useQuery({
    queryKey: ['question-bank-items'],
    queryFn: () => base44.entities.QuestionBankItem.list('-created_at', 200),
    enabled: canCreateQuestionnaire,
  });

  const addToBankMutation = useMutation({
    mutationFn: (question) => {
      const payload = {
        label: question.label,
        athleteLabel: question.athleteLabel || '',
        description: question.description || '',
        type: question.type,
        required: question.required || false,
        created_by_email: user.email,
      };
      if (question.type === 'select' && question.selectOptions) payload.selectOptions = question.selectOptions;
      if (question.type === 'scale' && question.scaleOptions) payload.scaleOptions = question.scaleOptions;
      return base44.entities.QuestionBankItem.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['question-bank-items'] });
      toast.success('Question ajoutée à la banque');
    },
    onError: (e) => {
      toast.error(`Impossible d'ajouter à la banque : ${e.message}`);
    },
  });

  const resetQuestion = () => setNewQuestion({ ...EMPTY_QUESTION, selectOptions: { choices: [
    { label: '', color: '#3b82f6', image: '' }, { label: '', color: '#34a853', image: '' }
  ]}, scaleOptions: { min: 0, max: 100, reversed: false, showNumbers: false, minLabel: '0', maxLabel: '100', color: '#3b82f6' } });

  const addQuestion = () => {
    if (!newQuestion.label) { toast.error('Le libellé est obligatoire'); return; }
    const q = {
      ...newQuestion,
      selectOptions: newQuestion.type === 'select' ? newQuestion.selectOptions : undefined,
      scaleOptions: newQuestion.type === 'scale' ? newQuestion.scaleOptions : undefined,
    };
    if (editingQuestionId) {
      setFormData({ ...formData, questions: formData.questions.map(x => x.id === editingQuestionId ? { ...q, id: editingQuestionId } : x) });
      setEditingQuestionId(null);
    } else {
      setFormData({ ...formData, questions: [...formData.questions, { ...q, id: Date.now().toString() }] });
    }
    resetQuestion(); setIsAddingQuestion(false); setShowColorPicker(false);
  };

  const editQuestion = (q) => {
    setNewQuestion({
      ...q,
      selectOptions: q.selectOptions || { choices: [{ label: '', color: '#3b82f6', image: '' }] },
      scaleOptions: q.scaleOptions || { min: 0, max: 100, reversed: false, showNumbers: false, minLabel: '0', maxLabel: '100', color: '#3b82f6' }
    });
    setEditingQuestionId(q.id); setIsAddingQuestion(true); setShowColorPicker(false);
  };

  const cancelEdit = () => { resetQuestion(); setEditingQuestionId(null); setIsAddingQuestion(false); setShowColorPicker(false); };

  const removeQuestion = (id) => setFormData({ ...formData, questions: formData.questions.filter(q => q.id !== id) });

  const duplicateQuestion = (q) => {
    setFormData({ ...formData, questions: [...formData.questions, { ...q, id: Date.now().toString(), label: `${q.label} (copie)` }] });
    toast.success('Question dupliquée');
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const qs = Array.from(formData.questions);
    const [item] = qs.splice(result.source.index, 1);
    qs.splice(result.destination.index, 0, item);
    setFormData({ ...formData, questions: qs });
  };

  const addQuestionFromBank = (bq) => {
    const q = { ...bq, id: Date.now().toString() };
    delete q.created_by_email; delete q.created_date; delete q.updated_date; delete q.created_by;
    setFormData({ ...formData, questions: [...formData.questions, q] });
    toast.success('Question ajoutée depuis la banque');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.questions.length === 0) { toast.error('Ajoutez au moins une question'); return; }
    const dataToSave = { ...formData, last_modified_by_email: user.email };
    if (dataToSave._clearAssignments) {
      dataToSave.assigned_athletes = [];
      delete dataToSave._clearAssignments;
    }
    onSave(dataToSave);
  };



  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="outline" onClick={onCancel} className="gap-2 mb-4"><ArrowLeft className="w-4 h-4" />Retour</Button>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">{template ? 'Modifier le questionnaire' : 'Créer un questionnaire'}</h1>
        </div>
        <div className="flex gap-4 mb-6">
          <Button type="button" variant={!showPreview ? "default" : "outline"} onClick={() => setShowPreview(false)}>Édition</Button>
          <Button type="button" variant={showPreview ? "default" : "outline"} onClick={() => setShowPreview(true)}>Aperçu athlète</Button>
        </div>
        {showPreview ? <AthletePreview questionnaire={formData} /> : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Informations générales</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                  <div>
                    <Label className="font-medium">Statut du questionnaire</Label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formData.is_active ? 'Actif — les athlètes peuvent y répondre' : 'Inactif — les athlètes n\'ont pas accès'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${formData.is_active ? 'text-green-600' : 'text-slate-400'}`}>
                      {formData.is_active ? 'Actif' : 'Inactif'}
                    </span>
                    <Switch checked={formData.is_active} onCheckedChange={handleToggleActive} />
                  </div>
                </div>
                <div className="space-y-2"><Label>Nom du questionnaire *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="Ex: Évaluation mensuelle" /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Décrivez l'objectif de ce questionnaire" rows={3} /></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Image d'en-tête</CardTitle></CardHeader>
              <CardContent>
                <Input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) { const path = `questionnaire-images/${Date.now()}_${file.name}`; const { error: uploadError } = await supabaseRaw.storage.from('questionnaire-images').upload(path, file, { upsert: true }); if (uploadError) { toast.error('Erreur upload'); return; } const { data: { publicUrl } } = supabaseRaw.storage.from('questionnaire-images').getPublicUrl(path); setFormData({ ...formData, style: { ...formData.style, headerImage: publicUrl } }); toast.success('Image téléchargée'); } }} className="cursor-pointer mb-2" />
                <Input value={formData.style?.headerImage || ''} onChange={(e) => setFormData({ ...formData, style: { ...formData.style, headerImage: e.target.value } })} placeholder="ou collez l'URL de l'image" />
                {formData.style?.headerImage && <img src={formData.style.headerImage} alt="Aperçu" className="w-32 h-32 object-cover rounded border mt-2" onError={(e) => { e.target.style.display = 'none'; }} />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Questions ({formData.questions.length})</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="questions">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                        {formData.questions.map((q, index) => (
                          <Draggable key={q.id} draggableId={q.id} index={index}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.draggableProps} className={snapshot.isDragging ? 'shadow-2xl' : ''}>
                                <div className="p-4 border rounded-lg bg-slate-50 space-y-2">
                                  <div className="flex items-start gap-3">
                                    <div {...provided.dragHandleProps} className="pt-1 cursor-grab active:cursor-grabbing"><GripVertical className="w-5 h-5 text-slate-400" /></div>
                                    <div className="flex-1">
                                      <p className="font-medium text-slate-800">{index + 1}. {q.label}</p>
                                      {q.athleteLabel && <p className="text-sm text-slate-600 mt-1">Vue athlète: {q.athleteLabel}</p>}
                                      <div className="flex flex-wrap gap-2 mt-2">
                                        <Badge variant="outline" className="text-xs">{q.type}</Badge>
                                        {q.required && <Badge variant="outline" className="text-xs bg-amber-50">Obligatoire</Badge>}
                                        {q.condition && <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">Conditionnelle</Badge>}
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button type="button" variant="ghost" size="icon" onClick={() => editQuestion(q)} className="text-blue-600 hover:text-blue-700"><Edit2 className="w-4 h-4" /></Button>
                                      <Button type="button" variant="ghost" size="icon" onClick={() => duplicateQuestion(q)} className="text-green-600 hover:text-green-700"><Copy className="w-4 h-4" /></Button>
                                      {isAdmin && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => addToBankMutation.mutate(q)}
                                          disabled={addToBankMutation.isPending}
                                          className="text-purple-600 hover:text-purple-700"
                                          title="Ajouter à la banque"
                                        >
                                          <Database className={`w-4 h-4 ${addToBankMutation.isPending ? 'animate-pulse' : ''}`} />
                                        </Button>
                                      )}
                                      <Button type="button" variant="ghost" size="icon" onClick={() => removeQuestion(q.id)} className="text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                  </div>
                                </div>
                                {editingQuestionId === q.id && <QuestionForm isEditing={true} newQuestion={newQuestion} setNewQuestion={setNewQuestion} formData={formData} editingQuestionId={editingQuestionId} addQuestion={addQuestion} cancelEdit={cancelEdit} previewValue={previewValue} setPreviewValue={setPreviewValue} />}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
                {!isAddingQuestion && !editingQuestionId && (
                  <div className="space-y-2">
                    <Button type="button" onClick={() => { setIsAddingQuestion(true); setEditingQuestionId(null); resetQuestion(); }} variant="outline" className="gap-2 w-full"><Plus className="w-4 h-4" />Créer une nouvelle question</Button>
                    {canCreateQuestionnaire && (
                      <Button type="button" onClick={() => setShowQuestionBank(true)} variant="outline" className="gap-2 w-full border-purple-300 text-purple-700 hover:bg-purple-50">
                        <ClipboardList className="w-4 h-4" />Banque de questions ({questionBankItems.length})
                      </Button>
                    )}
                  </div>
                )}
                {isAddingQuestion && !editingQuestionId && <QuestionForm isEditing={false} newQuestion={newQuestion} setNewQuestion={setNewQuestion} formData={formData} editingQuestionId={editingQuestionId} addQuestion={addQuestion} cancelEdit={cancelEdit} previewValue={previewValue} setPreviewValue={setPreviewValue} />}
              </CardContent>
            </Card>
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto"><X className="w-4 h-4 mr-2" />Annuler</Button>
              <Button type="submit" className="gap-2 w-full sm:w-auto"><Save className="w-4 h-4" />Enregistrer</Button>
            </div>
          </form>
        )}
        <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Désactiver le questionnaire ?</AlertDialogTitle>
              <AlertDialogDescription>
                En rendant ce questionnaire inactif, les athlètes qui y sont actuellement assignés perdront l'accès et ne pourront plus y répondre. Voulez-vous continuer ?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeactivate} className="bg-red-600 hover:bg-red-700">Désactiver</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={showQuestionBank} onOpenChange={setShowQuestionBank}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Database className="w-5 h-5 text-purple-600" />Banque de questions</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-4">
              {questionBankItems.length === 0 ? (
                <div className="text-center py-8 text-slate-500"><Database className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Aucune question dans la banque</p></div>
              ) : questionBankItems.map((q) => (
                <Card key={q.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">{q.label}</p>
                        {q.athleteLabel && <p className="text-sm text-slate-600 mt-1">Vue athlète: {q.athleteLabel}</p>}
                        {q.description && <p className="text-xs text-slate-500 mt-1">{q.description}</p>}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">{q.type}</Badge>
                          {q.required && <Badge variant="outline" className="text-xs bg-amber-50">Obligatoire</Badge>}
                        </div>
                      </div>
                      <Button onClick={() => { addQuestionFromBank(q); setShowQuestionBank(false); }} size="sm" className="gap-2"><Plus className="w-4 h-4" />Ajouter</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}