import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";

type Profile = Tables<"profiles">;

export function useGuardianMinors() {
  const { user } = useAuth();
  const [minors, setMinors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setMinors([]);
      setLoading(false);
      return;
    }

    const fetchMinors = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from("profiles")
          .select("*")
          .eq("guardian_user_id", user.id);

        if (fetchError) {
          setError(fetchError.message);
          setMinors([]);
        } else {
          setMinors(data || []);
        }
      } catch (err) {
        setError("Erro ao buscar menores vinculados");
        setMinors([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMinors();
  }, [user]);

  return { minors, loading, error, hasMinors: minors.length > 0 };
}
