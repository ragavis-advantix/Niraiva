import React from 'react';
import { Link } from 'react-router-dom';

export const ActivationSuccess: React.FC = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center transform transition-all hover:scale-[1.01]">
                <div className="mb-8">
                    <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 text-green-600 rounded-full mb-6 animate-bounce">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 mb-3 tracking-tight">Access Activated 🎉</h1>
                    <p className="text-gray-500 text-lg leading-relaxed">
                        Welcome to Niraiva. Your personal health record is now ready and secured.
                    </p>
                </div>

                <div className="bg-blue-50 rounded-2xl p-6 mb-8 text-left border border-blue-100">
                    <h3 className="text-blue-900 font-bold mb-2 flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        What's Next?
                    </h3>
                    <ul className="text-blue-800 text-sm space-y-2">
                        <li className="flex items-start">
                            <span className="mr-2 font-bold">•</span>
                            View your complete clinical timeline
                        </li>
                        <li className="flex items-start">
                            <span className="mr-2 font-bold">•</span>
                            Upload personal health logs & photos
                        </li>
                        <li className="flex items-start">
                            <span className="mr-2 font-bold">•</span>
                            Manage doctor access in your dashboard
                        </li>
                    </ul>
                </div>

                <Link
                    to="/patient/home"
                    className="block w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-blue-700 transition transform active:scale-95 shadow-xl shadow-blue-200"
                >
                    Go to My Health
                </Link>

                <p className="mt-6 text-gray-400 text-xs">
                    NIRAIVA HEALTH INTELLIGENCE &nbsp;•&nbsp; SECURE ACCESS
                </p>
            </div>
        </div>
    );
};
