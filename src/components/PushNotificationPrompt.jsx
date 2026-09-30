import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Bell, BellOff, X, Share } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  enablePushNotifications,
  getPushBlocker,
  loadPreferences,
} from '@/lib/pushNotifications';

const STORAGE_KEY = 'push_prompt_dismissed';

export default function PushNotificationPrompt({ athleteEmail }) {
  const [visible, setVisible] = useState(false);
  const [blocker, setBlocker] = useState(null);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!athleteEmail) return;
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;

    const currentBlocker = getPushBlocker();
    // Navigateur incapable ou permission déjà refusée : l'encart ne servirait à rien.
    // Seul iOS mérite d'être affiché, pour expliquer l'installation sur l'écran d'accueil.
    if (currentBlocker && currentBlocker.code !== 'ios-not-installed') return;

    let cancelled = false;
    loadPreferences(athleteEmail)
      .then(({ preferences }) => {
        if (cancelled) return;
        if (preferences.push_subscription) return; // déjà abonné
        setBlocker(currentBlocker);
        setVisible(true);
      })
      .catch((err) => console.warn('Lecture des préférences de notification :', err.message));

    return () => { cancelled = true; };
  }, [athleteEmail]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  const handleActivate = async () => {
    setLoading(true);
    try {
      await enablePushNotifications(athleteEmail);
      queryClient.invalidateQueries({ queryKey: ['user-preference', athleteEmail] });
      toast.success("Notifications activées !");
      dismiss();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  const iosNeedsInstall = blocker?.code === 'ios-not-installed';

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 p-5">
        <button
          onClick={dismiss}
          aria-label="Fermer"
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
            {iosNeedsInstall
              ? <Share className="w-6 h-6 text-blue-600" />
              : <Bell className="w-6 h-6 text-blue-600" />}
          </div>
          <div className="flex-1 min-w-0">
            {iosNeedsInstall ? (
              <>
                <p className="font-semibold text-slate-800 text-sm">Installer Holos pour les rappels</p>
                <p className="text-xs text-slate-500 mt-1">
                  Sur iPhone, les notifications ne fonctionnent que depuis l'app installée.
                  Touche <strong>Partager</strong>, puis <strong>« Sur l'écran d'accueil »</strong>,
                  et rouvre Holos depuis cette icône.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-slate-800 text-sm">Activer les rappels ?</p>
                <p className="text-xs text-slate-500 mt-1">
                  Reçois une notification après chaque séance et un rappel quotidien
                  pour remplir tes questionnaires.
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          {!iosNeedsInstall && (
            <Button className="flex-1 gap-2 text-sm" onClick={handleActivate} disabled={loading}>
              <Bell className="w-4 h-4" />
              {loading ? 'Activation…' : 'Activer'}
            </Button>
          )}
          <Button
            variant="outline"
            className="flex-1 gap-2 text-sm text-slate-500"
            onClick={dismiss}
            disabled={loading}
          >
            <BellOff className="w-4 h-4" />
            {iosNeedsInstall ? 'Compris' : 'Plus tard'}
          </Button>
        </div>
      </div>
    </div>
  );
}
