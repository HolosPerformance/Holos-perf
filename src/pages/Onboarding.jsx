import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, UserCheck } from 'lucide-react';

export default function Onboarding() {
  const { updateProfile, logout } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim()) {
      setError('Le prénom et le nom sont obligatoires.');
      return;
    }

    setLoading(true);

    // updateProfile met à jour la table profiles ET recalcule authState
    // → App.jsx basculera automatiquement vers 'pending' une fois first_name rempli
    const result = await updateProfile({
      first_name: firstName.trim(),
      last_name:  lastName.trim(),
      full_name:  `${firstName.trim()} ${lastName.trim()}`,
      birth_date: birthDate || null,
    });

    if (!result.success) {
      setError(result.error || 'Une erreur est survenue. Veuillez réessayer.');
      setLoading(false);
    }
    // Si succès : authState passe à 'pending' → App.jsx affiche PendingApprovalPage
    // automatiquement, pas besoin de navigate()
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <img
            src="/logo.png"
            alt="Logo Holos Performance"
            className="block w-20 h-20 object-contain mx-auto mb-2"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center">
              <UserCheck className="w-7 h-7 text-slate-700" />
            </div>
          </div>
          <CardTitle className="text-2xl">Complétez votre profil</CardTitle>
          <CardDescription className="text-base mt-1">
            Ces informations permettront à votre coach ou administrateur de confirmer votre identité avant de valider votre accès.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  placeholder="Jean"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  placeholder="Dupont"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate">Date de naissance</Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={e => setBirthDate(e.target.value)}
              />
              <p className="text-xs text-slate-400">
                Optionnel, mais recommandé pour faciliter votre identification.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-slate-800 hover:bg-slate-700 mt-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</>
                : 'Envoyer ma demande d\'accès'
              }
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={logout}
                className="text-sm text-slate-400 hover:text-slate-600 underline"
              >
                Se déconnecter
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
