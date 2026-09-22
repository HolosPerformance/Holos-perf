import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login, signUp, resetPassword } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || 'Email ou mot de passe incorrect');
    }
    setLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('Le prénom et le nom sont obligatoires.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    const result = await signUp(email, password, {
      full_name: `${firstName.trim()} ${lastName.trim()}`,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    });
    if (!result.success) {
      setError(result.error || 'Une erreur est survenue.');
    } else {
      setSuccess('Compte créé ! Vérifiez votre email pour confirmer votre inscription, puis connectez-vous.');
      setMode('login');
      setPassword('');
      setConfirmPassword('');
    }
    setLoading(false);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await resetPassword(email);
    if (!result.success) {
      setError(result.error || 'Une erreur est survenue.');
    } else {
      setSuccess('Un email de réinitialisation a été envoyé à ' + email);
    }
    setLoading(false);
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
          <CardTitle className="text-2xl">
            {mode === 'login' && 'Connexion'}
            {mode === 'signup' && 'Créer un compte'}
            {mode === 'reset' && 'Mot de passe oublié'}
          </CardTitle>
          <CardDescription>
            {mode === 'login' && 'Connectez-vous à votre espace Holos Performance'}
            {mode === 'signup' && 'Créez votre compte pour rejoindre la plateforme'}
            {mode === 'reset' && 'Entrez votre email pour recevoir un lien de réinitialisation'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Message d'erreur */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Message de succès */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              {success}
            </div>
          )}

          {/* Formulaire Login */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-slate-800 hover:bg-slate-700">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Connexion...</> : 'Se connecter'}
              </Button>
              <div className="flex justify-between text-sm text-slate-500 pt-1">
                <button type="button" onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}
                  className="hover:text-slate-800 underline">
                  Mot de passe oublié ?
                </button>
                <button type="button" onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
                  className="hover:text-slate-800 underline">
                  Créer un compte
                </button>
              </div>
            </form>
          )}

          {/* Formulaire Inscription */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom *</Label>
                  <Input id="firstName" placeholder="Jean" value={firstName}
                    onChange={e => setFirstName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom *</Label>
                  <Input id="lastName" placeholder="Dupont" value={lastName}
                    onChange={e => setLastName(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-signup">Email *</Label>
                <Input id="email-signup" type="email" placeholder="votre@email.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-signup">Mot de passe * (min. 6 caractères)</Label>
                <div className="relative">
                  <Input id="password-signup" type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••" value={password}
                    onChange={e => setPassword(e.target.value)} required className="pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password-signup">Confirmer le mot de passe *</Label>
                <Input id="confirm-password-signup" type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} required />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-slate-800 hover:bg-slate-700">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Création...</> : 'Créer mon compte'}
              </Button>
              <div className="text-center text-sm text-slate-500">
                <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                  className="hover:text-slate-800 underline">
                  Déjà un compte ? Se connecter
                </button>
              </div>
            </form>
          )}

          {/* Formulaire Reset */}
          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-reset">Email</Label>
                <Input id="email-reset" type="email" placeholder="votre@email.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-slate-800 hover:bg-slate-700">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi...</> : 'Envoyer le lien'}
              </Button>
              <div className="text-center text-sm text-slate-500">
                <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                  className="hover:text-slate-800 underline">
                  Retour à la connexion
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
