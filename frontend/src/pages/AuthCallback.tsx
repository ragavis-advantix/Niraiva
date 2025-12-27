import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner"; // Added back for better UX during role check

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      // Supabase automatically detects the session from the URL hash
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        console.error("Auth callback session error:", error);
        navigate("/login");
        return;
      }

      const user = data.session.user;
      const userId = user.id;

      // Check for phone metadata to claim legacy profiles (Legacy Logic kept for safety)
      const phone = user.user_metadata?.phone;
      if (phone) {
        try {
          // Import dynamic to avoid circular dependencies if any
          const { getApiBaseUrl } = await import("@/lib/fhir");
          await fetch(`${getApiBaseUrl()}/api/user/claim-profile`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.session.access_token}`
            },
            body: JSON.stringify({ phone })
          });
        } catch (claimErr) {
          console.error("Error claiming profile in callback:", claimErr);
        }
      }

      // 🔍 Check role from DB/user_roles table
      try {
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();

        if (roleError) throw roleError;

        if (roleData?.role === "doctor") {
          toast.success("Welcome, Doctor!");
          navigate("/doctor/dashboard");
        } else {
          toast.success("Welcome back!");
          navigate("/dashboard"); // PATIENT dashboard
        }
      } catch (err) {
        console.error("Role check error in callback:", err);
        navigate("/dashboard"); // Fallback to patient dashboard
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Signing you in...</p>
      </div>
    </div>
  );
}