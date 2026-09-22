import { useEffect, useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { createPageUrl } from '@/utils';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function StravaCallback() {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const errorParam = params.get('error');

    if (errorParam) {
      setStatus('error');
      setError('Autorisation refusée par Strava.');
      return;
    }

    if (!code) {
      setStatus('error');
      setError('Code d\'autorisation manquant.');
      return;
    }

    base44.functions.invoke('handleStravaCallback', { code })
      .then(() => {
        setStatus('success');
        setTimeout(() => {
          window.location.href = createPageUrl('AthleteHome');
        }, 2000);
      })
      .catch((err) => {
        setStatus('error');
        setError(err.message || 'Une erreur est survenue.');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 flex flex-col items-center gap-4 max-w-sm w-full">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
            <p className="text-slate-700 font-medium">Connexion à Strava en cours...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500" />
            <p className="text-slate-700 font-semibold text-lg">Strava connecté avec succès !</p>
            <p className="text-slate-500 text-sm">Redirection en cours...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500" />
            <p className="text-slate-700 font-semibold text-lg">Échec de la connexion</p>
            <p className="text-slate-500 text-sm text-center">{error}</p>
            <button
              className="mt-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
              onClick={() => window.location.href = '/AthleteHome'}
            >
              Retour
            </button>
          </>
        )}
      </div>
    </div>
  );
}