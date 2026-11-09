import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Archive, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Partie « Questionnaires archivés » de la bibliothèque (administrateurs)
export default function ArchivedQuestionnaires({ templates, onRestore, restoring = false }) {
  return (
    <section className="mt-10" aria-labelledby="archived-questionnaires-title">
      <div className="flex items-center gap-2 mb-1">
        <Archive className="w-5 h-5 text-slate-500" />
        <h2 id="archived-questionnaires-title" className="text-xl font-semibold text-slate-800">
          Questionnaires archivés ({templates.length})
        </h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Questionnaires supprimés par les entraîneurs ou les administrateurs. Leurs réponses sont conservées, mais masquées du dashboard tant qu'ils ne sont pas restaurés.
      </p>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-slate-500 text-sm">Aucun questionnaire archivé</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {templates.map(template => (
            <Card key={template.id} className="bg-slate-50">
              <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 break-words">{template.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {template.questions?.length || 0} questions
                    {template.created_by_email && ` · Créé par ${template.created_by_email}`}
                  </p>
                  <p className="text-xs text-slate-500">
                    Archivé le {format(new Date(template.archived_at), 'dd/MM/yyyy', { locale: fr })}
                    {template.archived_by_email && ` par ${template.archived_by_email}`}
                  </p>
                </div>
                <Button variant="outline" className="gap-2 text-sm flex-shrink-0" disabled={restoring} onClick={() => onRestore(template)}>
                  <RotateCcw className="w-4 h-4" />Restaurer
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
