import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

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

                <button
                    onClick={logout}
                    className="text-sm text-red-600 hover:underline"
                >
                    Logout
                </button>
            </div>
        </div>
    );
}
