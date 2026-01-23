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

                // 1. Ensure profile exists (DO NOT query role here)
                const { data: profile } = await supabase
                    .from("user_profiles")
                    .select("id")
                    .eq("user_id", user.id)
                    .maybeSingle();

                if (!profile) {
                    console.log('[AuthCallback] ✏️ Profile not found, creating default entry');
                    await supabase.from("user_profiles").insert({
                        user_id: user.id,
                        email: user.email,
                    });
                }

                // 2. Fetch role ONLY from user_roles
                console.log('[AuthCallback] ↳ Fetching role from user_roles...');
                let { data: roleRow } = await supabase
                    .from("user_roles")
                    .select("role")
                    .eq("user_id", user.id)
                    .maybeSingle();

                if (!roleRow) {
                    console.log('[AuthCallback] ✏️ Role not found, creating default patient role');
                    const { data: newRole } = await supabase.from("user_roles").insert({
                        user_id: user.id,
                        role: 'patient',
                    }).select('role').single();
                    roleRow = newRole;
                }

                const userRole = roleRow?.role || 'patient';
                console.log('[AuthCallback] ✅ User role:', userRole);

                if (userRole === "doctor") {
                    console.log('[AuthCallback] 🔄 REDIRECT: /doctor/dashboard');
                    navigate("/doctor/dashboard", { replace: true });
                } else {
                    // NIRIAVA REQUIREMENT: Bootstrap patient record
                    console.log('[AuthCallback] 🚀 Bootstrapping patient record...');
                    const { getApiBaseUrl } = await import('@/lib/fhir');
                    const apiBase = getApiBaseUrl();
                    try {
                        const bootstrapRes = await fetch(`${apiBase}/api/auth/bootstrap-patient`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${data.session.access_token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        if (!bootstrapRes.ok) {
                            console.warn('[AuthCallback] ⚠️ Bootstrap failed:', await bootstrapRes.text());
                        } else {
                            console.log('[AuthCallback] ✅ Patient bootstrap complete');
                        }
                    } catch (bootstrapErr) {
                        console.error('[AuthCallback] ❌ Bootstrap connection error:', bootstrapErr);
                    }

                    console.log('[AuthCallback] 🔄 REDIRECT: /patient/dashboard');
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
