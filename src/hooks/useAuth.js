import { useEffect } from 'react';
import { sb } from '../lib/supabase.js';
import { useApp } from '../context/AppContext.jsx';

export function useAuth() {
  const { setUser } = useApp();

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser]);
}
