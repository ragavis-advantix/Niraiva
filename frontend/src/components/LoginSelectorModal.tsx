import React from 'react';
import { useNavigate } from 'react-router-dom';

interface Props {
    open: boolean;
    onClose: () => void;
}

export default function LoginSelectorModal({ open, onClose }: Props) {
    const navigate = useNavigate();

    if (!open) return null;

    const goTo = (path: string) => {
        onClose();
        navigate(path);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">

            {/* DARK BLUR OVERLAY */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-md"
                onClick={onClose}
            />

            {/* MODAL CONTAINER */}
            <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl
        bg-gradient-to-br from-[#0B1220] via-[#0F1A2E] to-[#0B1220]
        border border-white/10 shadow-[0_0_40px_rgba(0,255,255,0.15)]
        px-6 py-7 animate-[fadeIn_0.25s_ease-out]">

                {/* TITLE */}
                <h2 className="text-center text-xl font-semibold text-white">
                    Login to Niraiva
                </h2>
                <p className="text-center text-sm text-cyan-200/70 mt-1">
                    Choose how you want to continue
                </p>

                {/* OPTIONS */}
                <div className="mt-6 space-y-4">

                    {/* PATIENT */}
                    <button
                        onClick={() => goTo('/login')}
                        className="group w-full rounded-xl p-4 text-left
              bg-gradient-to-r from-cyan-500/10 to-cyan-400/5
              border border-cyan-400/30
              hover:border-cyan-400/70
              hover:shadow-[0_0_20px_rgba(0,255,255,0.35)]
              transition-all duration-300"
                    >
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-white font-semibold">
                                    Patient
                                </p>
                                <p className="text-sm text-cyan-200/70">
                                    View your health records
                                </p>
                            </div>
                            <span className="text-cyan-400 text-xl group-hover:translate-x-1 transition">
                                →
                            </span>
                        </div>
                    </button>

                    {/* DOCTOR */}
                    <button
                        onClick={() => goTo('/doctor/login')}
                        className="group w-full rounded-xl p-4 text-left
              bg-gradient-to-r from-indigo-500/10 to-purple-500/5
              border border-indigo-400/30
              hover:border-indigo-400/70
              hover:shadow-[0_0_20px_rgba(120,120,255,0.35)]
              transition-all duration-300"
                    >
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-white font-semibold">
                                    Doctor
                                </p>
                                <p className="text-sm text-indigo-200/70">
                                    Manage patients & reports
                                </p>
                            </div>
                            <span className="text-indigo-400 text-xl group-hover:translate-x-1 transition">
                                →
                            </span>
                        </div>
                    </button>

                </div>

                {/* CANCEL */}
                <button
                    onClick={onClose}
                    className="mt-6 w-full text-sm text-white/60 hover:text-white transition"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
