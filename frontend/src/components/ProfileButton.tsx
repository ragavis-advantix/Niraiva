import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';

export default function ProfileButton() {
    const { user, signOut } = useAuth();
    const { userProfile } = useData();

    const displayName = userProfile?.first_name
        ? `${userProfile.first_name} ${userProfile.last_name || ''}`.trim()
        : user?.user_metadata?.full_name || user?.email || 'User';
    const initial = (displayName || 'U').trim().charAt(0).toUpperCase();

    return (
        <div className="ml-4 flex items-center">
            <Link to="/patient/profile" title="View profile" className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-niraiva-100 text-niraiva-700 flex items-center justify-center font-semibold">{initial}</div>
                <span className="hidden sm:inline text-sm text-gray-700 dark:text-gray-200">{displayName}</span>
            </Link>
            <button
                onClick={() => {
                    console.log('🔘 [ProfileButton] Logout clicked');
                    signOut().catch((e) => console.error('❌ [ProfileButton] Logout error:', e));
                }}
                className="ml-3 text-sm text-red-600 hover:underline"
            >
                Logout
            </button>
        </div>
    );
}
