import { BrowserRouter, Routes, Route } from "react-router-dom";

import HomePage from "../pages/Homepage";
import SignInPage from "../pages/SignIn";
import SignUpPage from "../pages/SignUp";
import DashboardPage from "../pages/DashBoard";
import BroadcasterPage from "../pages/Broadcaster";
import ViewerPage from "../pages/ViewerPage";
import ProtectedRoute from "./ProtectedRoute";

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        <Route path="/broadcaster" element={<BroadcasterPage />} />
        <Route path="/viewer" element={<ViewerPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route element={<ProtectedRoute />}>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}