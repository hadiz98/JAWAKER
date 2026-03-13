import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/store/authStore";

export function useAuth() {
  const { session, user, setSession } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s, s?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s: Session | null) => {
      setSession(s, s?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  return { session, user, loading };
}
