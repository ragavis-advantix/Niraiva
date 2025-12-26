import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

type ProfilePayload = {
    id: string;
    email?: string | null;
    profile?: any;
    clinical?: any;
};

async function fetchProfile(token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch('/api/me/profile', { headers });
    if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);
    return res.json();
}

export function useProfile() {
    const { session } = useAuth();
    const token = session?.access_token;

    return useQuery<ProfilePayload>({
        queryKey: ['profile', session?.user?.id],
        queryFn: () => fetchProfile(token),
        enabled: !!session?.user,
        staleTime: 1000 * 60 * 2,
    });
}
