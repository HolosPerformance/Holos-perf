import React, { useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, ArrowLeft, Shield, Users, UserCheck, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ClubManagement() {
  const { user: currentUser } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const navigate = useNavigate();
  const qc = useQueryClient();

  const isCoach = currentUser?.user_status === 'coach' || currentUser?.user_status === 'coach_pro';
  const isAdmin = currentUser?.user_status === 'admin';

  const { data: clubs = [], isLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => base44.entities.Club.list(),
  });

  const createMutation = useMutation({
    mutationFn: (name) => base44.entities.Club.create({ name, coach_emails: [], athlete_emails: [], invite_links: [] }),
    onSuccess: (club) => {
      qc.invalidateQueries(['clubs']);
      navigate(`/ClubDetails?id=${club.id}`);
    }
  });

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate(newName.trim());
  };

  // Vue coach : trouver son club et afficher les membres
  const myClub = isCoach && clubs.find(c =>
    c.coach_emails?.includes(currentUser?.email) || c.athlete_emails?.includes(currentUser?.email)
  );

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-club'],
    queryFn: () => base44.entities.User.list(),
    enabled: isCoach && clubs.length > 0,
  });

  if (isCoach) {
    const coachEmails = myClub?.coach_emails || [];
    const athleteEmails = myClub?.athlete_emails || [];
    const coaches = allUsers.filter(u => coachEmails.includes(u.email));
    const athletes = allUsers.filter(u => athleteEmails.includes(u.email));

    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-800">{myClub ? myClub.name : 'Mon Club'}</h1>
              <p className="text-slate-500">Membres affiliés à votre club</p>
            </div>
            {myClub && (
              <Link to={`/ClubDetails?id=${myClub.id}`}>
                <Button size="sm" variant="outline" className="gap-2">
                  <Settings className="w-4 h-4" />
                  Gérer le club
                </Button>
              </Link>
            )}
          </div>

          {!myClub ? (
            <div className="text-center py-16">
              <Shield className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">Vous n'êtes affilié à aucun club</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Entraîneurs */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UserCheck className="w-5 h-5 text-slate-600" />
                    Entraîneurs ({coaches.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {coaches.length === 0 ? (
                    <p className="text-slate-400 text-sm">Aucun entraîneur</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {coaches.map(u => (
                        <div key={u.email} className="flex items-center gap-3 py-3">
                          <div className="w-9 h-9 bg-slate-700 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {u.full_name?.[0] || u.email[0]}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{u.full_name || u.email}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                          <span className="ml-auto text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                            {u.user_status === 'coach_pro' ? 'Coach Pro' : 'Entraîneur'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Athlètes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="w-5 h-5 text-slate-600" />
                    Athlètes ({athletes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {athletes.length === 0 ? (
                    <p className="text-slate-400 text-sm">Aucun athlète</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {athletes.map(u => (
                        <div key={u.email} className="flex items-center gap-3 py-3">
                          <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {u.full_name?.[0] || u.email[0]}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{u.full_name || u.email}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                          <span className="ml-auto text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600">
                            Athlète
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link to={createPageUrl('AdminHome')}>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Gestion des Clubs</h1>
            <p className="text-slate-500">Créez et gérez les clubs de votre organisation</p>
          </div>
        </div>

        <div className="flex justify-end mb-6">
          <Button onClick={() => setShowCreate(true)} className="gap-2 bg-slate-800 hover:bg-slate-700">
            <Plus className="w-4 h-4" />
            Créer un club
          </Button>
        </div>

        {showCreate && (
          <Card className="mb-6 border-2 border-slate-200">
            <CardHeader>
              <CardTitle>Nouveau club</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <Label>Nom du club</Label>
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Ex: Club Athlétique de Lyon"
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-slate-800">
                Créer
              </Button>
              <Button variant="outline" onClick={() => { setShowCreate(false); setNewName(''); }}>
                Annuler
              </Button>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="text-center py-16 text-slate-400">Chargement...</div>
        ) : clubs.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">Aucun club créé pour l'instant</p>
            <p className="text-slate-400 text-sm mt-1">Cliquez sur "Créer un club" pour commencer</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clubs.map(club => (
              <Link key={club.id} to={`/ClubDetails?id=${club.id}`}>
                <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer h-full border-0 overflow-hidden">
                  <div className="h-2" style={{ background: club.primary_color || '#1e293b' }} />
                  <CardContent className="pt-6 pb-6 flex flex-col items-center text-center gap-3">
                    {club.logo_url ? (
                      <img src={club.logo_url} alt={club.name} className="w-20 h-20 object-contain rounded-xl" />
                    ) : (
                      <div className="w-20 h-20 rounded-xl flex items-center justify-center text-white text-3xl font-bold"
                        style={{ background: club.primary_color || '#1e293b' }}>
                        {club.name[0]}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">{club.name}</h3>
                      <p className="text-sm text-slate-500 mt-1">
                        {(club.coach_emails?.length || 0)} coach(s) · {(club.athlete_emails?.length || 0)} athlète(s)
                      </p>
                    </div>
                    <div className="text-sm text-slate-600 group-hover:text-slate-800 font-medium flex items-center gap-1 mt-auto">
                      Gérer le club
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}