import React, { useState, useEffect } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { Button } from "@/components/ui/button";
import { Bell, BellOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const STORAGE_KEY = 'push_prompt_dismissed';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function PushNotificationPrompt({ athleteEmail }) {
  const [visible, setVisible] = useState(false);
  const [pref, setPref] = useState(null);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!athleteEmail) return;
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;
    if (!('Notification' in window) || Notification.permission === 'denied') return;

    const check = async () => {
      const prefs = await base44.entities.UserPreference.filter({ athlete_email: athleteEmail });
      const existing = prefs[0] || null;
      setPref(existing);
      // Show prompt if no push subscription yet
      if (!existing?.push_subscription) {
        setVisible(true);
      }
    };
    check();
  }, [athleteEmail]);

  const handleActivate = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error("Les notifications push ne sont pas supportées par votre navigateur.");
      return;
    }
    setLoading(true);
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      toast.error("Permission refusée. Vous pouvez activer les notifications depuis les paramètres.");
      dismiss();
      setLoading(false);
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    const data = {
      push_subscription: subscription.toJSON(),
      notifications_enabled: true,
      daily_reminder_time: pref?.daily_reminder_time || '20:00'
    };
    if (pref?.id) {
      await base44.entities.UserPreference.update(pref.id, data);
    } else {
      await base44.entities.UserPreference.create({ athlete_email: athleteEmail, ...data });
    }
    queryClient.invalidateQueries({ queryKey: ['user-preference', athleteEmail] });
    toast.success("Notifications activées !");
    dismiss();
    setLoading(false);
  };

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
            <Bell className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 text-sm">Activer les rappels ?</p>
            <p className="text-xs text-slate-500 mt-1">
              Recevez une notification après chaque séance et un rappel quotidien pour remplir vos questionnaires.
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button
            className="flex-1 gap-2 text-sm"
            onClick={handleActivate}
            disabled={loading}
          >
            <Bell className="w-4 h-4" />
            Activer
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2 text-sm text-slate-500"
            onClick={dismiss}
            disabled={loading}
          >
            <BellOff className="w-4 h-4" />
            Plus tard
          </Button>
        </div>
      </div>
    </div>
  );
}