import React, { useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { ShieldCheck } from 'lucide-react';

export const PersonalRecordUpload: React.FC = () => {
    const { user } = useAuth();
    const [type, setType] = useState<string>('photo');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            const formData = new FormData();
            formData.append('type', type);
            formData.append('data', JSON.stringify({ description }));
            if (file) {
                formData.append('file', file);
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/personal-records/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${user?.access_token}`
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            setSuccess(true);
            setDescription('');
            setFile(null);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Add Personal Record</h1>
            <p className="text-gray-600 mb-6">
                Upload photos, notes, or track your symptoms. This data is labeled as <span className="font-bold text-purple-600">"You added"</span> in your timeline.
            </p>

            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Type
                    </label>
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                        <option value="photo">Photo</option>
                        <option value="note">Note</option>
                        <option value="symptom">Symptom</option>
                        <option value="lifestyle">Lifestyle</option>
                        <option value="wearable">Wearable Data</option>
                    </select>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        placeholder="Describe what you're tracking..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>

                {type === 'photo' && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Upload Photo
                        </label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                    </div>
                )}

                <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-purple-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <p className="text-sm font-medium text-purple-900">Patient-Reported Data</p>
                            <p className="text-xs text-purple-700">
                                This will be clearly labeled as "You added" in your timeline and visible to doctors with your consent.
                            </p>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg animate-in fade-in slide-in-from-top-1">
                        <p className="text-sm text-green-600 font-bold uppercase tracking-widest flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" /> Personal Record Added Successfully
                        </p>
                        <p className="text-xs text-green-500 mt-1">This entry is now part of your personal health history and labeled as "You added".</p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    {loading ? 'Uploading...' : 'Upload Record'}
                </button>
            </form>
        </div>
    );
};
