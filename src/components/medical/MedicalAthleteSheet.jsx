import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Plus, Edit2, CheckCircle2, Trash2, CalendarDays, Clock } from 'lucide-react';
import StatusBadge from './StatusBadge';
import {
  INJURY_STATUSES, INJURY_TYPES, BODY_LOCATIONS, SIDES, SEVERITIES, CONTEXTS,
  labelOf, formatDate, daysBetween, todayISO,
} from '@/lib/medical';

const ageFrom = (birthDate) => {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age--;
  return age;
};

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value ?? '—'}</p>
    </div>
  );
}

function injuryTitle(injury) {
  const loc = labelOf(BODY_LOCATIONS, injury.body_location);
  const side = injury.side && injury.side !== 'na' ? ` ${labelOf(SIDES, injury.side).toLowerCase()}` : '';
  return `${labelOf(INJURY_TYPES, injury.injury_type)} · ${loc}${side}`;
}

function InjuryDetails({ injury }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <InfoItem label="Type" value={labelOf(INJURY_TYPES, injury.injury_type)} />
      <InfoItem label="Localisation" value={labelOf(BODY_LOCATIONS, injury.body_location)} />
      <InfoItem label="Côté" value={labelOf(SIDES, injury.side)} />
      <InfoItem label="Gravité" value={labelOf(SEVERITIES, injury.severity)} />
      <InfoItem label="Circonstances" value={labelOf(CONTEXTS, injury.context)} />
      <InfoItem label="Récidive" value={injury.is_recurrence ? 'Oui' : 'Non'} />
      <InfoItem label="Date de blessure" value={formatDate(injury.injury_date)} />
      <InfoItem label="Retour prévu" value={formatDate(injury.expected_return_date)} />
      <InfoItem label={injury.end_date ? 'Fin de blessure' : 'Jours écoulés'}
        value={injury.end_date ? formatDate(injury.end_date) : `${daysBetween(injury.injury_date)} j`} />
      {injury.diagnosis && <div className="col-span-2 sm:col-span-3"><InfoItem label="Diagnostic" value={injury.diagnosis} /></div>}
      {injury.practitioner && <div className="col-span-2 sm:col-span-3"><InfoItem label="Suivi par" value={injury.practitioner} /></div>}
      {injury.notes && (
        <div className="col-span-2 sm:col-span-3">
          <p className="text-xs text-slate-500">Notes</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{injury.notes}</p>
        </div>
      )}
    </div>
  );
}

function StatusTimeline({ history }) {
  if (!history?.length) return null;
  return (
    <ol className="relative border-l border-slate-200 ml-2 space-y-3">
      {history.map((h, i) => (
        <li key={i} className="ml-4">
          <span className="absolute -left-[5px] w-2.5 h-2.5 rounded-full bg-slate-300 mt-1.5" />
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={h.status} />
            <span className="text-xs text-slate-500">{formatDate(h.date)}</span>
          </div>
          {h.note && <p className="text-xs text-slate-600 mt-1">{h.note}</p>}
        </li>
      ))}
    </ol>
  );
}

/**
 * Fiche médicale d'un athlète : infos joueur, blessure en cours avec ses
 * changements de statut, et historique des blessures clôturées.
 */
