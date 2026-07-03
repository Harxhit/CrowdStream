import { useEffect, useState } from "react";
import { getCurrentUser } from "../api/auth";

export default function useAuth() {
  const [loading, setLoading] = useState(true);

  const [authenticated, setAuthenticated] =
    useState(false);

  useEffect(() => {
    async function verify() {
      try {
        await getCurrentUser();

        setAuthenticated(true);
      } catch {
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    }

    verify();
  }, []);

  return {
    loading,
    authenticated,
  };
}