import React, { useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, ArrowLeft, UserCog, Plus, Edit, Trash2, Mail, FileText, CheckCircle, Clock, XCircle, ChevronDown, ChevronUp, BookOpen, UserCheck } from 'lucide-react';
import ManageAthleteQuestionnairesModal from '@/components/ManageAthleteQuestionnairesModal';
import ManageCoachQuestionnairesModal from '@/components/questionnaire/ManageCoachQuestionnairesModal';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

export default function UserManagement() {
  // ── Utiliser useAuth() au lieu de recharger l'utilisateur ─────────────────
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingGroup, setEditingGroup] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [formData, setFormData] = useState({
    name: '',
    coach_email: '',
    athlete_emails: [],
    notes_admin: ''
  });
  
  const queryClient = useQueryClient();

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      return await base44.entities.User.list();
    },
    enabled: !!user,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => base44.entities.Group.list('-created_at'),
    enabled: !!user,
  });

  const { data: questionnaires = [] } = useQuery({
    queryKey: ['questionnaires'],
    queryFn: () => base44.entities.QuestionnaireTemplate.list(),
    enabled: !!user,
  });

  const { data: athleteProfiles = [], refetch: refetchProfiles } = useQuery({
    queryKey: ['athlete-profiles-all'],
    queryFn: () => base44.entities.AthleteProfile.list(),
    enabled: !!user,
  });

  const coaches = allUsers.filter(u => u.user_status === 'coach' || u.user_status === 'coach_pro');
  const athletes = allUsers.filter(u => u.user_status === 'athlete');
  const admins = allUsers.filter(u => u.user_status === 'admin');
  // ── Correction : utiliser user_status au lieu de role ─────────────────────
  const pendingUsers = allUsers.filter(u => !u.is_approved && u.user_status !== 'admin');

  const getAthleteGroup = (athleteEmail) => {
    return groups.find(g => g.athlete_emails?.includes(athleteEmail));
  };

  const getAthleteQuestionnaires = (athleteEmail) => {
    return questionnaires.filter(q => q.assigned_athletes?.includes(athleteEmail));
  };

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }) => base44.entities.User.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('Statut utilisateur mis à jour');
    },
  });

  const approveUserMutation = useMutation({
    mutationFn: (userId) => base44.entities.User.update(userId, { is_approved: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('Utilisateur approuvé');
    },
  });

  const disapproveUserMutation = useMutation({
    mutationFn: (userId) => base44.entities.User.update(userId, { is_approved: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('Utilisateur désapprouvé');
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: (data) => base44.entities.Group.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      resetForm();
      toast.success('Groupe créé');
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Group.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      resetForm();
      toast.success('Groupe mis à jour');
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id) => base44.entities.Group.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success('Groupe supprimé');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userToDelete) => {
      const email = userToDelete.email;
      
      const responses = await base44.entities.QuestionnaireResponse.filter({ athlete_email: email });
      await Promise.all(responses.map(r => base44.entities.QuestionnaireResponse.delete(r.id)));
      
      const logs = await base44.entities.TrainingLog.filter({ athlete_email: email });
      await Promise.all(logs.map(l => base44.entities.TrainingLog.delete(l.id)));
      
      const profiles = await base44.entities.AthleteProfile.filter({ athlete_email: email });
      await Promise.all(profiles.map(p => base44.entities.AthleteProfile.delete(p.id)));
      
      const sentMessages = await base44.entities.Message.filter({ sender_email: email });
      const receivedMessages = await base44.entities.Message.filter({ recipient_email: email });
      await Promise.all([...sentMessages, ...receivedMessages].map(m => base44.entities.Message.delete(m.id)));
      
      const allGroups = await base44.entities.Group.list();
      const groupsWithUser = allGroups.filter(g => 
        g.athlete_emails?.includes(email) || g.coach_email === email
      );
      await Promise.all(groupsWithUser.map(g => {
        if (g.coach_email === email) {
          return base44.entities.Group.delete(g.id);
        } else {
          return base44.entities.Group.update(g.id, {
            ...g,
            athlete_emails: g.athlete_emails.filter(e => e !== email)
          });
        }
      }));
      
      return base44.entities.User.delete(userToDelete.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success('Utilisateur supprimé');
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la suppression');
    },
  });

  const assignAthletesToCoachMutation = useMutation({
    mutationFn: async ({ coachEmail, athleteEmails }) => {
      const allAthleteEmails = athletes.map(a => a.email);
      await Promise.all(allAthleteEmails.map(async (email) => {
        const profile = athleteProfiles.find(p => p.athlete_email === email);
        if (!profile) return;
        const current = profile.assigned_coach_emails || [];
        const shouldHave = athleteEmails.includes(email);
        const has = current.includes(coachEmail);
        if (shouldHave && !has) {
          await base44.entities.AthleteProfile.update(profile.id, {
            assigned_coach_emails: [...current, coachEmail]
          });
        } else if (!shouldHave && has) {
          await base44.entities.AthleteProfile.update(profile.id, {
            assigned_coach_emails: current.filter(e => e !== coachEmail)
          });
        }
      }));
    },
    onSuccess: () => {
      refetchProfiles();
      setAssigningCoach(null);
      toast.success('Assignations mises à jour');
    },
  });

  const openAssignModal = (coach) => {
    const assigned = athleteProfiles
      .filter(p => (p.assigned_coach_emails || []).includes(coach.email))
      .map(p => p.athlete_email);
    setSelectedAthletesForCoach(assigned);
    setAssigningCoach(coach);
  };

  const handleDeleteGroup = (group) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le groupe "${group.name}" ?`)) {
      deleteGroupMutation.mutate(group.id);
    }
  };

  const handleDeleteUser = (userToDelete) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${userToDelete.full_name}" (${userToDelete.email}) ?`)) {
      deleteUserMutation.mutate(userToDelete);
    }
  };

  const [pendingOpen, setPendingOpen] = useState(true);
  const [assigningCoach, setAssigningCoach] = useState(null);
  const [selectedAthletesForCoach, setSelectedAthletesForCoach] = useState([]);
  const [managingQuestionnairesFor, setManagingQuestionnairesFor] = useState(null);
  const [managingCoachQuestionnaires, setManagingCoachQuestionnaires] = useState(null);
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterQuestionnaire, setFilterQuestionnaire] = useState('all');

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = !searchQuery || 
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesGroup = true;
    if (u.user_status === 'athlete') {
      if (filterGroup === 'no-group') {
        matchesGroup = !getAthleteGroup(u.email);
      } else if (filterGroup !== 'all') {
        const group = groups.find(g => g.id === filterGroup);
        matchesGroup = group?.athlete_emails?.includes(u.email);
      }
    }
    
    let matchesQuestionnaire = true;
    if (u.user_status === 'athlete') {
      if (filterQuestionnaire === 'no-questionnaire') {
        matchesQuestionnaire = getAthleteQuestionnaires(u.email).length === 0;
      } else if (filterQuestionnaire !== 'all') {
        const questionnaire = questionnaires.find(q => q.id === filterQuestionnaire);
        matchesQuestionnaire = questionnaire?.assigned_athletes?.includes(u.email);
      }
    }
    
    return matchesSearch && matchesGroup && matchesQuestionnaire;
  });

  const handleUserStatusChange = (userId, newStatus) => {
    updateUserMutation.mutate({ 
      userId, 
      data: { user_status: newStatus }
    });
  };

  const resetForm = () => {
    setFormData({ name: '', coach_email: '', athlete_emails: [], notes_admin: '' });
    setEditingGroup(null);
  };

  const handleGroupSubmit = (e) => {
    e.preventDefault();
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, data: formData });
    } else {
      createGroupMutation.mutate(formData);
    }
  };

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      coach_email: group.coach_email,
      athlete_emails: group.athlete_emails,
      notes_admin: group.notes_admin || ''
    });
  };

  const toggleAthlete = (email) => {
    setFormData(prev => ({
      ...prev,
      athlete_emails: prev.athlete_emails.includes(email)
        ? prev.athlete_emails.filter(e => e !== email)
        : [...prev.athlete_emails, email]
    }));
  };

  if (!user) {
    return <div className="p-8">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to={createPageUrl('AdminHome')}>
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Accueil
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            Gestion des Utilisateurs & Groupes
          </h1>
        </div>

        {/* Comptes en attente */}
        {pendingUsers.length > 0 && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardHeader className="cursor-pointer select-none" onClick={() => setPendingOpen(o => !o)}>
              <CardTitle className="flex items-center justify-between text-amber-800">
                <span className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Comptes en attente d'approbation
                </span>
                <div className="flex items-center gap-2">
                  <span className="bg-amber-200 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendingUsers.length}
                  </span>
                  {pendingOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </CardTitle>
            </CardHeader>
            {pendingOpen && (
              <CardContent>
                <div className="space-y-3">
                  {pendingUsers.map(u => (
                    <div key={u.id} className="flex items-center justify-between bg-white border border-amber-200 rounded-lg p-3">
                      <div>
                        <p className="font-medium text-slate-800">{u.full_name || u.email}</p>
                        <p className="text-sm text-slate-500">{u.email}</p>
                        {u.birth_date && <p className="text-xs text-slate-400">Né(e) le : {u.birth_date}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => disapproveUserMutation.mutate(u.id)}
                          disabled={disapproveUserMutation.isPending}
                        >
                          <XCircle className="w-4 h-4" />
                          Refuser
                        </Button>
                        <Button
                          size="sm"
                          className="gap-2 bg-green-600 hover:bg-green-700"
                          onClick={() => approveUserMutation.mutate(u.id)}
                          disabled={approveUserMutation.isPending}
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approuver
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Filtres */}
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">Filtres</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Rechercher</Label>
                <Input placeholder="Nom ou email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Groupe</Label>
                <Select value={filterGroup} onValueChange={setFilterGroup}>
                  <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les groupes</SelectItem>
                    <SelectItem value="no-group">Sans groupe</SelectItem>
                    {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Questionnaire</Label>
                <Select value={filterQuestionnaire} onValueChange={setFilterQuestionnaire}>
                  <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="no-questionnaire">Sans questionnaire</SelectItem>
                    {questionnaires.map(q => <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Athlètes */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Athlètes ({filteredUsers.filter(u => u.user_status === 'athlete').length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Groupe</TableHead>
                    <TableHead>Questionnaires</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.filter(u => u.user_status === 'athlete').map((u) => {
                    const athleteGroup = getAthleteGroup(u.email);
                    const athleteQuestionnaires = getAthleteQuestionnaires(u.email);
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Link to={`/AthleteProfile?athleteEmail=${encodeURIComponent(u.email)}`}>
                              <Button size="sm" variant="outline" className="gap-1 text-xs text-blue-600 border-blue-200 hover:bg-blue-50">
                                <FileText className="w-3.5 h-3.5" />
                                Fiche
                              </Button>
                            </Link>
                            {u.full_name}
                          </div>
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Select value={u.user_status || 'athlete'} onValueChange={(value) => handleUserStatusChange(u.id, value)}>
                            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="athlete">Athlète</SelectItem>
                              <SelectItem value="coach">Entraîneur</SelectItem>
                              <SelectItem value="coach_pro">Entraîneur Pro</SelectItem>
                              <SelectItem value="admin">Administrateur</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {athleteGroup ? <Badge variant="secondary">{athleteGroup.name}</Badge> : <span className="text-sm text-slate-400">Aucun</span>}
                        </TableCell>
                        <TableCell>
                          {athleteQuestionnaires.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {athleteQuestionnaires.map(q => <Badge key={q.id} variant="outline" className="text-xs">{q.name}</Badge>)}
                            </div>
                          ) : <span className="text-sm text-slate-400">Aucun</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setManagingQuestionnairesFor(u.email)} className="text-blue-600 hover:bg-blue-50">
                              <BookOpen className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteUser(u)} className="text-red-600 hover:bg-red-50" disabled={u.email === user?.email}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Entraîneurs */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Entraîneurs ({coaches.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coaches.map((coach) => (
                    <TableRow key={coach.id}>
                      <TableCell className="font-medium">{coach.full_name}</TableCell>
                      <TableCell>{coach.email}</TableCell>
                      <TableCell>
                        <Select value={coach.user_status || 'coach'} onValueChange={(value) => handleUserStatusChange(coach.id, value)}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="athlete">Athlète</SelectItem>
                            <SelectItem value="coach">Entraîneur</SelectItem>
                            <SelectItem value="coach_pro">Entraîneur Pro</SelectItem>
                            <SelectItem value="admin">Administrateur</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="gap-1 text-xs text-purple-600 border-purple-200 hover:bg-purple-50" onClick={() => setManagingCoachQuestionnaires({ email: coach.email, name: coach.full_name || coach.email })}>
                            <BookOpen className="w-3.5 h-3.5" />
                            Questionnaires
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={() => openAssignModal(coach)}>
                            <UserCheck className="w-3.5 h-3.5" />
                            Athlètes
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteUser(coach)} className="text-red-600 hover:bg-red-50" disabled={coach.email === user?.email}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Administrateurs */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              Administrateurs ({admins.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteUser(u)} className="text-red-600 hover:bg-red-50" disabled={u.email === user?.email}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Groupes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                {editingGroup ? 'Modifier le groupe' : 'Créer un groupe'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGroupSubmit} className="space-y-4">
                <div>
                  <Label>Nom du groupe</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Groupe Elite" required />
                </div>
                <div>
                  <Label>Entraîneur</Label>
                  <Select value={formData.coach_email} onValueChange={(value) => setFormData({ ...formData, coach_email: value })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un entraîneur" /></SelectTrigger>
                    <SelectContent>
                      {coaches.map(coach => <SelectItem key={coach.email} value={coach.email}>{coach.full_name} ({coach.email})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Athlètes</Label>
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                    {athletes.map(athlete => (
                      <div key={athlete.email} className="flex items-center gap-2">
                        <Checkbox id={`athlete-${athlete.email}`} checked={formData.athlete_emails.includes(athlete.email)} onCheckedChange={() => toggleAthlete(athlete.email)} />
                        <Label htmlFor={`athlete-${athlete.email}`} className="text-sm cursor-pointer">{athlete.full_name} ({athlete.email})</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Notes Admin</Label>
                  <Textarea value={formData.notes_admin} onChange={(e) => setFormData({ ...formData, notes_admin: e.target.value })} rows={3} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">{editingGroup ? 'Mettre à jour' : 'Créer'}</Button>
                  {editingGroup && <Button type="button" variant="outline" onClick={resetForm}>Annuler</Button>}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Groupes ({groups.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {groups.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Aucun groupe créé</p>
                ) : groups.map(group => {
                  const coach = allUsers.find(u => u.email === group.coach_email);
                  return (
                    <div key={group.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{group.name}</h3>
                          <p className="text-sm text-slate-500">Coach : {coach?.full_name || group.coach_email}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleEditGroup(group)}><Edit className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteGroup(group)} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                      <Badge variant="outline">{group.athlete_emails?.length || 0} athlète(s)</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal assignation */}
      <Dialog open={!!assigningCoach} onOpenChange={(open) => !open && setAssigningCoach(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Assigner des athlètes à {assigningCoach?.full_name}</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2 py-2">
            {athletes.map(athlete => (
              <div key={athlete.email} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50">
                <Checkbox id={`assign-${athlete.email}`} checked={selectedAthletesForCoach.includes(athlete.email)}
                  onCheckedChange={(checked) => setSelectedAthletesForCoach(prev => checked ? [...prev, athlete.email] : prev.filter(e => e !== athlete.email))} />
                <Label htmlFor={`assign-${athlete.email}`} className="cursor-pointer flex-1">
                  <span className="font-medium">{athlete.full_name}</span>
                  <span className="text-xs text-slate-500 ml-2">{athlete.email}</span>
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningCoach(null)}>Annuler</Button>
            <Button onClick={() => assignAthletesToCoachMutation.mutate({ coachEmail: assigningCoach.email, athleteEmails: selectedAthletesForCoach })} disabled={assignAthletesToCoachMutation.isPending}>
              {assignAthletesToCoachMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {managingQuestionnairesFor && (
        <ManageAthleteQuestionnairesModal athleteEmail={managingQuestionnairesFor} questionnaires={questionnaires} onClose={() => setManagingQuestionnairesFor(null)} />
      )}
      {managingCoachQuestionnaires && (
        <ManageCoachQuestionnairesModal coachEmail={managingCoachQuestionnaires.email} coachName={managingCoachQuestionnaires.name} questionnaires={questionnaires} onClose={() => setManagingCoachQuestionnaires(null)} />
      )}
    </div>
  );
}
