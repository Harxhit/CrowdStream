import { Navigate, Outlet } from "react-router-dom";
import { useEffect , useState} from "react";
import { connectSocket, disconnectSocket } from "../socket";
import useAuth from "../hooks/useAuth";

export default function ProtectedRoute() {
  const { loading, authenticated } = useAuth();
  const [socketReady, setSocketReady] = useState(false);

  useEffect(() => {
    if (!authenticated) return;

    const socket = connectSocket();
    if(socket.connected){
      setSocketReady(true)
    }else{
      socket.on('connect', () => {
        setSocketReady(true)
      })
    }

    return () => {
      disconnectSocket();
    };
  }, [authenticated]);

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

  if (!socketReady) {
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
      Checking authentication...
    </div>
  }

  return <Outlet />;
}