import React, { useState, useEffect } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { supabaseRaw } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StravaConnect from '@/components/StravaConnect';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import { User, Mail, Palette, Save, Info, Upload, X, Image, LogOut } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [profileForm, setProfileForm] = useState({ full_name: '' });
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user) setProfileForm({ full_name: user.full_name || '' });
  }, [user?.email]);

  const isCoach = user?.user_status === 'coach' || user?.user_status === 'coach_pro';

  const { data: coachClub } = useQuery({
    queryKey: ['coach-club', user?.email],
    queryFn: async () => {
      const clubs = await base44.entities.Club.list();
      return clubs.find(c => (c.coach_emails || []).includes(user.email)) || null;
    },
    enabled: !!user?.email && isCoach,
  });

  const hasClub = !!coachClub;

  const { data: branding, isLoading: brandingLoading } = useQuery({
    queryKey: ['coach-branding', user?.email],
    queryFn: () => base44.entities.CoachBranding.filter({ coach_email: user.email }),
    enabled: !!user?.email && isCoach && !hasClub,
    select: (data) => data[0] || null,
  });

  const [colorForm, setColorForm] = useState({ primary_color: '#3b82f6', secondary_color: '', club_name: '', club_logo_url: '' });
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    if (branding) {
      setColorForm({
        primary_color: branding.primary_color || '#3b82f6',
        secondary_color: branding.secondary_color || '',
        club_name: branding.club_name || '',
        club_logo_url: branding.club_logo_url || '',
      });
    }
  }, [branding]);

  const saveBrandingMutation = useMutation({
    mutationFn: async (data) => {
      if (branding?.id) {
        return base44.entities.CoachBranding.update(branding.id, data);
      } else {
        return base44.entities.CoachBranding.create({ ...data, coach_email: user.email });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-branding'] });
      toast.success('Personnalisation enregistrée ! Les athlètes verront les nouvelles couleurs.');
      // Appliquer immédiatement pour le coach
      applyColors(colorForm.primary_color, colorForm.secondary_color);
    }
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `logos/${user.email.replace('@', '_')}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabaseRaw.storage.from('branding').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabaseRaw.storage.from('branding').getPublicUrl(path);
      setColorForm(prev => ({ ...prev, club_logo_url: publicUrl }));
      toast.success('Logo importé !');
    } catch (err) {
      toast.error('Erreur lors de l\'import du logo : ' + err.message);
    } finally {
      setLogoUploading(false);
    }
  };

  const applyColors = (primary, secondary) => {
    function hexToHsl(hex) {
      if (!hex || !hex.startsWith('#')) return null;
      let r = parseInt(hex.slice(1, 3), 16) / 255;
      let g = parseInt(hex.slice(3, 5), 16) / 255;
      let b = parseInt(hex.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;
      if (max === min) { h = s = 0; } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    }
    if (primary) {
      const hsl = hexToHsl(primary);
      if (hsl) {
        document.documentElement.style.setProperty('--card', hsl);
        document.documentElement.style.setProperty('--card-foreground', '0 0% 100%');
        document.documentElement.style.setProperty('--primary', hsl);
      }
    }
    if (secondary) {
      const hsl = hexToHsl(secondary);
      if (hsl) document.documentElement.style.setProperty('--secondary', hsl);
    } else {
      document.documentElement.style.setProperty('--secondary', '0 0% 100%');
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Paramètres du compte</h1>

      {/* Informations du compte */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="w-5 h-5" />
            Informations du compte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-600">Nom complet</Label>
              <p className="mt-1 text-slate-800 font-medium">{user.full_name}</p>
            </div>
            <div>
              <Label className="text-slate-600">Statut</Label>
              <p className="mt-1">
                <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                  user.user_status === 'admin' ? 'bg-amber-100 text-amber-700' :
                  user.user_status === 'coach_pro' ? 'bg-purple-100 text-purple-700' :
                  user.user_status === 'coach' ? 'bg-slate-100 text-slate-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {user.user_status === 'admin' ? 'Administrateur' :
                   user.user_status === 'coach_pro' ? 'Entraîneur Pro' :
                   user.user_status === 'coach' ? 'Entraîneur' : 'Athlète'}
                </span>
              </p>
            </div>
          </div>

          <div>
            <Label className="text-slate-600 flex items-center gap-1">
              <Mail className="w-4 h-4" /> Adresse e-mail
            </Label>
            <p className="mt-1 text-slate-800 font-medium">{user.email}</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg flex items-start gap-2 border border-slate-200">
            <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-slate-600 font-medium">Modifier votre mot de passe ou e-mail</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Pour des raisons de sécurité, la modification de l'e-mail et du mot de passe est gérée
                directement par la plateforme. Déconnectez-vous et utilisez "Mot de passe oublié" sur la
                page de connexion pour changer votre mot de passe.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personnalisation couleurs - uniquement pour coaches sans club assigné */}
      {isCoach && !hasClub && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palette className="w-5 h-5" />
              Personnalisation de l'application
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Ces couleurs seront appliquées pour vous et tous vos athlètes.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Logo du club */}
            <div>
              <Label className="mb-2 block">Logo du club <span className="text-slate-400">(optionnel)</span></Label>
              <div className="flex items-center gap-4">
                {colorForm.club_logo_url ? (
                  <div className="relative">
                    <img
                      src={colorForm.club_logo_url}
                      alt="Logo club"
                      className="w-20 h-20 object-contain rounded-xl border border-slate-200 bg-slate-50 p-2"
                    />
                    <button
                      onClick={() => setColorForm(prev => ({ ...prev, club_logo_url: '' }))}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center bg-slate-50">
                    <Image className="w-8 h-8 text-slate-300" />
                  </div>
                )}
                <div>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors ${logoUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      <Upload className="w-4 h-4" />
                      {logoUploading ? 'Chargement...' : 'Importer un logo'}
                    </span>
                  </label>
                  <p className="text-xs text-slate-500 mt-1">PNG, SVG ou JPG recommandé</p>
                  <p className="text-xs text-slate-400">Sera affiché en fond de l'application</p>
                </div>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Nom du club (optionnel)</Label>
              <Input
                placeholder="Ex: Club Athlétisme Paris"
                value={colorForm.club_name}
                onChange={(e) => setColorForm({ ...colorForm, club_name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Couleur principale *</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={colorForm.primary_color}
                    onChange={(e) => setColorForm({ ...colorForm, primary_color: e.target.value })}
                    className="w-12 h-12 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                  />
                  <div>
                    <p className="text-sm font-mono text-slate-700">{colorForm.primary_color}</p>
                    <p className="text-xs text-slate-500">Couleur des cartes</p>
                  </div>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Couleur secondaire <span className="text-slate-400">(optionnel)</span></Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={colorForm.secondary_color || '#ffffff'}
                    onChange={(e) => setColorForm({ ...colorForm, secondary_color: e.target.value })}
                    className="w-12 h-12 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                  />
                  <div>
                    <p className="text-sm font-mono text-slate-700">{colorForm.secondary_color || '#ffffff'}</p>
                    <p className="text-xs text-slate-500">Blanc par défaut</p>
                  </div>
                </div>
                {colorForm.secondary_color && (
                  <button
                    className="mt-1 text-xs text-slate-400 underline"
                    onClick={() => setColorForm({ ...colorForm, secondary_color: '' })}
                  >
                    Réinitialiser au blanc
                  </button>
                )}
              </div>
            </div>

            {/* Aperçu */}
            <div>
              <Label className="mb-2 block">Aperçu</Label>
              <div
                className="rounded-xl p-4 border flex items-center justify-between"
                style={{ backgroundColor: colorForm.primary_color }}
              >
                <div>
                  <p className="font-semibold text-white">Exemple de carte</p>
                  <p className="text-sm text-white/80">Voici à quoi ressembleront les cartes</p>
                </div>
                <div
                  className="w-8 h-8 rounded-full border-2 border-white"
                  style={{ backgroundColor: colorForm.secondary_color || '#ffffff' }}
                />
              </div>
            </div>

            <Button
              onClick={() => saveBrandingMutation.mutate(colorForm)}
              disabled={saveBrandingMutation.isPending}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {saveBrandingMutation.isPending ? 'Enregistrement...' : 'Enregistrer la personnalisation'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Message pour coaches avec club */}
      {isCoach && hasClub && (
        <Card className="border-blue-100 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800">Personnalisation disponible dans la Gestion du Club</p>
                <p className="text-xs text-blue-600 mt-1">
                  Vous êtes assigné au club <strong>{coachClub?.name}</strong>. Rendez-vous dans "Gestion du Club" pour modifier les couleurs et le logo.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Déconnexion */}
      <Card className="border-red-100">
        <CardContent className="pt-6">
          <Button
            variant="outline"
            className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => base44.auth.logout?.() || supabaseRaw.auth.signOut()}
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}