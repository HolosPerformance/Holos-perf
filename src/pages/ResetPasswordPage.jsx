import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const result = await updatePassword(password);

    if (!result.success) {
      setLoading(false);
      setError(result.error || 'Une erreur est survenue.');
      return;
    }
    setSuccess(true);
    // Redirection vers l'accueil : la session de récupération est déjà active.
    window.location.href = '/';
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
          <CardTitle className="text-2xl">Nouveau mot de passe</CardTitle>
          <CardDescription>
            {success
              ? 'Votre mot de passe a été mis à jour. Redirection...'
              : 'Choisissez un nouveau mot de passe pour votre compte.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    onClick={() => setShowPassword((s) => !s)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Valider'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
