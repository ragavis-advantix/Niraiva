import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
    const navigate = useNavigate();

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
                // Simple role check for the redirect
                supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', data.session.user.id)
                    .maybeSingle()
                    .then(({ data: roleRow }) => {
                        if (roleRow?.role === 'doctor') {
                            navigate("/doctor/dashboard", { replace: true });
                        } else {
                            navigate("/dashboard", { replace: true });
                        }
                    });
            } else {
                navigate("/login", { replace: true });
            }
        });
    }, [navigate]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mb-4"></div>
            <p className="text-gray-600 font-medium">Completing sign-in…</p>
        </div>
    );
}
