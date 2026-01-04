import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
    const navigate = useNavigate();

    useEffect(() => {
        const finishLogin = async () => {
            console.log('[AuthCallback] 🔄 CALLBACK PAGE LOADED');
            console.log('[AuthCallback] ↳ URL:', window.location.href);

            try {
                // Wait for session to stabilize
                await new Promise(res => setTimeout(res, 300));
                const { data, error } = await supabase.auth.getSession();

                if (error || !data.session) {
                    console.error('[AuthCallback] ❌ No session or error:', error);
                    navigate("/login", { replace: true });
                    return;
                }

                console.log('[AuthCallback] ✅ Session found for:', data.session.user.email);

                const user = data.session.user;

                // Fetch user role from database
                const { data: profile, error: profileError } = await supabase
                    .from("user_profiles")
                    .select("role")
                    .eq("user_id", user.id)
                    .maybeSingle();

                if (profileError) {
                    console.error('[AuthCallback] ⚠️ Profile fetch error:', profileError);
                }

                // Auto-create profile if missing (safe fallback for Google OAuth)
                if (!profile) {
                    console.log('[AuthCallback] ✏️ Profile not found, creating default patient profile');
                    await supabase.from("user_profiles").insert({
                        user_id: user.id,
                        email: user.email,
                        role: 'patient',
                        created_at: new Date().toISOString(),
                    });

                    // Also ensure they have a role entry
                    await supabase.from("user_roles").insert({
                        user_id: user.id,
                        role: 'patient',
                    });

                    console.log('[AuthCallback] 🔄 REDIRECT: /patient/dashboard (new user)');
                    navigate("/patient/dashboard", { replace: true });
                    return;
                }

                const userRole = profile?.role;
                console.log('[AuthCallback] ✅ User role:', userRole);

                if (userRole === "doctor") {
                    console.log('[AuthCallback] 🔄 REDIRECT: /doctor/dashboard (doctor)');
                    navigate("/doctor/dashboard", { replace: true });
                } else {
                    // Default to patient dashboard for 'patient' or any other role
                    console.log('[AuthCallback] 🔄 REDIRECT: /patient/dashboard (default)');
                    navigate("/patient/dashboard", { replace: true });
                }
            } catch (err) {
                console.error('[AuthCallback] ❌ Exception:', err);
                navigate("/login", { replace: true });
            }
        };

        finishLogin();
    }, [navigate]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mb-4"></div>
            <p className="text-gray-600 font-medium">Completing sign-in…</p>
        </div>
    );
}
