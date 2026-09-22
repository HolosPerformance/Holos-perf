import React, { useEffect, useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function JoinClub() {
  const urlParams = new URLSearchParams(window.location.search);
  const clubId = urlParams.get('club');
  const token = urlParams.get('token');

  const { user } = useAuth();
  const [state, setState] = useState('loading'); // loading | confirm | success | error
  const [club, setClub] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      if (!clubId || !token) { setState('error'); return; }
      const clubs = await base44.entities.Club.filter({ id: clubId });
      if (clubs.length === 0) { setState('error'); return; }
      const c = clubs[0];
      const link = (c.invite_links || []).find(l => l.token === token);
      if (!link) { setState('error'); return; }
      setClub(c);
      setRole(link.role);
      setState('confirm');
    };
    load();
  }, [user, clubId, token]);

  const handleJoin = async () => {
    setState('loading');
    const field = role === 'coach' ? 'coach_emails' : 'athlete_emails';
    const otherField = role === 'coach' ? 'athlete_emails' : 'coach_emails';
    const current = club[field] || [];
    if (!current.includes(user.email)) {
      const otherCurrent = (club[otherField] || []).filter(e => e !== user.email);
      await base44.entities.Club.update(club.id, {
        [field]: [...current, user.email],
        [otherField]: otherCurrent
      });
    }
    setState('success');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Card className="max-w-md w-full border-0 shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: club?.primary_color || '#1e293b' }}>
            {club?.logo_url ? (
              <img src={club.logo_url} alt={club.name} className="w-12 h-12 object-contain" />
            ) : (
              <Shield className="w-8 h-8 text-white" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {state === 'success' ? 'Bienvenue !' : state === 'error' ? 'Lien invalide' : club?.name || 'Club'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {state === 'loading' && <p className="text-slate-500">Vérification du lien...</p>}

          {state === 'confirm' && (
            <>
              <p className="text-slate-600">
                Vous avez été invité à rejoindre <strong>{club.name}</strong> en tant que{' '}
                <strong>{role === 'coach' ? 'entraîneur' : 'athlète'}</strong>.
              </p>
              <p className="text-slate-500 text-sm">Connecté en tant que : {user?.email}</p>
              <Button onClick={handleJoin} className="w-full bg-slate-800 hover:bg-slate-700">
                Rejoindre le club
              </Button>
            </>
          )}

          {state === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <p className="text-slate-600">Vous avez rejoint <strong>{club?.name}</strong> avec succès !</p>
              <Link to={createPageUrl(role === 'coach' ? 'CoachHome' : 'AthleteHome')}>
                <Button className="w-full bg-slate-800">Accéder à mon espace</Button>
              </Link>
            </>
          )}

          {state === 'error' && (
            <>
              <XCircle className="w-12 h-12 text-red-500 mx-auto" />
              <p className="text-slate-600">Ce lien d'invitation est invalide ou a expiré.</p>
              <Link to="/">
                <Button variant="outline" className="w-full">Retour à l'accueil</Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}