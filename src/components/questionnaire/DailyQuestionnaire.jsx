import React, { useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import SessionTypeSelector from './SessionTypeSelector';
import AnalogScale from './AnalogScale';
import BodyPainSelector from './BodyPainSelector';
import { CheckCircle, Loader2, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const markers = [
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'intensite', label: 'Intensité' },
  { key: 'sommeil', label: 'Sommeil' },
  { key: 'plaisir', label: 'Plaisir' },
  { key: 'harmonie_proches', label: 'Harmonie avec les proches' },
  { key: 'maitrise_technique', label: 'Maîtrise technique' },
  { key: 'maitrise_tactique', label: 'Maîtrise tactique' },
  { key: 'epanouissement', label: 'Épanouissement personnel' }
];

export default function DailyQuestionnaire({ user, onComplete, existingLog }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const [formData, setFormData] = useState({
    session_type: existingLog?.session_type || '',
    duration_minutes: existingLog?.duration_minutes || '',
    contenu_seance: existingLog?.contenu_seance || '',
    douleurs_zones: existingLog?.douleurs_zones || {},
    fatigue: existingLog?.fatigue ?? 50,
    intensite: existingLog?.intensite ?? 50,
    sommeil: existingLog?.sommeil ?? 50,
    plaisir: existingLog?.plaisir ?? 50,
    harmonie_proches: existingLog?.harmonie_proches ?? 50,
    maitrise_technique: existingLog?.maitrise_technique ?? 50,
    maitrise_tactique: existingLog?.maitrise_tactique ?? 50,
    epanouissement: existingLog?.epanouissement ?? 50,
    commentaire: existingLog?.commentaire || ''
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.session_type) {
      toast.error('Veuillez sélectionner un type de séance');
      return;
    }

    if (!formData.duration_minutes) {
      toast.error('Veuillez indiquer la durée de la séance');
      return;
    }

    if (!formData.contenu_seance || !formData.contenu_seance.trim()) {
      toast.error('Veuillez décrire le contenu de la séance');
      return;
    }

    setIsSubmitting(true);

    const logData = {
      ...formData,
      athlete_email: user.email,
      athlete_name: user.full_name,
      training_date: format(new Date(), 'yyyy-MM-dd'),
      duration_minutes: formData.duration_minutes ? Number(formData.duration_minutes) : null
    };

    if (existingLog) {
      await base44.entities.TrainingLog.update(existingLog.id, logData);
    } else {
      await base44.entities.TrainingLog.create(logData);
    }

    setSubmitted(true);
    toast.success('Questionnaire enregistré !');
    
    if (onComplete) {
      setTimeout(() => onComplete(), 1500);
    }
  };

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
            <p className="text-slate-500 mt-1">Ton questionnaire a été enregistré</p>
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="block">Questionnaire du jour</span>
            <span className="text-sm font-normal text-slate-500">
              {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Type de séance */}
          <SessionTypeSelector 
            value={formData.session_type}
            onChange={(v) => updateField('session_type', v)}
          />

          {/* Durée */}
          <div className="space-y-2">
            <Label>Durée de la séance (minutes) *</Label>
            <Input
              type="number"
              value={formData.duration_minutes}
              onChange={(e) => updateField('duration_minutes', e.target.value)}
              placeholder="ex: 90"
              className="h-12"
              required
            />
          </div>

          {/* Contenu de la séance */}
          <div className="space-y-2">
            <Label>Contenu de la séance *</Label>
            <Textarea
              value={formData.contenu_seance}
              onChange={(e) => updateField('contenu_seance', e.target.value)}
              placeholder="Décris brièvement ta séance (ex: Fractionné 10x400m, musculation haut du corps...)"
              className="min-h-[80px]"
              required
            />
          </div>

          {/* Échelles analogiques */}
          <div className="space-y-6 pt-4 border-t border-slate-100">
            <h3 className="font-medium text-slate-800">Évaluation de la séance *</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {markers.map(marker => (
                <AnalogScale
                  key={marker.key}
                  label={marker.label}
                  value={formData[marker.key]}
                  onChange={(v) => updateField(marker.key, v)}
                />
              ))}
            </div>
          </div>

          {/* Évaluation de la douleur */}
          <div className="space-y-2 pt-4 border-t border-slate-100">
            <BodyPainSelector
              value={formData.douleurs_zones}
              onChange={(v) => updateField('douleurs_zones', v)}
            />
          </div>

          {/* Commentaire */}
          <div className="space-y-2 pt-4 border-t border-slate-100">
            <Label>Commentaire (optionnel)</Label>
            <Textarea
              value={formData.commentaire}
              onChange={(e) => updateField('commentaire', e.target.value)}
              placeholder="Ajoute un commentaire si tu le souhaites..."
              className="min-h-[100px]"
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-slate-800 hover:bg-slate-700 text-base"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                {existingLog ? 'Mettre à jour' : 'Envoyer le questionnaire'}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}