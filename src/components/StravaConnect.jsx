import { useState, useEffect } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, CheckCircle, Unlink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function StravaConnect({ userEmail }) {
  const [stravaToken, setStravaToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    base44.entities.StravaToken.filter({ athlete_email: userEmail })
      .then(tokens => {
        setStravaToken(tokens[0] || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userEmail]);

  const handleConnect = async () => {
    setConnecting(true);
    const res = await base44.functions.invoke('initStravaAuth', {});
    window.location.href = res.data.authUrl;
  };

  const handleDisconnect = async () => {
    if (!stravaToken) return;
    await base44.entities.StravaToken.delete(stravaToken.id);
    setStravaToken(null);
    toast.success('Compte Strava déconnecté.');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="w-5 h-5 text-orange-500" />
          Connexion Strava
        </CardTitle>
        <p className="text-sm text-slate-500 mt-1">
          Connectez votre compte Strava pour synchroniser vos activités.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Chargement...</span>
          </div>
        ) : stravaToken ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {stravaToken.strava_profile_picture && (
                <img src={stravaToken.strava_profile_picture} alt="Strava" className="w-10 h-10 rounded-full" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <p className="font-medium text-slate-800 text-sm">Compte connecté</p>
                </div>
                <p className="text-xs text-slate-500">{stravaToken.strava_athlete_name}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleDisconnect}
            >
              <Unlink className="w-4 h-4" />
              Déconnecter
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={connecting}
            className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            {connecting ? 'Redirection...' : 'Connecter Strava'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}