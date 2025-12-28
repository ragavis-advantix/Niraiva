import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const signupSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  phone: z.string().min(10, { message: "Please enter a valid phone number" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

const Signup = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const { signUp } = useAuth();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      phone: '',
      password: '',
      confirmPassword: ''
    },
  });

  const onSubmit = async (data: SignupFormValues) => {
    try {
      setIsLoading(true);
      const result = await signUp(data.email, data.password, { phone: data.phone });
      console.log('[Signup] signUp result=', result);
      const returnedEmail = result?.user?.email ?? data.email;
      if (result) {
        setUserEmail(returnedEmail);
        setShowVerification(true);
        toast.success('Signup successful! Please check your email for verification.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sign up');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
      });
      if (error) throw error;
      toast.success('Verification email resent!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resend email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sign up with Google');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-gradient-to-b from-white to-blue-50 dark:from-gray-900 dark:to-gray-800 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="sm:mx-auto sm:w-full sm:max-w-md"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          <img
            src="/lovable-uploads/niraiva-logo.png"
            alt="Niraiva"
            className="h-16 w-auto"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-white dark:bg-gray-800 py-8 px-4 shadow-xl rounded-xl sm:px-10 glass-panel"
        >
          {showVerification ? (
            // Verification Screen
            <div className="text-center space-y-6">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30">
                <svg
                  className="h-8 w-8 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Verify your email
                </h2>
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  We've sent a verification link to
                </p>
                <p className="mt-1 text-sm font-medium text-niraiva-600 dark:text-niraiva-400">
                  {userEmail}
                </p>
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  Click the link in the email to activate your account.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResendEmail}
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Resend verification email"}
                </Button>

                <Button
                  type="button"
                  variant="default"
                  className="w-full bg-niraiva-600 hover:bg-niraiva-700"
                  onClick={() => navigate('/login')}
                >
                  Go to login
                </Button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Didn't receive the email? Check your spam folder or click resend.
              </p>
            </div>
          ) : (
            // Signup Form
            <>
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create an account</h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Join Niraiva to start tracking your health journey
                </p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            disabled={isLoading}
                            className="bg-gray-50 dark:bg-gray-700"
                            placeholder="Enter your email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="tel"
                            disabled={isLoading}
                            className="bg-gray-50 dark:bg-gray-700"
                            placeholder="Enter your phone number"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            disabled={isLoading}
                            className="bg-gray-50 dark:bg-gray-700"
                            placeholder="Create a password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            disabled={isLoading}
                            className="bg-gray-50 dark:bg-gray-700"
                            placeholder="Confirm your password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full bg-niraiva-600 hover:bg-niraiva-700"
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating account..." : "Sign up"}
                  </Button>
                </form>
              </Form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800">
                      Or continue with
                    </span>
                  </div>
                </div>

                <div className="mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignup}
                    disabled={isLoading}
                  >
                    <img
                      src="https://www.svgrepo.com/show/475656/google-color.svg"
                      alt="Google"
                      className="h-5 w-5 mr-2"
                    />
                    Sign up with Google
                  </Button>
                </div>
              </div>

              <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-medium text-niraiva-600 hover:text-niraiva-500"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Signup;