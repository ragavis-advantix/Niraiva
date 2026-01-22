import React from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';

export default function DoctorTopBar() {
    const navigate = useNavigate();

    const logout = async () => {
        await supabase.auth.signOut();
        navigate('/doctor/login');
    };

    return (
        <div className="bg-white shadow-sm">
            <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <img src="/niraiva-logo.png" className="h-8" alt="Niraiva Logo" />
                    <span className="font-semibold text-gray-900">
                        Niraiva Doctor Portal
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/doctor/profile')}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-cyan-600 transition-colors"
                    >
                        <User className="w-4 h-4" />
                        Profile
                    </button>
                    <button
                        onClick={logout}
                        className="text-sm text-red-600 hover:underline"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
}
