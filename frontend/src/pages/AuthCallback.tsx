import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
    const navigate = useNavigate();

    useEffect(() => {
        const handleCallback = async () => {
            console.log('[AuthCallback] 🔄 CALLBACK PAGE LOADED');
            console.log('[AuthCallback] ↳ URL:', window.location.href);
            console.log('[AuthCallback] ↳ Hash:', window.location.hash.substring(0, 50) + '...');

            try {
                console.log('[AuthCallback] ↳ Calling supabase.auth.getSession()...');
                const { data, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('[AuthCallback] ❌ getSession error:', error);
                    console.log('[AuthCallback] 🔄 REDIRECT: /login');
                    // Clear OAuth state on error
                    localStorage.removeItem('oauth_redirect_destination');
                    localStorage.removeItem('oauth_login_type');
                    navigate("/login", { replace: true });
                    return;
                }

                console.log('[AuthCallback] ✅ getSession success');
                console.log('[AuthCallback] ↳ Session exists:', !!data.session);
                console.log('[AuthCallback] ↳ User:', data.session?.user?.email, '| ID:', data.session?.user?.id);

                if (data.session) {
                    console.log('[AuthCallback] 👤 User authenticated, checking stored destination...');

                    // Check for stored OAuth destination
                    const storedDestination = localStorage.getItem('oauth_redirect_destination');
                    const storedLoginType = localStorage.getItem('oauth_login_type');

                    console.log('[AuthCallback] ↳ Stored destination:', storedDestination);
                    console.log('[AuthCallback] ↳ Stored login type:', storedLoginType);

                    // Add delay to ensure session is fully established
                    console.log('[AuthCallback] ↳ Waiting for session to stabilize...');
                    await new Promise(resolve => setTimeout(resolve, 300));

                    // If we have a stored destination, use it
                    if (storedDestination) {
                        console.log('[AuthCallback] ✅ Using stored destination:', storedDestination);
                        // Clear OAuth state
                        localStorage.removeItem('oauth_redirect_destination');
                        localStorage.removeItem('oauth_login_type');
                        console.log('[AuthCallback] 🔄 REDIRECT:', storedDestination);
                        navigate(storedDestination, { replace: true });
                        return;
                    }

                    // Fallback to role-based redirect if no stored destination
                    console.log('[AuthCallback] ⚠️ No stored destination, falling back to role check...');

                    try {
                        // Simple role check for the redirect
                        const { data: roleData, error: roleError } = await supabase
                            .from('user_roles')
                            .select('role')
                            .eq('user_id', data.session.user.id)
                            .maybeSingle();

                        if (roleError) {
                            console.error('[AuthCallback] ⚠️ Role fetch error:', roleError);
                            console.log('[AuthCallback] 🔄 REDIRECT: /dashboard (fallback)');
                            navigate("/dashboard", { replace: true });
                            return;
                        }

                        const userRole = roleData?.role || 'patient';
                        console.log('[AuthCallback] ✅ Role fetched:', userRole);

                        if (userRole === 'doctor') {
                            console.log('[AuthCallback] 🏥 User is DOCTOR');
                            console.log('[AuthCallback] 🔄 REDIRECT: /doctor/dashboard');
                            navigate("/doctor/dashboard", { replace: true });
                        } else {
                            console.log('[AuthCallback] 🏥 User is PATIENT');
                            console.log('[AuthCallback] 🔄 REDIRECT: /dashboard');
                            navigate("/dashboard", { replace: true });
                        }
                    } catch (roleErr) {
                        console.error('[AuthCallback] ❌ Role check exception:', roleErr);
                        console.log('[AuthCallback] 🔄 REDIRECT: /dashboard (error fallback)');
                        navigate("/dashboard", { replace: true });
                    }
                } else {
                    console.log('[AuthCallback] ❌ No session found');
                    console.log('[AuthCallback] 🔄 REDIRECT: /login');
                    // Clear OAuth state on no session
                    localStorage.removeItem('oauth_redirect_destination');
                    localStorage.removeItem('oauth_login_type');
                    navigate("/login", { replace: true });
                }
            } catch (err) {
                console.error('[AuthCallback] ❌ Exception:', err);
                console.log('[AuthCallback] 🔄 REDIRECT: /login (exception)');
                // Clear OAuth state on exception
                localStorage.removeItem('oauth_redirect_destination');
                localStorage.removeItem('oauth_login_type');
                navigate("/login", { replace: true });
            }
        };

        handleCallback();
    }, [navigate]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mb-4"></div>
            <p className="text-gray-600 font-medium">Completing sign-in…</p>
            <p className="text-gray-500 text-sm mt-2">Processing OAuth callback...</p>
        </div>
    );
}
