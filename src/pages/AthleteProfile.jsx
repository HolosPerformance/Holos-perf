import React, { useState, useEffect } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Edit2, Save, X, ArrowLeft, Search, Shield, BarChart2, Activity, UserCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AthleteProfile() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [athletePermissions, setAthletePermissions] = useState({ can_access_subjective_data_page: true, can_access_objective_data_page: true });
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [selectedAthleteEmail, setSelectedAthleteEmail] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [savingCoachAssign, setSavingCoachAssign] = useState(false);

  const [initialFormData, setInitialFormData] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const urlParams = new URLSearchParams(window.location.search);
    const athleteEmailParam = urlParams.get('athleteEmail');
    if (athleteEmailParam) {
      setSelectedAthleteEmail(athleteEmailParam);
    } else if (user.user_status !== 'admin' && user.user_status !== 'coach' && user.user_status !== 'coach_pro') {
      setSelectedAthleteEmail(user.email);
    }
  }, [user?.email]);

  const isAdmin = user?.user_status === 'admin';
  const isCoach = user?.user_status === 'coach' || user?.user_status === 'coach_pro';
  const [athleteSearch, setAthleteSearch] = useState('');

  // Charger la liste des coaches (pour admin)
  const { data: allCoaches = [] } = useQuery({
    queryKey: ['all-coaches-for-profile'],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users.filter(u => u.user_status === 'coach' || u.user_status === 'coach_pro');
    },
    enabled: isAdmin,
  });

  // Charger la liste des athlètes (pour admin) - directement depuis User
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-for-profile'],
    queryFn: () => base44.entities.User.list(),
    enabled: isAdmin,
  });

  const athletes = React.useMemo(() => {
    if (!allUsers.length) return [];
    return allUsers
      .filter(u => u.user_status === 'athlete')
      .map(u => ({ email: u.email, name: u.full_name }));
  }, [allUsers]);

  const filteredAthletes = React.useMemo(() => {
    if (!athleteSearch.trim()) return athletes;
    const search = athleteSearch.toLowerCase();
    return athletes.filter(a =>
      a.name?.toLowerCase().includes(search) || a.email?.toLowerCase().includes(search)
    );
  }, [athletes, athleteSearch]);

  // Charger le profil de l'athlète sélectionné
  const { data: profiles } = useQuery({
    queryKey: ['athlete-profile', selectedAthleteEmail],
    queryFn: () => {
      // Sécurité : un athlète ne peut voir que son propre profil, coach peut voir ses athlètes
      if (!isAdmin && !isCoach && selectedAthleteEmail !== user?.email) {
        throw new Error('Accès non autorisé');
      }
      return base44.entities.AthleteProfile.filter({ athlete_email: selectedAthleteEmail });
    },
    enabled: !!selectedAthleteEmail,
  });

  // Charger les données utilisateur de l'athlète (pour permissions)
  const { data: athleteUserData } = useQuery({
    queryKey: ['athlete-user-data', selectedAthleteEmail],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users.find(u => u.email === selectedAthleteEmail) || null;
    },
    enabled: !!selectedAthleteEmail && isAdmin,
  });

  React.useEffect(() => {
    if (athleteUserData) {
      setAthletePermissions({
        can_access_subjective_data_page: athleteUserData.can_access_subjective_data_page !== false,
        can_access_objective_data_page: athleteUserData.can_access_objective_data_page !== false,
      });
    }
  }, [athleteUserData?.id]);

  const handleSavePermissions = async () => {
    if (!athleteUserData) return;
    setSavingPermissions(true);
    await base44.entities.User.update(athleteUserData.id, athletePermissions);
    toast.success('Permissions mises à jour');
    setSavingPermissions(false);
  };

  const handleToggleCoach = async (coachEmail) => {
    if (!profile) return;
    setSavingCoachAssign(true);
    const current = profile.assigned_coach_emails || [];
    const updated = current.includes(coachEmail)
      ? current.filter(e => e !== coachEmail)
      : [...current, coachEmail];
    await base44.entities.AthleteProfile.update(profile.id, { assigned_coach_emails: updated });
    queryClient.invalidateQueries({ queryKey: ['athlete-profile', selectedAthleteEmail] });
    toast.success('Assignation mise à jour');
    setSavingCoachAssign(false);
  };

  // Charger le groupe de l'athlète
  const { data: athleteGroups = [] } = useQuery({
    queryKey: ['athlete-groups', selectedAthleteEmail],
    queryFn: async () => {
      const allGroups = await base44.entities.Group.list();
      return allGroups.filter(g => g.athlete_emails.includes(selectedAthleteEmail));
    },
    enabled: !!selectedAthleteEmail,
  });

  const profile = profiles?.[0];

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    sport: '',
    birth_date: '',
  });

  useEffect(() => {
    if (profile) {
      const nameParts = (profile.athlete_name || '').split(' ');
      const data = {
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        sport: profile.sport || '',
        birth_date: profile.birth_date ? profile.birth_date.slice(0, 10) : '',
      };
      setFormData(data);
      setInitialFormData(data);
      setHasChanges(false);
    } else if (selectedAthleteEmail && user && !profile) {
      const athlete = athletes.find(a => a.email === selectedAthleteEmail);
      const fullName = athlete?.name || user.full_name || '';
      const nameParts = fullName.split(' ');
      const data = {
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        sport: '',
        birth_date: user?.birth_date ? user.birth_date.slice(0, 10) : '',
      };
      setFormData(data);
      setInitialFormData(data);
      setHasChanges(false);
    }
  }, [profile?.id, selectedAthleteEmail]);

  const isAthleteOnboarding = !isAdmin && !isCoach && !profile;

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.AthleteProfile.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-profile'] });
      toast.success('Profil créé avec succès !');
      setIsEditing(false);
      window.location.href = createPageUrl('AthleteHome');
    },
    onError: (err) => toast.error('Erreur lors de la création : ' + err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AthleteProfile.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-profile'] });
      toast.success('Profil mis à jour avec succès');
      setIsEditing(false);
      setHasChanges(false);
    },
    onError: (err) => toast.error('Erreur lors de la mise à jour : ' + err.message),
  });

  const updateFormData = (updates) => {
    const newData = { ...formData, ...updates };
    setFormData(newData);
    
    // Vérifier si des changements ont été faits par rapport aux données initiales
    if (initialFormData) {
      const changed = Object.keys(newData).some(key => 
        newData[key] !== initialFormData[key]
      );
      setHasChanges(changed);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Sécurité : un athlète ne peut modifier que son propre profil, coach et admin peuvent modifier
    if (!isAdmin && !isCoach && selectedAthleteEmail !== user?.email) {
      toast.error('Accès non autorisé');
      return;
    }
    
    const data = {
      athlete_name: `${formData.first_name} ${formData.last_name}`.trim(),
      athlete_email: selectedAthleteEmail,
      sport: formData.sport,
      birth_date: formData.birth_date || null,
    };

    if (profile) {
      updateMutation.mutate({ id: profile.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-3 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto px-0 sm:px-2">
        {!isAthleteOnboarding && (
          <div className="mb-6">
            <Button variant="outline" className="gap-2" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
          </div>
        )}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            {isAthleteOnboarding ? 'Bienvenue ! Complétez votre profil' : 'Fiche Athlète'}
          </h1>
          <p className="text-slate-600">
            {isAthleteOnboarding
              ? 'Avant de commencer, renseignez quelques informations pour que votre coach puisse vous accompagner au mieux.'
              : isAdmin || isCoach ? 'Consultez et modifiez les informations des athlètes' : 'Consultez et modifiez vos informations personnelles'}
          </p>
        </div>

      {/* Sélecteur d'athlète (admin seulement) */}
      {isAdmin && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Sélectionner un athlète</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Rechercher par nom ou email..."
                  value={athleteSearch}
                  onChange={(e) => setAthleteSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedAthleteEmail || ''} onValueChange={setSelectedAthleteEmail}>
                <SelectTrigger className="sm:w-72">
                  <SelectValue placeholder="Choisir un athlète..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredAthletes.length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-500">Aucun athlète trouvé</div>
                  )}
                  {filteredAthletes.map(athlete => (
                    <SelectItem key={athlete.email} value={athlete.email}>
                      {athlete.name} ({athlete.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulaire du profil */}
      {selectedAthleteEmail && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <CardTitle>{formData.first_name} {formData.last_name}</CardTitle>
                  <CardDescription className="flex items-center gap-2 flex-wrap">
                    {selectedAthleteEmail}
                    {athleteGroups.length > 0 && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        Groupe: {athleteGroups[0].name}
                      </Badge>
                    )}
                  </CardDescription>
                </div>
              </div>
              {isAdmin && (
                <Button
                  type="button"
                  variant={isEditing ? 'outline' : 'default'}
                  size="sm"
                  className="gap-2 shrink-0"
                  onClick={() => {
                    if (isEditing) {
                      if (initialFormData) setFormData(initialFormData);
                      setHasChanges(false);
                    }
                    setIsEditing(!isEditing);
                  }}
                >
                  {isEditing ? <><X className="w-4 h-4" />Annuler</> : <><Edit2 className="w-4 h-4" />Modifier</>}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="first_name" className="text-sm">Prénom *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => updateFormData({ first_name: e.target.value })}
                    disabled={isAdmin && !isEditing}
                    required
                     />
                     </div>

                     <div className="space-y-2">
                     <Label htmlFor="last_name">Nom *</Label>
                     <Input
                     id="last_name"
                     value={formData.last_name}
                     onChange={(e) => updateFormData({ last_name: e.target.value })}
                     disabled={isAdmin && !isEditing}
                     required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="sport" className="text-sm">Sport *</Label>
                  <Input
                    id="sport"
                    value={formData.sport}
                    onChange={(e) => updateFormData({ sport: e.target.value })}
                    disabled={isAdmin && !isEditing}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birth_date" className="text-sm">Date de naissance</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => updateFormData({ birth_date: e.target.value })}
                    disabled={isAdmin && !isEditing}
                  />
                </div>

              </div>

              {!isAdmin && !isCoach && (hasChanges || isAthleteOnboarding) && (
                <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
                  <Button type="submit" className="gap-2 w-full sm:w-auto">
                    <Save className="w-4 h-4" />
                    {isAthleteOnboarding
                      ? <span>Enregistrer et accéder au dashboard</span>
                      : <><span className="hidden sm:inline">Enregistrer les modifications</span><span className="sm:hidden">Enregistrer</span></>
                    }
                  </Button>
                </div>
              )}

              {(isAdmin || isCoach) && hasChanges && (
                <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
                  <Button type="submit" className="gap-2 w-full sm:w-auto">
                    <Save className="w-4 h-4" />
                    Enregistrer
                  </Button>
                </div>
              )}
              {isAdmin && isEditing && !hasChanges && (
                <div className="pt-4 border-t text-sm text-slate-400 text-right">
                  Modifiez les champs ci-dessus puis enregistrez
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}

        {/* Section assignation entraîneurs (admin uniquement) */}
        {isAdmin && selectedAthleteEmail && profile && allCoaches.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-green-600" />
                Entraîneurs assignés
              </CardTitle>
              <CardDescription>Sélectionnez les entraîneurs qui suivent cet athlète</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {allCoaches.map(coach => {
                  const assigned = (profile.assigned_coach_emails || []).includes(coach.email);
                  return (
                    <div key={coach.email} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50">
                      <Checkbox
                        id={`coach-${coach.email}`}
                        checked={assigned}
                        onCheckedChange={() => handleToggleCoach(coach.email)}
                        disabled={savingCoachAssign}
                      />
                      <label htmlFor={`coach-${coach.email}`} className="flex-1 cursor-pointer">
                        <p className="font-medium text-slate-800">{coach.full_name}</p>
                        <p className="text-xs text-slate-500">{coach.email} · {coach.user_status === 'coach_pro' ? 'Coach Pro' : 'Coach'}</p>
                      </label>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section permissions (admin uniquement) */}
        {isAdmin && selectedAthleteEmail && athleteUserData && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                Gestion des accès
              </CardTitle>
              <CardDescription>Contrôlez les pages accessibles à cet athlète</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <BarChart2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Accès aux données subjectives</p>
                    <p className="text-xs text-slate-500 mt-0.5">Dashboard personnel et statistiques questionnaires</p>
                  </div>
                </div>
                <Switch
                  checked={athletePermissions.can_access_subjective_data_page}
                  onCheckedChange={(val) => setAthletePermissions(p => ({ ...p, can_access_subjective_data_page: val }))}
                />
              </div>
              <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Accès aux données objectives</p>
                    <p className="text-xs text-slate-500 mt-0.5">Données Strava (distance, vitesse, fréquence cardiaque...)</p>
                  </div>
                </div>
                <Switch
                  checked={athletePermissions.can_access_objective_data_page}
                  onCheckedChange={(val) => setAthletePermissions(p => ({ ...p, can_access_objective_data_page: val }))}
                />
              </div>
              <Button onClick={handleSavePermissions} disabled={savingPermissions} className="w-full">
                {savingPermissions ? 'Enregistrement...' : 'Enregistrer les permissions'}
              </Button>
            </CardContent>
          </Card>
        )}

        {!selectedAthleteEmail && isAdmin && (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              Sélectionnez un athlète pour voir sa fiche
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}