import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AppLayout from "./layouts/AppLayout";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import InboundListPage from "./pages/InboundListPage";
import InboundFormPage from "./pages/InboundFormPage";
import OutboundListPage from "./pages/OutboundListPage";
import OutboundFormPage from "./pages/OutboundFormPage";
import GatePassListPage from "./pages/GatePassListPage";
import GatePassFormPage from "./pages/GatePassFormPage";
import GatePassPage from "./pages/GatePassPage";
import ReportsPage from "./pages/ReportsPage";
import SchedulePage from "./pages/SchedulePage";
import MastersPage from "./pages/MastersPage";
import UsersPage from "./pages/UsersPage";
import RolesPage from "./pages/RolesPage";
import SettingsPage from "./pages/SettingsPage";
import LoadingTruck from "./components/LoadingTruck";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingTruck label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/inbound" element={<InboundListPage />} />
        <Route path="/inbound/new" element={<InboundFormPage />} />
        <Route path="/inbound/:id" element={<InboundFormPage />} />
        <Route path="/outbound" element={<OutboundListPage />} />
        <Route path="/outbound/new" element={<OutboundFormPage />} />
        <Route path="/outbound/:id" element={<OutboundFormPage />} />
        <Route path="/gate-pass" element={<GatePassListPage />} />
        <Route path="/gate-pass/new" element={<GatePassFormPage />} />
        <Route path="/gate-pass/:id" element={<GatePassPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/masters" element={<MastersPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
