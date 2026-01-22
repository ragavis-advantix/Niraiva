import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FhirSyncModal } from '@/components/FhirSyncModal';
import { FhirDataCard } from '@/components/FhirDataCard';

function calcAge(dob?: string) {
    if (!dob) return null;
    const bd = new Date(dob);
    if (isNaN(bd.getTime())) return null;
    const diff = Date.now() - bd.getTime();
    const ageDt = new Date(diff);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
}

export default function Profile() {
    const { session } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [abhaId, setAbhaId] = useState<string | null>(null);
    const [showEmailInput, setShowEmailInput] = useState(false);
    const [emailInput, setEmailInput] = useState('');
    const [showFhirModal, setShowFhirModal] = useState(false);
    const [fhirData, setFhirData] = useState<any>(null);

    useEffect(() => {
        let mounted = true;

        async function load() {
            setLoading(true);
            try {
                const { data: authData } = await supabase.auth.getUser();
                const userId = authData?.user?.id;

                if (!userId) {
                    if (mounted) setProfile(null);
                    return;
                }

                const { data: profileRow, error: profileErr } = await supabase
                    .from('user_profiles')
                    .select('first_name,middle_name,last_name,email,mobile,gender,dob,abha_number,abha_profile,allergies')
                    .eq('user_id', userId)
                    .single();

                if (profileErr) {
                    console.debug('user_profiles read error (may be missing):', profileErr.message || profileErr);
                }

                const built = {
                    first_name: profileRow?.first_name || null,
                    middle_name: profileRow?.middle_name || null,
                    last_name: profileRow?.last_name || null,
                    email: profileRow?.email || authData?.user?.email || null,
                    phone: profileRow?.mobile || null,
                    gender: profileRow?.gender || null,
                    dob: profileRow?.dob || null,
                    allergies: profileRow?.allergies || null,
                };

                const abha = profileRow?.abha_number || profileRow?.abha_profile?.abha_number || null;

                if (mounted) {
                    setProfile(built);
                    setAbhaId(abha ?? null);
                    setEmailInput(built.email || '');
                }
            } catch (err) {
                console.error('Error loading profile', err);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        load();
        return () => { mounted = false; };
    }, [session?.user?.id]);

    const fullName = useMemo(() => {
        if (!profile) return null;
        const parts = [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean);
        return parts.length ? parts.join(' ') : null;
    }, [profile]);

    const age = useMemo(() => calcAge(profile?.dob), [profile?.dob]);

    async function saveEmail() {
        try {
            const { data: authData } = await supabase.auth.getUser();
            const userId = authData?.user?.id;
            if (!userId) throw new Error('Not authenticated');

            const payload: any = { user_id: userId, email: emailInput };
            const { error } = await supabase.from('user_profiles').upsert(payload);
            if (error) {
                console.error('Error saving email', error);
                toast.error('Failed to save email');
                return;
            }

            toast.success('Email saved');
            setShowEmailInput(false);
            setProfile((p: any) => ({ ...(p || {}), email: emailInput }));
        } catch (err) {
            console.error(err);
            toast.error('Failed to save email');
        }
    }

    async function handleLogout() {
        try {
            await supabase.auth.signOut();
            toast.success('Logged out');
            navigate('/');
        } catch (err) {
            console.error('Logout error', err);
            toast.error('Failed to log out');
        }
    }

    function handleFhirSyncComplete(data: any) {
        setFhirData(data);
        toast.success('FHIR data synced successfully!');
    }

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto px-8 py-10">
                <div className="animate-pulse space-y-6">
                    <div className="w-28 h-28 rounded-full bg-gray-200 mx-auto" />
                    <div className="h-6 bg-gray-200 rounded w-48 mx-auto" />
                    <div className="mt-8 bg-white shadow-sm border rounded-xl p-6">
                        <div className="h-40 bg-gray-100 rounded" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-8 py-10">
            <div className="flex flex-col items-center">
                <div className="w-28 h-28 rounded-full bg-blue-100 flex items-center justify-center text-4xl font-semibold text-gray-700 shadow-sm">
                    {(fullName?.trim().charAt(0) || (profile?.email || 'U').trim().charAt(0) || 'U').toUpperCase()}
                </div>

                <h2 className="mt-4 text-2xl font-semibold">{fullName || profile?.email || 'User'}</h2>
                <p className="text-gray-500">{age ? `${age} years • ${profile?.gender || ''}` : profile?.gender || ''}</p>
            </div>

            <div className="mt-8 bg-white shadow-sm border rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Personal Information</h3>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="font-medium">{profile?.phone || 'Not added'}</p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">Email</p>
                        {profile?.email ? (
                            <p className="font-medium">{profile.email}</p>
                        ) : (
                            <>
                                <p className="text-sm text-gray-500">Not added</p>
                                <button className="mt-2 text-blue-600 underline" onClick={() => setShowEmailInput(true)}>Add email</button>
                            </>
                        )}
                    </div>
                </div>

                {showEmailInput && (
                    <div className="mt-3">
                        <div className="flex items-center gap-3">
                            <input
                                type="email"
                                placeholder="you@example.com"
                                className="flex-1 border rounded-lg px-4 py-2"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                            />
                            <button className="px-4 py-2 bg-blue-500 text-white rounded-lg" onClick={saveEmail}>Save</button>
                            <button className="px-4 py-2 border rounded-lg" onClick={() => setShowEmailInput(false)}>Cancel</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-6 bg-white shadow-sm border rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    ABHA ID
                    <span className="text-xs text-gray-400">(Ayushman Bharat Health Account)</span>
                </h3>

                <div className="mt-2">
                    {abhaId ? (
                        <p className="text-green-600 font-medium">{abhaId} <span className="text-gray-500 ml-2">• Linked</span></p>
                    ) : (
                        <>
                            <p className="text-gray-500">No ABHA ID linked.</p>
                            <button
                                className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg"
                                onClick={() => navigate('/patient/dashboard?openAbhaPopup=true')}
                            >
                                Create ABHA ID
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* FHIR Sync Section */}
            <div className="mt-6 bg-white dark:bg-dark-card shadow-sm border border-gray-200 dark:border-dark-cardBorder rounded-xl p-6">
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text flex items-center gap-2">
                    FHIR Health Data
                    <span className="text-xs text-light-subtext dark:text-dark-subtext">(FHIR R4)</span>
                </h3>

                <div className="mt-4">
                    {!fhirData ? (
                        <>
                            <p className="text-light-subtext dark:text-dark-subtext mb-4">No synced data yet.</p>
                            <button
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                                onClick={() => setShowFhirModal(true)}
                            >
                                Sync FHIR Data
                            </button>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-green-600 dark:text-green-400 font-medium">✓ Data synced successfully</p>
                                <button
                                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                    onClick={() => setShowFhirModal(true)}
                                >
                                    Sync Again
                                </button>
                            </div>
                            <FhirDataCard data={fhirData} />
                        </div>
                    )}
                </div>
            </div>

            {/* FHIR Sync Modal */}
            <FhirSyncModal
                isOpen={showFhirModal}
                onClose={() => setShowFhirModal(false)}
                onComplete={handleFhirSyncComplete}
            />

            <div className="h-px bg-gray-200 w-full mt-10 mb-4"></div>

            <div className="mt-6 text-center">
                <button className="px-6 py-2 bg-teal-500 text-white rounded-xl shadow" onClick={() => toast.info('Edit Profile feature is coming soon!')}>Edit Profile</button>
            </div>

            <div className="mt-3 flex flex-col items-center gap-3">
                <button
                    className="px-6 py-2 bg-blue-500 text-white rounded-xl shadow"
                    onClick={() => navigate('/patient/dashboard')}
                >
                    Go to Dashboard
                </button>

                <button
                    className="px-6 py-2 text-red-500 rounded-xl border border-red-300 hover:bg-red-50"
                    onClick={handleLogout}
                >
                    Logout
                </button>
            </div>
        </div>
    );
}

