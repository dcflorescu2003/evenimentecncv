import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";

import AdminLayout from "./components/layouts/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import SessionsPage from "./pages/admin/SessionsPage";
import ClassesPage from "./pages/admin/ClassesPage";
import ImportPage from "./pages/admin/ImportPage";
import EventsPage from "./pages/admin/EventsPage";
import EventDetailPage from "./pages/admin/EventDetailPage";
import UsersPage from "./pages/admin/UsersPage";
import ReportsPage from "./pages/admin/ReportsPage";
import AuditPage from "./pages/admin/AuditPage";
import CredentialsPage from "./pages/admin/CredentialsPage";

import StudentLayout from "./components/layouts/StudentLayout";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentEventsPage from "./pages/student/StudentEventsPage";
import StudentEventDetailPage from "./pages/student/StudentEventDetailPage";
import StudentTicketsPage from "./pages/student/StudentTicketsPage";

import TeacherLayout from "./components/layouts/TeacherLayout";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherReportsPage from "./pages/teacher/TeacherReportsPage";

import ProfLayout from "./components/layouts/ProfLayout";
import ProfDashboard from "./pages/prof/ProfDashboard";
import ProfEventsPage from "./pages/prof/ProfEventsPage";
import ProfEventDetailPage from "./pages/prof/ProfEventDetailPage";
import ProfScanPage from "./pages/prof/ProfScanPage";
import ProfEventParticipantsPage from "./pages/prof/ProfEventParticipantsPage";

import CoordinatorLayout from "./components/layouts/CoordinatorLayout";
import CoordinatorDashboard from "./pages/coordinator/CoordinatorDashboard";
import ScanPage from "./pages/coordinator/ScanPage";
import EventParticipantsPage from "./pages/coordinator/EventParticipantsPage";

import PublicEventsPage from "./pages/public/PublicEventsPage";
import PublicEventBookingPage from "./pages/public/PublicEventBookingPage";
import PublicTicketViewPage from "./pages/public/PublicTicketViewPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Admin routes */}
            <Route
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/sessions" element={<SessionsPage />} />
              <Route path="/admin/classes" element={<ClassesPage />} />
              <Route path="/admin/import" element={<ImportPage />} />
              <Route path="/admin/events" element={<EventsPage />} />
              <Route path="/admin/events/:id" element={<EventDetailPage />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/reports" element={<ReportsPage />} />
              <Route path="/admin/audit" element={<AuditPage />} />
              <Route path="/admin/credentials" element={<CredentialsPage />} />
            </Route>

            {/* Student routes */}
            <Route
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/student" element={<StudentDashboard />} />
              <Route path="/student/events" element={<StudentEventsPage />} />
              <Route path="/student/events/:id" element={<StudentEventDetailPage />} />
              <Route path="/student/tickets" element={<StudentTicketsPage />} />
            </Route>

            {/* Teacher (profesor) routes */}
            <Route
              element={
                <ProtectedRoute allowedRoles={["teacher", "homeroom_teacher"]}>
                  <ProfLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/prof" element={<ProfDashboard />} />
              <Route path="/prof/events" element={<ProfEventsPage />} />
              <Route path="/prof/events/:id" element={<ProfEventDetailPage />} />
              <Route path="/prof/scan/:eventId" element={<ProfScanPage />} />
              <Route path="/prof/event/:eventId" element={<ProfEventParticipantsPage />} />
            </Route>

            {/* Homeroom teacher routes */}
            <Route
              element={
                <ProtectedRoute allowedRoles={["homeroom_teacher"]}>
                  <TeacherLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/teacher" element={<TeacherDashboard />} />
              <Route path="/teacher/reports" element={<TeacherReportsPage />} />
            </Route>

            {/* Coordinator routes */}
            <Route
              element={
                <ProtectedRoute allowedRoles={["coordinator_teacher"]}>
                  <CoordinatorLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/coordinator" element={<CoordinatorDashboard />} />
              <Route path="/coordinator/scan/:eventId" element={<ScanPage />} />
              <Route path="/coordinator/event/:eventId" element={<EventParticipantsPage />} />
            </Route>

            {/* Public routes (no auth) */}
            <Route path="/public/events" element={<PublicEventsPage />} />
            <Route path="/public/events/:id" element={<PublicEventBookingPage />} />
            <Route path="/public/tickets/:code" element={<PublicTicketViewPage />} />
            <Route path="/public/tickets" element={<PublicTicketViewPage />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
