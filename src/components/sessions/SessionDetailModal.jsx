import React, { useState, useRef } from 'react';
import { supabase as base44, supabaseRaw } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Users, FileText, Upload, Trash2, Download, Lock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

const SESSION_CATEGORY_LABELS = {
  seance_terrain: 'Terrain',
  seance_salle: 'Salle',
  recuperation: 'Récupération',
  soins: 'Soins',
  seance_specifique: 'Spécifique',
  competition: 'Compétition',
};

export default function SessionDetailModal({ event, user, open, onClose }) {
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState('');
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const isCoachOrAdmin = user?.user_status === 'admin' ||
    user?.user_status === 'coach' ||
    user?.user_status === 'coach_pro';

  // Charger les documents liés à cette séance
  const { data: documents = [] } = useQuery({
    queryKey: ['session-documents', event?.id],
    queryFn: () => base44.entities.SessionDocument.filter({ event_id: event.id }),
    enabled: !!event?.id && isCoachOrAdmin,
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId) => base44.entities.SessionDocument.delete(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-documents', event?.id] });
      toast.success('Document supprimé');
    }
  });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `session-documents/${event.id}_${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabaseRaw.storage.from('session-documents').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabaseRaw.storage.from('session-documents').getPublicUrl(path);
      await base44.entities.SessionDocument.create({
        event_id: event.id,
        file_name: file.name,
        file_url: publicUrl,
        uploaded_by: user.email,
      });
      queryClient.invalidateQueries({ queryKey: ['session-documents', event?.id] });
      toast.success('Document importé');
    } catch (err) {
      toast.error('Erreur lors de l\'import');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  React.useEffect(() => {
    setDescription(event?.description || '');
  }, [event?.id]);

  const handleDescriptionBlur = async () => {
    if (description === (event.description || '')) return;
    await base44.entities.Event.update(event.id, { description });
    queryClient.invalidateQueries({ queryKey: ['all-sessions'] });
    toast.success('Description mise à jour');
  };

  if (!event) return null;

  const date = parseISO(event.event_date);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: event.session_color || '#6366f1' }}
            />
            {event.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Infos générales */}
          <div
            className="p-4 rounded-xl border-l-4 bg-slate-50"
            style={{ borderLeftColor: event.session_color || '#6366f1' }}
          >
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>{format(date, 'EEEE d MMMM yyyy', { locale: fr })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>
                  {event.start_time}{event.end_time ? ` - ${event.end_time}` : ''}
                  {event.duration_minutes ? ` (${event.duration_minutes} min)` : ''}
                </span>
              </div>
              {event.session_category && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {SESSION_CATEGORY_LABELS[event.session_category] || event.session_category}
                  </Badge>
                </div>
              )}
              {event.theme && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">Thème :</span>
                  <span>{event.theme}</span>
                </div>
              )}
              {event.assigned_athletes?.length > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 flex-shrink-0" />
                  <span>{event.assigned_athletes.length} athlète(s) assigné(s)</span>
                </div>
              )}
            </div>
          </div>

          {/* Description (visible par tous) */}
          {event.description && !isCoachOrAdmin && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Description
              </h3>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}

          {/* Section réservée coaches/admins */}
          {isCoachOrAdmin && (
            <>
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                    Visible entraîneur / admin uniquement
                  </span>
                </div>

                {/* Description coach */}
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Description
                  </h3>
                  <textarea
                    className="w-full text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border border-transparent hover:border-slate-200 focus:border-slate-300 focus:outline-none resize-none transition-colors min-h-[80px]"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    onBlur={handleDescriptionBlur}
                    placeholder="Ajouter une description..."
                  />
                </div>

                {/* Documents */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Upload className="w-4 h-4" /> Documents
                    </h3>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleUpload}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? 'Import...' : 'Importer'}
                      </Button>
                    </div>
                  </div>

                  {documents.length === 0 ? (
                    <p className="text-sm text-slate-400 italic py-2">Aucun document</p>
                  ) : (
                    <div className="space-y-2">
                      {documents.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-sm text-slate-700 truncate flex-1 mr-2">{doc.file_name}</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                              <Button size="icon" variant="ghost" className="h-7 w-7">
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-500 hover:text-red-700"
                              onClick={() => deleteDocMutation.mutate(doc.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}