export default function MedicalAthleteSheet({
  open, onOpenChange, athlete, injuries,
  onNewInjury, onEditInjury, onChangeStatus, onCloseInjury, onDeleteInjury, saving,
}) {
  const [statusDate, setStatusDate] = useState(todayISO());
  const [statusNote, setStatusNote] = useState('');
  const [closeDate, setCloseDate] = useState(todayISO());
  const [confirmClose, setConfirmClose] = useState(false);

  if (!athlete) return null;
  const profile = athlete.profile || {};
  const current = injuries.find(i => !i.end_date);
  const past = injuries.filter(i => i.end_date);
  const totalDaysOut = past.reduce((sum, i) => sum + daysBetween(i.injury_date, i.end_date), 0)
    + (current ? daysBetween(current.injury_date) : 0);
  const age = ageFrom(profile.birth_date || athlete.birth_date);

  const changeStatus = (status) => {
    onChangeStatus(current, status, statusDate, statusNote.trim());
    setStatusNote('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fiche médicale</DialogTitle>
        </DialogHeader>

        {/* En-tête joueur */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          {profile.photo_url || athlete.avatar_url ? (
            <img src={profile.photo_url || athlete.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <User className="w-8 h-8 text-slate-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800 truncate">{athlete.name}</h2>
              <StatusBadge status={current?.status} />
            </div>
            <p className="text-sm text-slate-500 truncate">{athlete.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-lg bg-slate-50 p-3">
          <InfoItem label="Âge" value={age != null ? `${age} ans` : null} />
          <InfoItem label="Sport" value={profile.sport} />
          <InfoItem label="Poste" value={profile.position} />
          <InfoItem label="Taille" value={profile.height_cm ? `${profile.height_cm} cm` : null} />
          <InfoItem label="Poids" value={profile.weight_kg ? `${profile.weight_kg} kg` : null} />
          <InfoItem label="Blessures" value={injuries.length} />
          <InfoItem label="Jours d'absence (total)" value={`${totalDaysOut} j`} />
        </div>

        {/* Blessure en cours */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-800">Blessure en cours</h3>
            {!current && (
              <Button size="sm" onClick={onNewInjury}><Plus className="w-4 h-4 mr-1" /> Déclarer une blessure</Button>
            )}
          </div>

          {!current ? (
            <p className="text-sm text-slate-500">Aucune blessure en cours : l'athlète est disponible.</p>
          ) : (
            <div className="rounded-lg border border-slate-200 p-4 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-slate-800">{injuryTitle(current)}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onEditInjury(current)}>
                    <Edit2 className="w-4 h-4 mr-1" /> Modifier
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700"
                    onClick={() => onDeleteInjury(current)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <InjuryDetails injury={current} />

              {/* Changement de statut */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-semibold text-slate-700">Changer de statut</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Date du changement</Label>
                    <Input type="date" value={statusDate} onChange={e => setStatusDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Note (optionnel)</Label>
                    <Input value={statusNote} onChange={e => setStatusNote(e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {INJURY_STATUSES.map(s => (
                    <Button key={s.value} size="sm" variant="outline" disabled={saving || s.value === current.status || !statusDate}
                      onClick={() => changeStatus(s.value)}>
                      <span className={`w-2 h-2 rounded-full mr-2 ${s.dot}`} />{s.label}
                    </Button>
                  ))}
                </div>

                {!confirmClose ? (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setConfirmClose(true)}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Fin de blessure (retour disponible)
                  </Button>
                ) : (
                  <div className="flex flex-wrap items-end gap-2 rounded-lg bg-green-50 p-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Date de fin de blessure</Label>
                      <Input type="date" value={closeDate} min={current.injury_date} onChange={e => setCloseDate(e.target.value)} />
                    </div>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={saving || !closeDate}
                      onClick={() => { onCloseInjury(current, closeDate); setConfirmClose(false); }}>
                      Confirmer
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmClose(false)}>Annuler</Button>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">Évolution du statut</p>
                <StatusTimeline history={current.status_history} />
              </div>
            </div>
          )}
        </section>

        {/* Historique */}
        <section className="space-y-3">
          <h3 className="font-semibold text-slate-800">Historique des blessures</h3>
          {past.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune blessure passée.</p>
          ) : (
            <div className="space-y-2">
              {past.map(inj => (
                <details key={inj.id} className="rounded-lg border border-slate-200 p-3 group">
                  <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{injuryTitle(inj)}</span>
                    <span className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />
                        {formatDate(inj.injury_date)} → {formatDate(inj.end_date)}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />
                        {daysBetween(inj.injury_date, inj.end_date)} j</span>
                    </span>
                  </summary>
                  <div className="pt-3 space-y-4">
                    <InjuryDetails injury={inj} />
                    <StatusTimeline history={inj.status_history} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => onEditInjury(inj)}>
                        <Edit2 className="w-4 h-4 mr-1" /> Modifier
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700"
                        onClick={() => onDeleteInjury(inj)}>
                        <Trash2 className="w-4 h-4 mr-1" /> Supprimer
                      </Button>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
