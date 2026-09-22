import React, { useState, useEffect } from 'react';
import { supabase as base44, supabaseRaw } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Upload, X as XIcon } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, UserPlus, Copy, Check, Mail, Users, Trash2, ChevronDown, ChevronUp, Edit } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function GroupManagement() {
  const { user } = useAuth();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    athlete_emails: []
  });
  const [expandedAthletes, setExpandedAthletes] = useState({});
  const [editingGroup, setEditingGroup] = useState(null);
  const [showEditGroupDialog, setShowEditGroupDialog] = useState(false);
  const [branding, setBranding] = useState({ primary_color: '#1e293b', secondary_color: '#ffffff', club_logo_url: '' });
  const [brandingId, setBrandingId] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [savingBranding, setSavingBranding] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.email) return;
    let isMounted = true;
    base44.entities.CoachBranding.filter({ coach_email: user.email }).then(brandings => {
      if (!isMounted || brandings.length === 0) return;
      setBrandingId(brandings[0].id);
      setBranding({
        primary_color: brandings[0].primary_color || '#1e293b',
        secondary_color: brandings[0].secondary_color || '#ffffff',
        club_logo_url: brandings[0].club_logo_url || ''
      });
    });
    return () => { isMounted = false; };
  }, [user?.email]);

  // Récupérer le groupe de l'entraîneur
  const { data: group } = useQuery({
    queryKey: ['coach-group', user?.email],
    queryFn: async () => {
      const groups = await base44.entities.Group.list();
      return groups.find(g => g.coach_email === user.email);
    },
    enabled: !!user?.email
  });

  // Récupérer tous les profils des athlètes liés à l'entraîneur
  const { data: athleteProfiles = [] } = useQuery({
    queryKey: ['athlete-profiles', user?.email],
    queryFn: async () => {
      // Vérifier si le coach est affilié à un club
      const allClubs = await base44.entities.Club.list();
      const myClub = allClubs.find(c => (c.coach_emails || []).includes(user.email));

      const allProfiles = await base44.entities.AthleteProfile.list();

      if (myClub) {
        // Coach affilié à un club : voir tous les athlètes du club
        const clubAthleteEmails = myClub.athlete_emails || [];
        return allProfiles.filter(p => clubAthleteEmails.includes(p.athlete_email));
      } else {
        // Coach sans club : voir les athlètes de ses groupes + ceux assignés par l'admin
        const allGroups = await base44.entities.Group.list();
        const coachGroups = allGroups.filter(g => g.coach_email === user.email);
        const groupAthleteEmails = new Set(coachGroups.flatMap(g => g.athlete_emails || []));
        return allProfiles.filter(p =>
          groupAthleteEmails.has(p.athlete_email) ||
          (p.assigned_coach_emails || []).includes(user.email)
        );
      }
    },
    enabled: !!user?.email
  });

  // Récupérer tous les groupes créés par l'entraîneur
  const { data: trainingGroups = [] } = useQuery({
    queryKey: ['training-groups', user?.email],
    queryFn: async () => {
      const allGroups = await base44.entities.Group.list();
      return allGroups.filter(g => g.coach_email === user.email && g.name !== 'Groupe Principal');
    },
    enabled: !!user?.email
  });

  // Mutation pour créer un groupe
  const createGroupMutation = useMutation({
    mutationFn: async (groupData) => {
      return await base44.entities.Group.create({
        name: groupData.name,
        coach_email: user.email,
        athlete_emails: groupData.athlete_emails,
        notes_admin: groupData.description || ''
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-groups'] });
      setShowCreateGroupDialog(false);
      setNewGroup({ name: '', description: '', athlete_emails: [] });
      toast.success('Groupe créé avec succès');
    },
    onError: () => {
      toast.error('Erreur lors de la création du groupe');
    }
  });

  // Mutation pour modifier un groupe
  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.Group.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-groups'] });
      setShowEditGroupDialog(false);
      setEditingGroup(null);
      toast.success('Groupe modifié avec succès');
    },
    onError: () => {
      toast.error('Erreur lors de la modification du groupe');
    }
  });

  // Mutation pour supprimer un groupe
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId) => {
      return await base44.entities.Group.delete(groupId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-groups'] });
      toast.success('Groupe supprimé avec succès');
    },
    onError: () => {
      toast.error('Erreur lors de la suppression du groupe');
    }
  });

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    let logo_url = branding.club_logo_url;
    if (logoFile) {
      const ext = logoFile.name.split('.').pop();
      const path = `branding/${user.email.replace('@', '_')}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabaseRaw.storage.from('branding').upload(path, logoFile, { upsert: true });
      if (uploadError) { setSavingBranding(false); toast.error('Erreur upload: ' + uploadError.message); return; }
      const { data: { publicUrl } } = supabaseRaw.storage.from('branding').getPublicUrl(path);
      logo_url = publicUrl;
      setLogoFile(null);
    }
    const data = { ...branding, club_logo_url: logo_url, coach_email: user.email };
    if (brandingId) {
      await base44.entities.CoachBranding.update(brandingId, data);
    } else {
      const created = await base44.entities.CoachBranding.create(data);
      setBrandingId(created.id);
    }
    setBranding(b => ({ ...b, club_logo_url: logo_url }));
    setSavingBranding(false);
    toast.success('Personnalisation enregistrée');
  };

  const inviteLink = user ? `${window.location.origin}?coach=${encodeURIComponent(user.email)}` : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success('Lien copié !');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast.error('Veuillez entrer une adresse email valide');
      return;
    }

    setInviting(true);
    try {
      toast.success(`Lien d'invitation copié. Partagez-le avec ${inviteEmail} pour qu'ils puissent s'inscrire.`);
      navigator.clipboard.writeText(inviteLink);
      setInviteEmail('');
    } catch (error) {
      toast.error('Erreur lors de l\'invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleCreateGroup = () => {
    if (!newGroup.name.trim()) {
      toast.error('Veuillez donner un nom au groupe');
      return;
    }
    if (newGroup.athlete_emails.length === 0) {
      toast.error('Veuillez sélectionner au moins un athlète');
      return;
    }
    createGroupMutation.mutate(newGroup);
  };

  const toggleAthleteSelection = (email) => {
    setNewGroup(prev => ({
      ...prev,
      athlete_emails: prev.athlete_emails.includes(email)
        ? prev.athlete_emails.filter(e => e !== email)
        : [...prev.athlete_emails, email]
    }));
  };

  const toggleEditAthleteSelection = (email) => {
    setEditingGroup(prev => ({
      ...prev,
      athlete_emails: prev.athlete_emails.includes(email)
        ? prev.athlete_emails.filter(e => e !== email)
        : [...prev.athlete_emails, email]
    }));
  };

  const handleEditGroup = (group) => {
    setEditingGroup({
      id: group.id,
      name: group.name,
      description: group.notes_admin || '',
      athlete_emails: group.athlete_emails || []
    });
    setShowEditGroupDialog(true);
  };

  const handleUpdateGroup = () => {
    if (!editingGroup.name.trim()) {
      toast.error('Veuillez donner un nom au groupe');
      return;
    }
    updateGroupMutation.mutate({
      id: editingGroup.id,
      data: {
        name: editingGroup.name,
        coach_email: user.email,
        athlete_emails: editingGroup.athlete_emails,
        notes_admin: editingGroup.description || ''
      }
    });
  };

  const handleDeleteGroup = (groupId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce groupe ?')) {
      return;
    }
    deleteGroupMutation.mutate(groupId);
  };

  const toggleAthleteExpand = (athleteId) => {
    setExpandedAthletes(prev => ({
      ...prev,
      [athleteId]: !prev[athleteId]
    }));
  };

  const handleDeleteAthlete = async (profileId, athleteEmail) => {
    if (!confirm('Êtes-vous sûr de vouloir retirer cet athlète de votre liste ?')) {
      return;
    }

    try {
      // Retirer l'athlète de tous les groupes de l'entraîneur
      const allGroups = await base44.entities.Group.list();
      const coachGroups = allGroups.filter(g => 
        g.coach_email === user.email && 
        g.athlete_emails?.includes(athleteEmail)
      );

      for (const group of coachGroups) {
        const updatedAthletes = group.athlete_emails.filter(email => email !== athleteEmail);
        await base44.entities.Group.update(group.id, {
          ...group,
          athlete_emails: updatedAthletes
        });
      }

      queryClient.invalidateQueries({ queryKey: ['coach-group'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['training-groups'] });
      toast.success('Athlète retiré de votre liste');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Button variant="outline" className="gap-2" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
        </div>

        <h1 className="text-3xl font-bold text-slate-800 mb-8">Gestion du Groupe</h1>

        {/* Personnalisation vue individuelle */}
        <div className="mb-8">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-lg">🎨 Personnalisation – Vue individuelle</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-500">Ces couleurs et ce logo s'affichent uniquement sur votre vue personnelle (Athlète indiv.).</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700 block">Couleur principale</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={branding.primary_color} onChange={e => setBranding(b => ({ ...b, primary_color: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border border-slate-200" />
                    <input type="text" value={branding.primary_color} onChange={e => setBranding(b => ({ ...b, primary_color: e.target.value }))} className="flex-1 border rounded-md px-3 py-1 text-sm font-mono" />
                  </div>
                  <label className="text-sm font-medium text-slate-700 block">Couleur secondaire</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={branding.secondary_color} onChange={e => setBranding(b => ({ ...b, secondary_color: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border border-slate-200" />
                    <input type="text" value={branding.secondary_color} onChange={e => setBranding(b => ({ ...b, secondary_color: e.target.value }))} className="flex-1 border rounded-md px-3 py-1 text-sm font-mono" />
                  </div>
                  <div className="rounded-lg p-3 text-white text-sm font-medium text-center" style={{ background: branding.primary_color }}>Aperçu couleur principale</div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700 block">Logo / Image de fond</label>
                  {(logoFile || branding.club_logo_url) ? (
                    <div className="relative inline-block">
                      <img src={logoFile ? URL.createObjectURL(logoFile) : branding.club_logo_url} alt="logo" className="w-24 h-24 object-contain rounded-lg border border-slate-200" />
                      <button type="button" onClick={() => { setLogoFile(null); setBranding(b => ({ ...b, club_logo_url: '' })); }} className="absolute -top-2 -left-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow">
                        <XIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-lg flex items-center justify-center text-white font-bold text-3xl border border-slate-200" style={{ background: branding.primary_color }}>{user?.full_name?.[0] || '?'}</div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition">
                    <Upload className="w-4 h-4" />
                    {logoFile ? logoFile.name : 'Choisir un logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => setLogoFile(e.target.files[0])} />
                  </label>
                </div>
              </div>
              <Button onClick={handleSaveBranding} disabled={savingBranding} className="bg-slate-800 gap-2">
                {savingBranding ? 'Enregistrement...' : '💾 Enregistrer la personnalisation'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Boutons d'action */}
        <div className="mb-8 flex gap-4">
          <Button 
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="bg-purple-600 hover:bg-purple-700 gap-2"
            size="lg"
          >
            <UserPlus className="w-5 h-5" />
            Inviter un athlète
          </Button>
          
          <Dialog open={showCreateGroupDialog} onOpenChange={setShowCreateGroupDialog}>
            <DialogTrigger asChild>
              <Button 
                className="bg-indigo-600 hover:bg-indigo-700 gap-2"
                size="lg"
                disabled={athleteProfiles.length === 0}
              >
                <Users className="w-5 h-5" />
                Créer un groupe
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Créer un groupe d'entraînement</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Nom du groupe *
                  </label>
                  <Input
                    placeholder="Ex: Groupe débutants"
                    value={newGroup.name}
                    onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Description
                  </label>
                  <Textarea
                    placeholder="Description du groupe..."
                    value={newGroup.description}
                    onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Sélectionner les athlètes *
                  </label>
                  <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-3">
                    {athleteProfiles.map((profile) => (
                      <div key={profile.id} className="flex items-center gap-3">
                        <Checkbox
                          id={profile.athlete_email}
                          checked={newGroup.athlete_emails.includes(profile.athlete_email)}
                          onCheckedChange={() => toggleAthleteSelection(profile.athlete_email)}
                        />
                        <label
                          htmlFor={profile.athlete_email}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="font-medium text-slate-800">{profile.athlete_name}</div>
                          <div className="text-sm text-slate-500">{profile.athlete_email}</div>
                        </label>
                      </div>
                    ))}
                    {athleteProfiles.length === 0 && (
                      <p className="text-slate-500 text-center py-4">
                        Aucun athlète disponible. Invitez d'abord des athlètes.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowCreateGroupDialog(false);
                      setNewGroup({ name: '', description: '', athlete_emails: [] });
                    }}
                  >
                    Annuler
                  </Button>
                  <Button 
                    onClick={handleCreateGroup}
                    disabled={createGroupMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {createGroupMutation.isPending ? 'Création...' : 'Créer le groupe'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Dialog d'édition de groupe */}
          <Dialog open={showEditGroupDialog} onOpenChange={setShowEditGroupDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Modifier le groupe</DialogTitle>
              </DialogHeader>
              {editingGroup && (
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                      Nom du groupe *
                    </label>
                    <Input
                      placeholder="Ex: Groupe débutants"
                      value={editingGroup.name}
                      onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                      Description
                    </label>
                    <Textarea
                      placeholder="Description du groupe..."
                      value={editingGroup.description}
                      onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                      Athlètes du groupe
                    </label>
                    <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-3">
                      {athleteProfiles.map((profile) => (
                        <div key={profile.id} className="flex items-center gap-3">
                          <Checkbox
                            id={`edit-${profile.athlete_email}`}
                            checked={editingGroup.athlete_emails.includes(profile.athlete_email)}
                            onCheckedChange={() => toggleEditAthleteSelection(profile.athlete_email)}
                          />
                          <label
                            htmlFor={`edit-${profile.athlete_email}`}
                            className="flex-1 cursor-pointer"
                          >
                            <div className="font-medium text-slate-800">{profile.athlete_name}</div>
                            <div className="text-sm text-slate-500">{profile.athlete_email}</div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowEditGroupDialog(false);
                        setEditingGroup(null);
                      }}
                    >
                      Annuler
                    </Button>
                    <Button 
                      onClick={handleUpdateGroup}
                      disabled={updateGroupMutation.isPending}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      {updateGroupMutation.isPending ? 'Modification...' : 'Modifier'}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Formulaire d'invitation */}
        {showInviteForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card>
              <CardHeader>
                <CardTitle>Inviter un athlète</CardTitle>
                <CardDescription>
                  Partagez le lien d'inscription ou envoyez une invitation par email
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Lien d'invitation */}
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Lien d'invitation
                  </label>
                  <div className="flex gap-2">
                    <Input 
                      value={inviteLink}
                      readOnly
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleCopyLink}
                      variant="outline"
                      className="gap-2"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copié
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copier
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Partagez ce lien avec vos athlètes pour qu'ils puissent s'inscrire
                  </p>
                </div>

                {/* Invitation par email */}
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Ou inviter par email
                  </label>
                  <div className="flex gap-2">
                    <Input 
                      type="email"
                      placeholder="athlete@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleInvite}
                      disabled={inviting}
                      className="bg-purple-600 hover:bg-purple-700 gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      {inviting ? 'Envoi...' : 'Inviter'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Groupes d'entraînement créés */}
        {trainingGroups.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Mes Groupes d'Entraînement</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trainingGroups.map((trainingGroup) => (
                <Card key={trainingGroup.id} className="border-indigo-200">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-indigo-900">{trainingGroup.name}</CardTitle>
                        {trainingGroup.notes_admin && (
                          <CardDescription>{trainingGroup.notes_admin}</CardDescription>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                          onClick={() => handleEditGroup(trainingGroup)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteGroup(trainingGroup.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Users className="w-4 h-4" />
                      <span>{trainingGroup.athlete_emails.length} athlète(s)</span>
                    </div>
                    <div className="mt-3 space-y-1">
                      {trainingGroup.athlete_emails.slice(0, 3).map((email) => {
                        const profile = athleteProfiles.find(p => p.athlete_email === email);
                        return (
                          <div key={email} className="text-xs text-slate-600">
                            • {profile?.athlete_name || email}
                          </div>
                        );
                      })}
                      {trainingGroup.athlete_emails.length > 3 && (
                        <div className="text-xs text-slate-500">
                          +{trainingGroup.athlete_emails.length - 3} autre(s)
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Liste des athlètes */}
        <Card>
          <CardHeader>
            <CardTitle>Mes Athlètes</CardTitle>
            <CardDescription>
              {athleteProfiles.length} athlète(s) inscrit(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {athleteProfiles.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 mb-4">Aucun athlète inscrit pour le moment</p>
                <Button 
                  onClick={() => setShowInviteForm(true)}
                  variant="outline"
                  className="gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Inviter un athlète
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {athleteProfiles.map((profile) => {
                  const isExpanded = expandedAthletes[profile.id];
                  return (
                    <motion.div
                      key={profile.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div 
                        className="flex items-center justify-between p-4 cursor-pointer bg-white hover:bg-slate-50"
                        onClick={() => toggleAthleteExpand(profile.id)}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {profile.athlete_name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-slate-800">
                              {profile.athlete_name}
                            </h3>
                            <p className="text-sm text-slate-500">{profile.athlete_email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link to={createPageUrl('AthleteProfile') + `?athleteEmail=${profile.athlete_email}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAthlete(profile.id, profile.athlete_email);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            {profile.sport && (
                              <div>
                                <span className="text-slate-500 font-medium">Sport:</span>
                                <span className="text-slate-700 ml-2">{profile.sport}</span>
                              </div>
                            )}
                            {profile.age && (
                              <div>
                                <span className="text-slate-500 font-medium">Âge:</span>
                                <span className="text-slate-700 ml-2">{profile.age} ans</span>
                              </div>
                            )}
                            {profile.niveau && (
                              <div>
                                <span className="text-slate-500 font-medium">Niveau:</span>
                                <span className="text-slate-700 ml-2 capitalize">{profile.niveau}</span>
                              </div>
                            )}
                            {profile.volume_hebdomadaire && (
                              <div>
                                <span className="text-slate-500 font-medium">Volume hebdo:</span>
                                <span className="text-slate-700 ml-2">{profile.volume_hebdomadaire}</span>
                              </div>
                            )}
                            {profile.projet && (
                              <div className="md:col-span-2">
                                <span className="text-slate-500 font-medium">Projet:</span>
                                <span className="text-slate-700 ml-2">{profile.projet}</span>
                              </div>
                            )}
                            {profile.objectifs && (
                              <div className="md:col-span-2">
                                <span className="text-slate-500 font-medium">Objectifs:</span>
                                <span className="text-slate-700 ml-2">{profile.objectifs}</span>
                              </div>
                            )}
                            {profile.historique_blessures && (
                              <div className="md:col-span-2">
                                <span className="text-slate-500 font-medium">Historique blessures:</span>
                                <span className="text-slate-700 ml-2">{profile.historique_blessures}</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}