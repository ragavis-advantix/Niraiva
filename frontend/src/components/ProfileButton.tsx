import React from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileButton() {
    const { data, isLoading } = useProfile();
    const { signOut } = useAuth();

    const displayName = isLoading ? '...' : data?.profile?.full_name || data?.email || 'User';
    const initial = (displayName || 'U').trim().charAt(0).toUpperCase();

    return (
        <div className="ml-4 flex items-center">
            <Link to="/profile" title="View profile" className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-niraiva-100 text-niraiva-700 flex items-center justify-center font-semibold">{initial}</div>
                <span className="hidden sm:inline text-sm text-gray-700 dark:text-gray-200">{displayName}</span>
            </Link>
            <button
                onClick={() => signOut().catch(() => { })}
                className="ml-3 text-sm text-red-600 hover:underline"
            >
                Logout
            </button>
        </div>
    );
}
