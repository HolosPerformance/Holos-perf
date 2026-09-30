import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Bell, BellOff, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  DEFAULT_REMINDER_TIME,
  REMINDER_TIME_OPTIONS,
  disablePushNotifications,
  enablePushNotifications,
  getPushBlocker,
  loadPreferences,
  savePreferences,
  snapToReminderSlot,
} from '@/lib/pushNotifications';

export default function PushNotificationSetup({ athleteEmail }) {
  const queryClient = useQueryClient();
  const [reminderTime, setReminderTime] = useState(DEFAULT_REMINDER_TIME);
  const [blocker, setBlocker] = useState(null);

  // Évalué au montage : dépend de la permission et du mode d'affichage, pas du rendu.
  useEffect(() => { setBlocker(getPushBlocker()); }, []);

  const { data: preferences } = useQuery({
    queryKey: ['user-preference', athleteEmail],
    queryFn: async () => (await loadPreferences(athleteEmail)).preferences,
    enabled: !!athleteEmail,
  });

  useEffect(() => {
    if (preferences?.daily_reminder_time) {
      setReminderTime(snapToReminderSlot(preferences.daily_reminder_time));
    }
  }, [preferences?.daily_reminder_time]);

  const isSubscribed = !!preferences?.push_subscription;
  const notifEnabled = preferences?.notifications_enabled !== false;
  const isActive = isSubscribed && notifEnabled;

  const mutate = useMutation({
    mutationFn: ({ run }) => run(),
    onSuccess: (_data, { successMessage }) => {
      queryClient.invalidateQueries({ queryKey: ['user-preference', athleteEmail] });
      toast.success(successMessage);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubscribe = () => {
    setBlocker(getPushBlocker());
    mutate.mutate({
      run: () => enablePushNotifications(athleteEmail),
      successMessage: "Notifications activées !",
    });
  };

  const handleUnsubscribe = () => {
    mutate.mutate({
      run: () => disablePushNotifications(athleteEmail),
      successMessage: "Notifications désactivées.",
    });
  };

  const handleTimeChange = (e) => {
    const value = e.target.value;
    setReminderTime(value);
    if (!value || value === preferences?.daily_reminder_time) return;
    mutate.mutate({
      run: () => savePreferences(athleteEmail, { daily_reminder_time: value }),
      successMessage: "Heure du rappel enregistrée !",
    });
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
        {blocker ? (
          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">{blocker.message}</p>
          </div>
        ) : (
          <>
            {isActive && (
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
              disabled={mutate.isPending || isActive}
            >
              <Bell className="w-4 h-4" />
              {isActive ? 'Notifications déjà activées' : 'Activer les notifications push'}
            </Button>
          </>
        )}

        {/* Heure du rappel quotidien : réglable même sans abonnement actif. */}
        <div className="border-t pt-4">
          <Label htmlFor="daily-reminder-time" className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4" />
            Heure du rappel quotidien (jours sans séance)
          </Label>
          <select
            id="daily-reminder-time"
            value={reminderTime}
            onChange={handleTimeChange}
            disabled={mutate.isPending}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {REMINDER_TIME_OPTIONS.map((slot) => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Par tranches de 15 min, entre 7h et 23h30. La notification ne sera pas
            envoyée si vous avez déjà répondu au questionnaire.
          </p>
        </div>

        {isActive && (
          <div className="border-t pt-4">
            <Button
              variant="outline"
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50 w-full"
              onClick={handleUnsubscribe}
              disabled={mutate.isPending}
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
