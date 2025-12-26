import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function DoctorCallback() {
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'verifying' | 'error'>('loading');

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Get the session after OAuth redirect
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError || !session?.user) {
                    console.error('Session error:', sessionError);
                    setStatus('error');
                    setTimeout(() => navigate('/doctor/login'), 2000);
                    return;
                }

                setStatus('verifying');

                // Verify user role from user_roles table
                const { data: roleRow, error: roleError } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', session.user.id)
                    .maybeSingle();

                console.log('OAuth role check:', { roleRow, roleError, userId: session.user.id });

                if (!roleRow || roleRow.role !== 'doctor') {
                    // Not a doctor - sign out and redirect
                    await supabase.auth.signOut();
                    setStatus('error');
                    setTimeout(() => navigate('/doctor/login'), 2000);
                    return;
                }

                // Success - redirect to doctor dashboard
                navigate('/doctor/dashboard');
            } catch (error) {
                console.error('Callback error:', error);
                setStatus('error');
                setTimeout(() => navigate('/doctor/login'), 2000);
            }
        };

        handleCallback();
    }, [navigate]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-cyan-50 to-white">
            <div className="text-center">
                <img
                    src="/niraiva-logo.png"
                    alt="Niraiva"
                    className="h-16 mx-auto mb-6"
                />

                {status === 'loading' && (
                    <>
                        <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mx-auto mb-4" />
                        <p className="text-gray-600">Completing sign in...</p>
                    </>
                )}

                {status === 'verifying' && (
                    <>
                        <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mx-auto mb-4" />
                        <p className="text-gray-600">Verifying doctor access...</p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                            <span className="text-red-600 text-xl">✕</span>
                        </div>
                        <p className="text-gray-600">Access denied. Redirecting...</p>
                    </>
                )}
            </div>
        </div>
    );
}
