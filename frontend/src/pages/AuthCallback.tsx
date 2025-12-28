import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
    const navigate = useNavigate();

    useEffect(() => {
        const handleAuth = async () => {
            const { data, error } = await supabase.auth.getSession();

            if (error) {
                console.error("Auth callback error:", error);
                navigate("/login");
                return;
            }

            console.log('Auth callback session retrieved:', data.session);
            // Logic for redirection is also handled globally in AuthContext.tsx
            // but we provide a fallback here for robustness.
            if (data.session) {
                // Check local path to see if it's a doctor or patient 
                // (Handled by the global listener in AuthContext, but let's be safe)
                const { data: roleRow } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', data.session.user.id)
                    .maybeSingle();

                if (roleRow?.role === 'doctor') {
                    navigate("/doctor/dashboard");
                } else {
                    navigate("/dashboard");
                }
            } else {
                navigate("/login");
            }
        };

        handleAuth();
    }, [navigate]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mb-4"></div>
            <p className="text-gray-600 font-medium">Signing you in…</p>
        </div>
    );
}
