import React, { useState, useEffect } from 'react';
import { supabase as base44, supabaseRaw } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, Link as LinkIcon, Copy, Check, Trash2, UserPlus, X, ClipboardList, ShieldCheck, Eye, EyeOff, ListChecks } from 'lucide-react';
import ClubTeamsSection from '@/components/ClubTeamsSection';
import ColorPicker from '@/components/ui/ColorPicker';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from "sonner";

function hexToHsl(hex) {
  if (!hex || !hex.startsWith('#')) return null;
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function generateToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default function ClubDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const clubId = urlParams.get('id');
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { user: currentUser } = useAuth();
  const [form, setForm] = useState({ name: '', primary_color: '#1e293b', secondary_color: '#ffffff' });
  const [savingQuestionnaire, setSavingQuestionnaire] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [logoFile, setLogoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);
  const [showPrimaryPicker, setShowPrimaryPicker] = useState(false);
  const [showSecondaryPicker, setShowSecondaryPicker] = useState(false);

  const { data: club, isLoading } = useQuery({
    queryKey: ['club', clubId],
    queryFn: () => base44.entities.Club.filter({ id: clubId }).then(r => r[0] || null),
    enabled: !!clubId,
  });

  const isCoach = currentUser?.user_status === 'coach' || currentUser?.user_status === 'coach_pro';
  const isAdmin = currentUser?.user_status === 'admin';

  const { data: templates = [] } = useQuery({
    queryKey: ['questionnaire-templates-club'],
    queryFn: () => base44.entities.QuestionnaireTemplate.list(),
    enabled: !!(isAdmin || isCoach),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-club'],
    queryFn: () => base44.entities.User.list(),
  });

  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (club && !initialized) {
      setForm({
        name: club.name || '',
        primary_color: club.primary_color || '#1e293b',
        secondary_color: club.secondary_color || '#ffffff',
      });
      // Initialiser les questionnaires sélectionnés (migration depuis l'ancien champ)
      const ids = club.default_questionnaire_template_ids?.length
        ? club.default_questionnaire_template_ids
        : club.default_questionnaire_template_id
          ? [club.default_questionnaire_template_id]
          : [];
      setSelectedTemplateIds(ids);
      setInitialized(true);
    }
  }, [club, initialized]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Club.update(clubId, data),
    onSuccess: () => {
      qc.invalidateQueries(['club', clubId]);
      qc.invalidateQueries(['clubs']);
    },
  });

  const handleSaveInfo = async () => {
    setSaving(true);
    let logo_url = club?.logo_url || '';
    if (logoFile) {
      setUploading(true);
      const ext = logoFile.name.split('.').pop();
      const path = `clubs/${clubId}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabaseRaw.storage.from('clubs').upload(path, logoFile, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabaseRaw.storage.from('clubs').getPublicUrl(path);
      logo_url = publicUrl;
      setUploading(false);
      setLogoFile(null);
    }
    await updateMutation.mutateAsync({ ...form, logo_url });

    // Appliquer les couleurs en direct
    const primaryHsl = hexToHsl(form.primary_color);
    if (primaryHsl) {
      document.documentElement.style.setProperty('--primary', primaryHsl);
      document.documentElement.style.setProperty('--brand-color', form.primary_color);
    }

    setSaving(false);
    toast.success('Club mis à jour avec succès');
  };

  const handleSaveAccess = async (field, value) => {
    setSavingAccess(true);
    // Mettre à jour le club
    await updateMutation.mutateAsync({ [field]: value });
    // Mettre à jour tous les athlètes du club
    const athleteEmails = club.athlete_emails || [];
    const usersToUpdate = allUsers.filter(u => athleteEmails.includes(u.email));
    await Promise.all(
      usersToUpdate.map(u => base44.entities.User.update(u.id, { [field]: value }))
    );
    setSavingAccess(false);
    toast.success('Accès mis à jour pour tous les athlètes du club');
  };

  const handleDeleteClub = async () => {
    if (!confirm(`Supprimer le club "${club?.name}" ? Cette action est irréversible.`)) return;
    await base44.entities.Club.delete(clubId);
    navigate(createPageUrl('ClubManagement'));
  };

  const addUser = async (email, role) => {
    const field = role === 'coach' ? 'coach_emails' : 'athlete_emails';
    const current = club[field] || [];
    if (current.includes(email)) return;
    // Remove from other field if present
    const otherField = role === 'coach' ? 'athlete_emails' : 'coach_emails';
    const otherCurrent = (club[otherField] || []).filter(e => e !== email);
    await updateMutation.mutateAsync({ [field]: [...current, email], [otherField]: otherCurrent });
    // Si c'est un athlète, appliquer les accès du club
    if (role === 'athlete') {
      const userToUpdate = allUsers.find(u => u.email === email);
      if (userToUpdate) {
        await base44.entities.User.update(userToUpdate.id, {
          can_access_subjective_data_page: club.can_access_subjective_data_page !== false,
          can_access_objective_data_page: club.can_access_objective_data_page !== false,
        });
      }
    }
  };

  const removeUser = async (email, role) => {
    const field = role === 'coach' ? 'coach_emails' : 'athlete_emails';
    const current = (club[field] || []).filter(e => e !== email);
    await updateMutation.mutateAsync({ [field]: current });
  };

  const generateInviteLink = async (role) => {
    const token = generateToken();
    const currentLinks = club.invite_links || [];
    await updateMutation.mutateAsync({ invite_links: [...currentLinks, { token, role, created_at: new Date().toISOString() }] });
  };

  const deleteInviteLink = async (token) => {
    const currentLinks = (club.invite_links || []).filter(l => l.token !== token);
    await updateMutation.mutateAsync({ invite_links: currentLinks });
  };

  const toggleQuestionnaire = async (templateId) => {
    const currentIds = selectedTemplateIds;
    const newIds = currentIds.includes(templateId)
      ? currentIds.filter(id => id !== templateId)
      : [...currentIds, templateId];
    setSelectedTemplateIds(newIds);
    await handleSaveQuestionnaires(newIds);
  };

  const handleSaveQuestionnaires = async (newIds) => {
    setSavingQuestionnaire(true);
    const athleteEmails = club.athlete_emails || [];
    const prevIds = club.default_questionnaire_template_ids?.length
      ? club.default_questionnaire_template_ids
      : club.default_questionnaire_template_id
        ? [club.default_questionnaire_template_id]
        : [];

    // Mettre à jour le club
    await updateMutation.mutateAsync({ default_questionnaire_template_ids: newIds, default_questionnaire_template_id: newIds[0] || null });

    // Ajouter les athlètes aux nouveaux questionnaires
    for (const id of newIds) {
      if (!prevIds.includes(id)) {
        const tmpl = templates.find(t => t.id === id);
        if (tmpl) {
          const merged = Array.from(new Set([...(tmpl.assigned_athletes || []), ...athleteEmails]));
          await base44.entities.QuestionnaireTemplate.update(id, { assigned_athletes: merged });
        }
      }
    }

    // Retirer les athlètes des questionnaires supprimés
    for (const id of prevIds) {
      if (!newIds.includes(id)) {
        const tmpl = templates.find(t => t.id === id);
        if (tmpl) {
          const filtered = (tmpl.assigned_athletes || []).filter(e => !athleteEmails.includes(e));
          await base44.entities.QuestionnaireTemplate.update(id, { assigned_athletes: filtered });
        }
      }
    }

    setSavingQuestionnaire(false);
    toast.success('Questionnaires du club mis à jour');
    qc.invalidateQueries(['questionnaire-templates-club']);
  };

  const copyLink = (token) => {
    const url = `${window.location.origin}/JoinClub?club=${clubId}&token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (isLoading || !club) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-slate-400">Chargement...</p></div>;
  }

  const coaches = allUsers.filter(u => (club.coach_emails || []).includes(u.email));
  const athletes = allUsers.filter(u => (club.athlete_emails || []).includes(u.email));
  const availableToAdd = allUsers.filter(u =>
    u.user_status === 'coach' || u.user_status === 'coach_pro' || u.user_status === 'athlete'
  ).filter(u => !(club.coach_emails || []).includes(u.email) && !(club.athlete_emails || []).includes(u.email));

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to={createPageUrl('ClubManagement')}>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            {(logoFile || club.logo_url) && (
              <img
                src={logoFile ? URL.createObjectURL(logoFile) : club.logo_url}
                alt={club.name}
                className="w-[60vw] h-[60vw] md:w-12 md:h-12 object-contain rounded-lg border"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{form.name || club.name}</h1>
              <p className="text-slate-500 text-sm">{coaches.length} coach(s) · {athletes.length} athlète(s)</p>
            </div>
          </div>
          {(isCoach || isAdmin) && (
            <Link to={`${createPageUrl('ClubResponses')}?id=${clubId}`} className="ml-auto">
              <Button variant="outline" size="sm" className="gap-2">
                <ListChecks className="w-4 h-4" />
                Voir les réponses
              </Button>
            </Link>
          )}
          {isAdmin && (
            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 gap-2" onClick={handleDeleteClub}>
              <Trash2 className="w-4 h-4" />
              Supprimer
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Paramètres du club */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-lg">Identité du club</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Nom du club</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>

                {/* Logo */}
                <div className="space-y-2">
                  <Label>Logo du club</Label>
                  <div className="relative inline-block">
                    {(logoFile || club.logo_url) ? (
                      <img
                        src={logoFile ? URL.createObjectURL(logoFile) : club.logo_url}
                        alt="logo"
                        className="w-24 h-24 object-contain rounded-lg border border-slate-200"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-lg flex items-center justify-center text-white font-bold text-3xl border border-slate-200"
                        style={{ background: form.primary_color || '#1e293b' }}>
                        {(form.name || club.name || '?')[0]}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { setLogoFile(null); updateMutation.mutate({ logo_url: '' }); }}
                      className="absolute -top-2 -left-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition">
                    <Upload className="w-4 h-4" />
                    {logoFile ? logoFile.name : 'Choisir un logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => setLogoFile(e.target.files[0])} />
                  </label>
                </div>

                {/* Couleurs */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Couleur principale</Label>
                    <button
                      type="button"
                      onClick={() => { setShowPrimaryPicker(v => !v); setShowSecondaryPicker(false); }}
                      className="flex items-center gap-3 w-full px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-700"
                    >
                      <div className="w-6 h-6 rounded border border-slate-200 flex-shrink-0" style={{ backgroundColor: form.primary_color }} />
                      <span className="font-mono text-slate-600">{form.primary_color}</span>
                      <span className="ml-auto text-slate-400">{showPrimaryPicker ? '▲' : '▼'}</span>
                    </button>
                    {showPrimaryPicker && (
                      <div className="pt-1">
                        <ColorPicker
                          value={form.primary_color}
                          onChange={v => setForm(f => ({ ...f, primary_color: v }))}
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Couleur secondaire</Label>
                    <button
                      type="button"
                      onClick={() => { setShowSecondaryPicker(v => !v); setShowPrimaryPicker(false); }}
                      className="flex items-center gap-3 w-full px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-700"
                    >
                      <div className="w-6 h-6 rounded border border-slate-200 flex-shrink-0" style={{ backgroundColor: form.secondary_color }} />
                      <span className="font-mono text-slate-600">{form.secondary_color}</span>
                      <span className="ml-auto text-slate-400">{showSecondaryPicker ? '▲' : '▼'}</span>
                    </button>
                    {showSecondaryPicker && (
                      <div className="pt-1">
                        <ColorPicker
                          value={form.secondary_color}
                          onChange={v => setForm(f => ({ ...f, secondary_color: v }))}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Aperçu */}
                <div className="rounded-lg p-3 text-white text-sm font-medium text-center" style={{ background: form.primary_color }}>
                  Aperçu couleur principale
                </div>

                <Button onClick={handleSaveInfo} disabled={saving || uploading} className="w-full bg-slate-800">
                  {saving ? 'Enregistrement...' : uploading ? 'Upload en cours...' : 'Enregistrer les informations'}
                </Button>
              </CardContent>
            </Card>

            {/* Questionnaires du club - Admin uniquement */}
            {currentUser?.user_status === 'admin' && (
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" />
                    Questionnaires du club
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-slate-500">Les questionnaires sélectionnés seront automatiquement assignés à tous les athlètes du club.</p>
                  <div className="space-y-2">
                    {templates.filter(t => t.is_active).map(t => {
                      const isSelected = selectedTemplateIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggleQuestionnaire(t.id)}
                          disabled={savingQuestionnaire}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'border-slate-700 bg-slate-50 text-slate-800'
                              : 'border-slate-200 hover:border-slate-300 text-slate-600'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center ${
                            isSelected ? 'border-slate-700 bg-slate-700' : 'border-slate-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-sm font-medium">{t.name}</span>
                        </button>
                      );
                    })}
                    {templates.filter(t => t.is_active).length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-2">Aucun questionnaire actif disponible</p>
                    )}
                  </div>
                  {savingQuestionnaire && <p className="text-xs text-slate-400">Mise à jour des assignations...</p>}
                </CardContent>
              </Card>
            )}

            {/* Gestion des accès - Coach Pro et Admin */}
            {(currentUser?.user_status === 'coach_pro' || currentUser?.user_status === 'admin') && (
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" />
                    Gestion des accès
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-slate-500">Ces paramètres s'appliquent à tous les athlètes du club.</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">Données subjectives</p>
                          <p className="text-xs text-slate-400">Accès au dashboard personnel</p>
                        </div>
                      </div>
                      <Switch
                        checked={club.can_access_subjective_data_page !== false}
                        onCheckedChange={(val) => handleSaveAccess('can_access_subjective_data_page', val)}
                        disabled={savingAccess}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">Données objectives</p>
                          <p className="text-xs text-slate-400">Accès à la page données Strava/physiques</p>
                        </div>
                      </div>
                      <Switch
                        checked={club.can_access_objective_data_page !== false}
                        onCheckedChange={(val) => handleSaveAccess('can_access_objective_data_page', val)}
                        disabled={savingAccess}
                      />
                    </div>
                  </div>
                  {savingAccess && <p className="text-xs text-slate-400">Application en cours...</p>}
                </CardContent>
              </Card>
            )}

            {/* Liens d'invitation */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <LinkIcon className="w-5 h-5" />
                  Liens d'invitation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => generateInviteLink('coach')}>
                    <UserPlus className="w-4 h-4" /> Lien Coach
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => generateInviteLink('athlete')}>
                    <UserPlus className="w-4 h-4" /> Lien Athlète
                  </Button>
                </div>

                <div className="space-y-2">
                  {(club.invite_links || []).map((link) => (
                    <div key={link.token} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                      <Badge className={link.role === 'coach' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
                        {link.role === 'coach' ? 'Coach' : 'Athlète'}
                      </Badge>
                      <span className="text-xs text-slate-500 font-mono flex-1 truncate">{link.token.substring(0, 10)}...</span>
                      <button onClick={() => copyLink(link.token)} className="text-slate-400 hover:text-slate-700 transition">
                        {copiedToken === link.token ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button onClick={() => deleteInviteLink(link.token)} className="text-slate-400 hover:text-red-500 transition">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(club.invite_links || []).length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-2">Aucun lien généré</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gestion des membres */}
          <div className="lg:col-span-2 space-y-4">
            {/* Ajouter des utilisateurs - admin uniquement */}
            {currentUser?.user_status === 'admin' && availableToAdd.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader><CardTitle className="text-base">Ajouter des membres existants</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {availableToAdd.map(u => (
                      <div key={u.email} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50">
                        <div>
                          <span className="font-medium text-slate-700 text-sm">{u.full_name}</span>
                          <span className="text-xs text-slate-400 ml-2">{u.email}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {u.user_status === 'coach' ? 'Entraîneur' : u.user_status === 'coach_pro' ? 'Entr. Pro' : 'Athlète'}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          {(u.user_status === 'coach' || u.user_status === 'coach_pro') && (
                            <Button size="sm" variant="outline" onClick={() => addUser(u.email, 'coach')} className="text-xs h-7">
                              + Coach
                            </Button>
                          )}
                          {u.user_status === 'athlete' && (
                            <Button size="sm" variant="outline" onClick={() => addUser(u.email, 'athlete')} className="text-xs h-7">
                              + Athlète
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Équipes */}
            <ClubTeamsSection club={club} athletes={athletes} templates={templates} currentUser={currentUser} />

            {/* Coachs */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  Entraîneurs ({coaches.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {coaches.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Aucun entraîneur</p>
                ) : (
                  <div className="space-y-2">
                    {coaches.map(u => (
                      <div key={u.email} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{u.full_name}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                        <button onClick={() => removeUser(u.email, 'coach')} className="text-slate-300 hover:text-red-500 transition">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Bouton fixe bas de page */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleSaveInfo}
          disabled={saving || uploading}
          className="bg-slate-800 hover:bg-slate-700 shadow-xl gap-2 px-6 py-3 text-base"
        >
          {saving ? 'Enregistrement...' : uploading ? 'Upload...' : '💾 Enregistrer les modifications'}
        </Button>
      </div>
    </div>
  );
}