import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '@/utils';

export default function Home() {
  const { user, authState } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authState === 'loading' || authState !== 'active') return;

    if (user?.user_status === 'admin') {
      navigate(createPageUrl('AdminHome'), { replace: true });
    } else if (user?.user_status === 'coach' || user?.user_status === 'coach_pro') {
      navigate(createPageUrl('CoachHome'), { replace: true });
    } else {
      navigate(createPageUrl('AthleteHome'), { replace: true });
    }
  }, [authState, user?.user_status, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <p className="text-slate-500">Redirection...</p>
    </div>
  );
}
