import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getApiBaseUrl } from '@/lib/fhir';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase returns tokens in the URL fragment (hash)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        console.log('[AuthCallback] Checking for tokens in URL...');

        // If tokens are present, set the session (OAuth flow)
        if (accessToken) {
          console.log('[AuthCallback] OAuth tokens detected, setting session...');
          const { data: { session }, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (error) {
            console.error('[AuthCallback] setSession error:', error);
            toast.error('Failed to complete login');
            navigate('/login');
            return;
          }

          const user = session?.user;
          const phone = user?.user_metadata?.phone;

          if (phone) {
            console.log('[AuthCallback] Phone metadata found, attempting to claim profile...');
            try {
              const claimRes = await fetch(`${getApiBaseUrl()}/api/user/claim-profile`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ phone })
              });
              const claimData = await claimRes.json();
              if (claimData.success) {
                toast.success("Medical record linked successfully!");
              }
            } catch (claimErr) {
              console.error("[AuthCallback] Claim error:", claimErr);
            }
          }

          console.log('[AuthCallback] Session set successfully');
          toast.success('Login successful!');
          navigate('/dashboard');
          return;
        }

        // No tokens found - redirect to login
        console.log('[AuthCallback] No tokens found in URL');
        navigate('/login');
      } catch (error) {
        console.error('[AuthCallback] Error:', error);
        toast.error('An error occurred during authentication');
        navigate('/login');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">Completing sign in...</h2>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    </div>
  );
}