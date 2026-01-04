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
                    .single();

                if (profileError) {
                    console.error('[AuthCallback] ⚠️ Profile fetch error:', profileError);
                    // Default to patient dashboard if role fetch fails
                    console.log('[AuthCallback] 🔄 REDIRECT: /dashboard (fallback)');
                    navigate("/dashboard", { replace: true });
                    return;
                }

                const userRole = profile?.role;
                console.log('[AuthCallback] ✅ User role:', userRole);

                if (userRole === "patient") {
                    console.log('[AuthCallback] 🔄 REDIRECT: /dashboard (patient)');
                    navigate("/dashboard", { replace: true });
                } else if (userRole === "doctor") {
                    console.log('[AuthCallback] 🔄 REDIRECT: /doctor/dashboard (doctor)');
                    navigate("/doctor/dashboard", { replace: true });
                } else {
                    console.log('[AuthCallback] ⚠️ Unknown role, redirecting to landing page');
                    navigate("/", { replace: true });
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
