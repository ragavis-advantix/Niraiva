import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ReportProvider } from "@/contexts/ReportContext";
import { DataProvider } from '@/contexts/DataContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import Timeline from "./pages/Timeline";
import Diagnostic from "./pages/Diagnostic";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import HealthReportUpload from "./pages/HealthReportUpload";
import NotFound from "./pages/NotFound";
import DoctorLogin from "./pages/doctor/DoctorLogin";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import DoctorPatientProfile from "./pages/doctor/DoctorPatientProfile";
import DoctorProfile from "./pages/doctor/DoctorProfile";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const queryClient = new QueryClient();

// Protected Route component for patients
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Protected Route component for doctors with role verification
const DoctorProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [roleLoading, setRoleLoading] = useState(true);
  const [isDoctor, setIsDoctor] = useState(false);

  useEffect(() => {
    const checkDoctorRole = async () => {
      if (!user) {
        setRoleLoading(false);
        return;
      }

      try {
        const { data: roleRow, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('Protected route role check:', { roleRow, error, userId: user.id });

        if (roleRow && roleRow.role === 'doctor') {
          setIsDoctor(true);
        } else {
          setIsDoctor(false);
        }
      } catch (error) {
        console.error('Role check error:', error);
        setIsDoctor(false);
      } finally {
        setRoleLoading(false);
      }
    };

    checkDoctorRole();
  }, [user]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/doctor/login" state={{ from: location }} replace />;
  }

  if (!isDoctor) {
    return <Navigate to="/doctor/login" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <DataProvider>
          <ReportProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AnimatePresence mode="wait">
                <Routes>
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

                  {/* Protected routes */}
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/timeline"
                    element={
                      <ProtectedRoute>
                        <Timeline />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/diagnostic"
                    element={
                      <ProtectedRoute>
                        <Diagnostic />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/upload-reports"
                    element={
                      <ProtectedRoute>
                        <HealthReportUpload />
                      </ProtectedRoute>
                    }
                  />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AnimatePresence>
            </BrowserRouter>
          </ReportProvider>
        </DataProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
