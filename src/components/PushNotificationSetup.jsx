import React, { useState, useEffect } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Bell, BellOff, Clock } from 'lucide-react';
import { toast } from 'sonner';



function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function PushNotificationSetup({ athleteEmail }) {
  const queryClient = useQueryClient();
  const [permissionStatus, setPermissionStatus] = useState(Notification.permission);
  const [reminderTime, setReminderTime] = useState('20:00');
  const [vapidPublicKey, setVapidPublicKey] = useState(null);

  useEffect(() => {
    base44.functions.invoke('getVapidPublicKey', {}).then(res => {
      setVapidPublicKey(res.data.publicKey);
    });
  }, []);

  const { data: pref } = useQuery({
    queryKey: ['user-preference', athleteEmail],
    queryFn: async () => {
      const prefs = await base44.entities.UserPreference.filter({ athlete_email: athleteEmail });
      return prefs[0] || null;
    },
    enabled: !!athleteEmail
  });

  const savePrefMutation = useMutation({
    mutationFn: async (data) => {
      if (pref?.id) {
        return base44.entities.UserPreference.update(pref.id, data);
      } else {
        return base44.entities.UserPreference.create({ athlete_email: athleteEmail, ...data });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-preference', athleteEmail] })
  });

  const isSubscribed = !!pref?.push_subscription;
  const notifEnabled = pref?.notifications_enabled !== false;

  useEffect(() => {
    if (pref?.daily_reminder_time) {
      setReminderTime(pref.daily_reminder_time);
    }
  }, [pref]);

  const handleSubscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error("Les notifications push ne sont pas supportées par votre navigateur.");
      return;
    }
    const permission = await Notification.requestPermission();
    setPermissionStatus(permission);
    if (permission !== 'granted') {
      toast.error("Permission de notification refusée.");
      return;
    }
    if (!vapidPublicKey) {
      toast.error("Clé VAPID non disponible, veuillez réessayer.");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
    await savePrefMutation.mutateAsync({
      push_subscription: subscription.toJSON(),
      notifications_enabled: true,
      daily_reminder_time: pref?.daily_reminder_time || '20:00'
    });
    toast.success("Notifications activées !");
  };

  const handleUnsubscribe = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) await subscription.unsubscribe();
      }
    }
    await savePrefMutation.mutateAsync({ push_subscription: null, notifications_enabled: false });
    toast.success("Notifications désactivées.");
  };

  const handleTimeChange = async (e) => {
    await savePrefMutation.mutateAsync({ daily_reminder_time: e.target.value });
    toast.success("Heure du rappel enregistrée !");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="w-5 h-5" />
          Notifications push
        </CardTitle>
        <p className="text-sm text-slate-500 mt-1">
          Recevez des rappels pour remplir vos questionnaires.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {permissionStatus === 'denied' ? (
          <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-sm text-red-700">
            Les notifications sont bloquées dans votre navigateur. Veuillez les autoriser dans les paramètres de votre navigateur.
          </div>
        ) : (
          <>
            {isSubscribed && notifEnabled && (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <Bell className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">Notifications activées</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    Rappel 1h après chaque séance, et à l'heure choisie les jours sans séance.
                  </p>
                </div>
              </div>
            )}
            <Button
              className="gap-2 w-full"
              onClick={handleSubscribe}
              disabled={savePrefMutation.isPending || (isSubscribed && notifEnabled)}
            >
              <Bell className="w-4 h-4" />
              {isSubscribed && notifEnabled ? 'Notifications déjà activées' : 'Activer les notifications push'}
            </Button>
          </>
        )}

        {/* Heure du rappel quotidien - toujours visible */}
        <div className="border-t pt-4">
          <Label className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4" />
            Heure du rappel quotidien (jours sans séance)
          </Label>
          <input
            type="time"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            onBlur={handleTimeChange}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <p className="text-xs text-slate-400 mt-1">
            La notification ne sera pas envoyée si vous avez déjà répondu au questionnaire.
          </p>
        </div>

        {isSubscribed && notifEnabled && (
          <div className="border-t pt-4">
            <Button
              variant="outline"
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50 w-full"
              onClick={handleUnsubscribe}
              disabled={savePrefMutation.isPending}
            >
              <BellOff className="w-4 h-4" />
              Désactiver les notifications
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}