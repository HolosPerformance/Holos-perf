import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabaseRaw as supabase } from '@/api/supabaseClient';

const AuthContext = createContext(null);

// États : 'loading' | 'unauthenticated' | 'incomplete' | 'pending' | 'active'
const deriveState = (profile) => {
  if (!profile) return 'unauthenticated';
  if (!profile.first_name || !profile.first_name.trim()) return 'incomplete';
  if (!profile.is_approved) return 'pending';
  return 'active';
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]           = useState(null);
  const [authState, setAuthState] = useState('loading');
  const [authError, setAuthError] = useState(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    // Supabase en flux PKCE redirige avec ?code=...&type=recovery (et non
    // #access_token=...&type=recovery), auquel cas l'événement 'PASSWORD_RECOVERY'
    // n'est pas toujours émis : on détecte aussi directement l'URL au chargement.
    if (typeof window === 'undefined') return false;
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return search.get('type') === 'recovery' || hash.get('type') === 'recovery';
  });

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setUser(null);
      setAuthState('unauthenticated');
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        // Profil inexistant → le créer
        if (error.code === 'PGRST116') {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              email: authUser.email,
              user_status: 'athlete',
              is_approved: false,
            })
            .select()
            .single();

          if (createError) throw createError;

          const fullUser = { id: authUser.id, email: authUser.email, ...newProfile };
          setUser(fullUser);
          setAuthState(deriveState(fullUser));
          return;
        }
        throw error;
      }

      // Auto-approbation admins
      if (profile.user_status === 'admin' && !profile.is_approved) {
        await supabase
          .from('profiles')
          .update({ is_approved: true })
          .eq('id', authUser.id);
        profile.is_approved = true;
      }

      const fullUser = { id: authUser.id, email: authUser.email, ...profile };
      setUser(fullUser);
      setAuthState(deriveState(fullUser));
      setAuthError(null);

    } catch (err) {
      console.error('Erreur loadProfile:', err.message);
      setAuthError(err.message);
      setAuthState('unauthenticated');
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      if (error) {
        console.error('Erreur getSession:', error.message);
        setAuthError(error.message);
        setAuthState('unauthenticated');
        return;
      }
      loadProfile(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
          return;
        }
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          loadProfile(session?.user);
        }
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setAuthState('unauthenticated');
          setIsPasswordRecovery(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const login = useCallback(async (email, password) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      const msg = error.message.includes('Invalid login')
        ? 'Email ou mot de passe incorrect'
        : error.message;
      setAuthError(msg);
      return { success: false, error: msg };
    }
    return { success: true };
  }, []);

  const signUp = useCallback(async (email, password, metadata = {}) => {
    setAuthError(null);
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: metadata },
    });
    if (error) {
      setAuthError(error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  }, []);

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/reset-password` }
    );
    return error
      ? { success: false, error: error.message }
      : { success: true };
  }, []);

  const updatePassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    setIsPasswordRecovery(false);
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAuthState('unauthenticated');
  }, []);

  const updateProfile = useCallback(async (updates) => {
    if (!user) return { success: false };
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    const updated = { ...user, ...data };
    setUser(updated);
    setAuthState(deriveState(updated));
    return { success: true };
  }, [user]);

  const refreshUser = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) await loadProfile(authUser);
  }, [loadProfile]);

  return (
    <AuthContext.Provider value={{
      user,
      authState,
      authError,
      isPasswordRecovery,
      isAuthenticated:         authState !== 'unauthenticated' && authState !== 'loading',
      isLoadingAuth:           authState === 'loading',
      isLoadingPublicSettings: false,
      isPending:               authState === 'pending',
      isIncomplete:            authState === 'incomplete',
      isActive:                authState === 'active',
      isAdmin:                 user?.user_status === 'admin',
      isCoach:                 user?.user_status === 'coach' || user?.user_status === 'coach_pro',
      isAthlete:               user?.user_status === 'athlete',
      login,
      signUp,
      logout,
      resetPassword,
      updatePassword,
      updateProfile,
      refreshUser,
      navigateToLogin: logout,
      checkAppState:   refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
};
