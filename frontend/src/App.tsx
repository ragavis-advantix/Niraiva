import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ReportProvider } from "@/contexts/ReportContext";
import { DataProvider } from '@/contexts/DataContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import TimelineAssistant from '@/components/TimelineAssistant';
import LandingPage from "./pages/LandingPage";
import Dashboard from "./apps/patient/pages/Dashboard";
import Timeline from "./apps/patient/pages/Timeline";
import Diagnostic from "./apps/patient/pages/Diagnostic";
import Profile from "./apps/patient/pages/Profile";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import AuthCallback from "./pages/AuthCallback";
import HealthReportUpload from "./apps/patient/pages/HealthReportUpload";
import NotFound from "./pages/NotFound";
import DoctorLogin from "./pages/doctor/DoctorLogin";
import DoctorDashboard from "./apps/doctor/pages/DoctorDashboard";
import DoctorPatientProfile from "./apps/doctor/pages/DoctorPatientProfile";
import DoctorProfile from "./apps/doctor/pages/DoctorProfile";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const queryClient = new QueryClient();

// Protected Route component for patients
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  console.log('[ProtectedRoute] user:', !!user, '| loading:', loading, '| path:', location.pathname);

  if (loading) {
    console.log('[ProtectedRoute] ↳ Loading spinner shown');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    console.log('[ProtectedRoute] ↳ No user, redirecting to /login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log('[ProtectedRoute] ✅ User authenticated, showing children');
  return <>{children}</>;
};

// Protected Route component for doctors with role verification
const DoctorProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  console.log('[DoctorProtectedRoute] Checking access:', {
    user: !!user,
    role: user?.role,
    loading: authLoading,
    path: location.pathname
  });

  if (authLoading) {
    console.log('[DoctorProtectedRoute] Auth loading, showing spinner');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!user) {
    console.log('[DoctorProtectedRoute] No user, redirecting to login');
    return <Navigate to="/doctor/login" state={{ from: location }} replace />;
  }

  // If user exists but role is not yet enriched, show loading
  if (!user.role) {
    console.log('[DoctorProtectedRoute] User role not yet enriched, showing spinner');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  // Use the role from enriched user data (set by AuthContext)
  if (user.role !== 'doctor') {
    console.log('[DoctorProtectedRoute] User is not a doctor, role:', user.role, '- redirecting to login');
    return <Navigate to="/doctor/login" replace />;
  }

  console.log('[DoctorProtectedRoute] ✅ Access granted');
  return <>{children}</>;
};

const AppRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Backward compatibility redirect */}
        <Route
          path="/dashboard"
          element={<Navigate to="/patient/dashboard" replace />}
        />

        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Doctor routes */}
        <Route path="/doctor/login" element={<DoctorLogin />} />
        <Route
          path="/doctor/dashboard"
          element={
            <DoctorProtectedRoute>
              <DoctorDashboard />
            </DoctorProtectedRoute>
          }
        />
        <Route
          path="/doctor/profile"
          element={
            <DoctorProtectedRoute>
              <DoctorProfile />
            </DoctorProtectedRoute>
          }
        />
        <Route
          path="/doctor/patient/:patientUserId"
          element={
            <DoctorProtectedRoute>
              <DoctorPatientProfile />
            </DoctorProtectedRoute>
          }
        />

        {/* Patient routes (Standardized) */}
        <Route
          path="/patient/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/timeline"
          element={
            <ProtectedRoute>
              <Timeline />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/diagnostic"
          element={
            <ProtectedRoute>
              <Diagnostic />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/upload-reports"
          element={
            <ProtectedRoute>
              <HealthReportUpload />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          {/* Auth callback MUST be outside of all providers to avoid blocking */}
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Everything else is wrapped in providers */}
          <Route
            path="*"
            element={
              <AuthProvider>
                <DataProvider>
                  <ReportProvider>
                    <>
                      <Toaster />
                      <Sonner />
                      <AppRoutes />
                      <TimelineAssistant />
                    </>
                  </ReportProvider>
                </DataProvider>
              </AuthProvider>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
