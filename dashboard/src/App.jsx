import AdminDashboardPage from "@/components/admin-dashboard/page";
import { Navigate, Route, Routes } from "react-router-dom";

function App() {
  return (
    <Routes>
      <Route path="/" element={<AdminDashboardPage />} />
      <Route path="/inbox" element={<AdminDashboardPage />} />
      <Route path="/bookings" element={<AdminDashboardPage />} />
      <Route path="/routing" element={<AdminDashboardPage />} />
      <Route path="/escalations" element={<AdminDashboardPage />} />
      <Route path="/waha" element={<AdminDashboardPage />} />
      <Route path="/workflow-rules" element={<AdminDashboardPage />} />
      <Route path="/settings" element={<AdminDashboardPage />} />
      <Route path="/help" element={<AdminDashboardPage />} />
      <Route path="/search" element={<AdminDashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
