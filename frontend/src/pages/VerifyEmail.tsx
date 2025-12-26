import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function VerifyEmail() {
  const { user, isEmailVerified, resendVerificationEmail } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [verifying, setVerifying] = useState(false);
  const paramEmail = searchParams.get('email') ?? '';
  const [emailInput, setEmailInput] = useState<string>(user?.email ?? paramEmail);

  // Keep emailInput in sync if user loads after render or if query param is present
  useEffect(() => {
    if (user?.email) {
      setEmailInput(user.email);
    } else if (paramEmail) {
      setEmailInput(paramEmail);
    }
  }, [user, paramEmail]);

  // Handle email verification callback from Supabase
  useEffect(() => {
    const url = window.location.href;

    if (url.includes('type=signup') || url.includes('type=magiclink')) {
      setVerifying(true);
      (async () => {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(url);

          if (error) {
            console.error('[VerifyEmail] Verification error:', error);
            toast.error('Verification failed. Please try again.');
            setVerifying(false);
          } else {
            console.log('[VerifyEmail] Verification success:', data);
            toast.success('Email verified successfully!');
            // Small delay to ensure session is fully established
            setTimeout(() => {
              navigate('/dashboard');
            }, 500);
          }
        } catch (err) {
          console.error('[VerifyEmail] Verification exception:', err);
          toast.error('Verification failed. Please try again.');
          setVerifying(false);
        }
      })();
    }
  }, [navigate]);

  // Handle email confirmation from URL (fallback)
  useEffect(() => {
    if (isEmailVerified && !verifying) {
      toast.success('Email verified successfully!');
      navigate('/dashboard');
    }
  }, [isEmailVerified, navigate, verifying]);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendDisabled && countdown > 0) {
      const timer = setInterval(() => setCountdown(c => c - 1), 1000);
      return () => clearInterval(timer);
    }
    if (countdown === 0) {
      setResendDisabled(false);
      setCountdown(60);
    }
  }, [resendDisabled, countdown]);

  const handleResendEmail = async () => {
    try {
      console.log('[VerifyEmail] handleResendEmail called, user.email=', user?.email, 'emailInput=', emailInput);
      const resp = await resendVerificationEmail(user?.email ?? emailInput);
      console.log('[VerifyEmail] resendVerificationEmail response=', resp);
      setResendDisabled(true);
      toast.success('Verification email sent!');
    } catch (error) {
      console.error('[VerifyEmail] resendVerificationEmail failed=', error);
      toast.error('Failed to send verification email. Please try again.');
    }
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen flex items-center justify-center p-4"
    >
      <Card className="w-full max-w-md p-8">
        <div className="text-center space-y-6">
          {verifying ? (
            <>
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
              <h1 className="text-2xl font-bold">Verifying Your Email...</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Please wait while we verify your email address.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Verify Your Email</h1>
              <p className="text-gray-600 dark:text-gray-400">
                We've sent a verification email to <strong>{user?.email ?? emailInput}</strong>
              </p>
              {!user && (
                <div className="mt-2">
                  <Input
                    value={emailInput}
                    onChange={(e) => setEmailInput((e.target as HTMLInputElement).value)}
                    placeholder="Enter your email to resend"
                  />
                </div>
              )}
              <p className="text-gray-600 dark:text-gray-400">
                Please check your email and click the verification link to continue.
              </p>
              <div className="space-y-4">
                <Button
                  onClick={handleResendEmail}
                  disabled={resendDisabled}
                  variant="outline"
                  className="w-full"
                >
                  {resendDisabled
                    ? `Resend available in ${countdown}s`
                    : 'Resend verification email'}
                </Button>
                <Button
                  onClick={() => navigate('/login')}
                  variant="ghost"
                  className="w-full"
                >
                  Back to Login
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </motion.div>
  );
}