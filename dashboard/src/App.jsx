import AdminDashboardPage from "@/components/admin-dashboard/page";
import LoginPage from "@/components/auth/login-page";
import ForbiddenPage from "@/components/auth/forbidden-page";
import { clearAuth, getRole, getToken } from "@/lib/auth";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

function RequireAuth({ children }) {
  const location = useLocation();
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

function RequireRole({ roles, children }) {
  const role = getRole();
  if (!roles.includes(role)) {
    return <Navigate to="/403" replace />;
  }
  return children;
}

function App() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function verify() {
      const token = getToken();
      if (!token) {
        setChecked(true);
        return;
      }
      try {
        const response = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) clearAuth();
      } catch {
        clearAuth();
      } finally {
        setChecked(true);
      }
    }
    verify();
  }, []);

  if (!checked) return null;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="/" element={<RequireAuth><AdminDashboardPage /></RequireAuth>} />
      <Route path="/inbox" element={<RequireAuth><AdminDashboardPage /></RequireAuth>} />
      <Route path="/bookings" element={<RequireAuth><AdminDashboardPage /></RequireAuth>} />
      <Route path="/routing" element={<RequireAuth><AdminDashboardPage /></RequireAuth>} />
      <Route path="/escalations" element={<RequireAuth><AdminDashboardPage /></RequireAuth>} />
      <Route path="/waha" element={<RequireAuth><AdminDashboardPage /></RequireAuth>} />
      <Route
        path="/workflow-rules"
        element={
          <RequireAuth>
            <RequireRole roles={["admin"]}>
              <AdminDashboardPage />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route path="/settings" element={<RequireAuth><AdminDashboardPage /></RequireAuth>} />
      <Route path="/help" element={<RequireAuth><AdminDashboardPage /></RequireAuth>} />
      <Route path="/search" element={<RequireAuth><AdminDashboardPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
