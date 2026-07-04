import { Navigate, Outlet } from "react-router-dom";

import useAuth from "../hooks/useAuth";

export default function ProtectedRoute() {
  const { loading, authenticated } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
        Checking authentication...
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/signin" replace />;
  }

  return <Outlet />;
}