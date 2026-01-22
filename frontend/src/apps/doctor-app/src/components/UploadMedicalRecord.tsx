import React, { useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';

interface UploadMedicalRecordProps {
    patientId: string;
    onSuccess?: () => void;
}

export const UploadMedicalRecord: React.FC<UploadMedicalRecordProps> = ({ patientId, onSuccess }) => {
    const { user } = useAuth();
    const [recordType, setRecordType] = useState<string>('lab');
    const [source, setSource] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            const formData = new FormData();
            formData.append('patient_id', patientId);
            formData.append('record_type', recordType);
            formData.append('source', source);
            if (file) {
                formData.append('file', file);
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/medical-records/upload`, {
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
            setSource('');
            setFile(null);

            if (onSuccess) {
                onSuccess();
            }

            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Upload Medical Record</h2>

            <form onSubmit={handleSubmit}>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Record Type
                    </label>
                    <select
                        value={recordType}
                        onChange={(e) => setRecordType(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="lab">Lab Report</option>
                        <option value="imaging">Imaging (X-Ray, MRI, CT)</option>
                        <option value="prescription">Prescription</option>
                        <option value="diagnosis">Diagnosis</option>
                        <option value="consultation">Consultation Notes</option>
                        <option value="procedure">Procedure Report</option>
                        <option value="vitals">Vitals</option>
                    </select>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Source (Hospital/Lab Name)
                    </label>
                    <input
                        type="text"
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        placeholder="e.g., Apollo Hospital, Quest Diagnostics"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload File (PDF, Image)
                    </label>
                    <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    />
                </div>

                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <p className="text-sm font-medium text-blue-900">Clinical Record</p>
                            <p className="text-xs text-blue-700">
                                This will be marked as "Doctor-reported" and will trigger AI parsing for structured data extraction.
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
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-600">Medical record uploaded successfully!</p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !file}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    {loading ? 'Uploading & Processing...' : 'Upload Medical Record'}
                </button>
            </form>
        </div>
    );
};
