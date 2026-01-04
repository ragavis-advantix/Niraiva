import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  console.log('[Login] 🔐 Component RENDERED');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    console.log('[Login] 🔑 handleSubmit START');

    try {
      console.log('[Login] ↳ Calling signIn()...');
      await signIn(email, password);
      console.log('[Login] ✅ signIn() completed');

      // Get the current session to access user ID
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error('No session after login');
      }

      // Fetch user role from user_roles table
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const userRole = roleRow?.role || 'patient';
      console.log('[Login] ✅ User role:', userRole);

      // Navigate based on role (Explicitly standardized)
      if (userRole === 'doctor') {
        console.log('[Login] 🔄 Navigating to: /doctor/dashboard');
        navigate('/doctor/dashboard', { replace: true });
        return;
      }

      // DEFAULT: patient
      console.log('[Login] 🔄 Navigating to: /patient/dashboard (default)');
      navigate('/patient/dashboard', { replace: true });
    } catch (error: any) {
      console.error('[Login] ❌ Error:', error);
      setLoading(false);
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign in',
        variant: 'destructive',
      });
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      console.log('[Login] 🔑 Google Sign-In: Starting OAuth flow');
      await signInWithGoogle();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign in with Google',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-12" style={{
      background: 'linear-gradient(180deg, #F5FCFE 0%, #FFFFFF 40%)'
    }}>
      {/* Logo + Title */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="flex flex-col items-center mb-8"
      >
        <img
          src="/niraiva-logo.png"
          alt="Niraiva Logo"
          className="w-20 h-20 object-contain"
        />

        <h1 className="text-3xl font-extrabold text-gray-800 mt-2 tracking-wide">
          NIRAIVA
        </h1>

        <p className="text-gray-500 text-sm mt-1">
          Your Personal Health Companion
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[380px] px-4"
      >

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="bg-white rounded-[18px] shadow-[0px_4px_30px_rgba(0,0,0,0.05)] border border-[#E8EDF2] p-9"
        >
          {/* Title and Subtitle */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome back
            </h1>
            <p className="text-sm text-[#6B7785]">
              Continue your health journey with Niraiva
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email address
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="h-11 rounded-[10px] border-gray-200 placeholder:text-[#B5C4D1] transition-all duration-200 focus:border-[#00DDE0] focus:ring-2 focus:ring-[#00DDE0]/20"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="h-11 rounded-[10px] border-gray-200 placeholder:text-[#B5C4D1] pr-10 transition-all duration-200 focus:border-[#00DDE0] focus:ring-2 focus:ring-[#00DDE0]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-[12px] font-semibold text-white transition-all duration-200 hover:shadow-[0px_4px_20px_rgba(0,214,224,0.4)]"
              style={{
                background: 'linear-gradient(90deg, #00DDE0, #00C4F0)'
              }}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          {/* Google Sign In Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            className="w-full h-11 rounded-[12px] bg-white border border-[#E3E9EF] hover:bg-[#F7F9FA] transition-all duration-200 font-medium"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </Button>

          {/* Sign Up Link */}
          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <a href="/signup" className="font-medium text-[#00DDE0] hover:text-[#00C4F0] transition-colors">
              Sign up
            </a>
          </p>
        </motion.div>

        {/* Footer Links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-8 text-center text-xs text-gray-400 space-x-4"
        >
          <a href="#" className="hover:text-gray-600 transition-colors">
            Privacy Policy
          </a>
          <span>•</span>
          <a href="#" className="hover:text-gray-600 transition-colors">
            Terms of Use
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
}
