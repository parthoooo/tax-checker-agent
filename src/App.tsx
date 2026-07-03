import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import SignupApprovals from "./pages/admin/SignupApprovals";
import NotFound from "./pages/NotFound";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import AdminDashboard from "@/components/admin/AdminDashboard";
import ClientDashboard from "@/components/client/ClientDashboard";
import Clients from "./pages/admin/Clients";
import ClientDetail from "./pages/admin/ClientDetail";
import Flags from "./pages/admin/Flags";
import Activity from "./pages/admin/Activity";
import AdminSettings from "./pages/admin/AdminSettings";
import EmailQueue from "./pages/admin/EmailQueue";
import RemindersPage from "./pages/RemindersPage";
import VaultPage from "./pages/VaultPage";
import SampleDocsPage from "./pages/admin/SampleDocsPage";
import Profile from "./pages/Profile";
import MagicLinkPortal from "./pages/MagicLinkPortal";

const App = () => (
  <>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/upload/:token" element={<MagicLinkPortal />} />

            {/* Authenticated layout */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              {/* Admin + Preparer */}
              <Route path="/dashboard" element={<ProtectedRoute roles={['admin', 'preparer']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute roles={['admin']}><Clients /></ProtectedRoute>} />
              <Route path="/clients/signups" element={<ProtectedRoute roles={['admin']}><SignupApprovals /></ProtectedRoute>} />
              <Route path="/clients/:id" element={<ProtectedRoute roles={['admin', 'preparer']}><ClientDetail /></ProtectedRoute>} />
              <Route path="/flags" element={<ProtectedRoute roles={['admin', 'preparer']}><Flags /></ProtectedRoute>} />
              <Route path="/activity" element={<ProtectedRoute roles={['admin', 'preparer']}><Activity /></ProtectedRoute>} />
              <Route path="/email-queue" element={<ProtectedRoute roles={['admin', 'preparer']}><EmailQueue /></ProtectedRoute>} />
              <Route path="/reminders" element={<ProtectedRoute roles={['admin', 'preparer']}><RemindersPage /></ProtectedRoute>} />
              <Route path="/vault" element={<ProtectedRoute roles={['admin', 'preparer']}><VaultPage /></ProtectedRoute>} />
              <Route path="/staff/sample-docs" element={<ProtectedRoute roles={['admin', 'preparer']}><SampleDocsPage /></ProtectedRoute>} />

              {/* Admin only */}
              <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminSettings /></ProtectedRoute>} />

              {/* Client only */}
              <Route path="/portal" element={<ProtectedRoute roles={['client']}><ClientDashboard /></ProtectedRoute>} />

              {/* Any authenticated user */}
              <Route path="/profile" element={<Profile />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
    </BrowserRouter>
  </>
);

export default App;
