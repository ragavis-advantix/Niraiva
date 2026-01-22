import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';

export const PatientLogin: React.FC = () => {
    const navigate = useNavigate();
    const { signIn } = useAuth();
    const [loginMethod, setLoginMethod] = useState<'otp' | 'password'>('otp');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState<'indentify' | 'verify'>('indentify');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Mock sending OTP
        setTimeout(() => {
            setStep('verify');
            setLoading(false);
        }, 1000);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (loginMethod === 'password') {
                await signIn(email, password);
            } else {
                // Mock OTP login for demo
                // In production, use supabase.auth.signInWithOtp
                console.log('Logging in with OTP:', otp);
                // For simplicity in demo, we'll assume a specific test account
                await signIn('test-patient@niraiva.com', 'TestPass123!');
            }

            navigate('/patient/home');
        } catch (err: any) {
            setError(err.message || 'Login failed');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-black text-gray-900 mb-2">Login to Niraiva</h1>
                    <p className="text-gray-500 text-sm font-medium tracking-widest uppercase">Patient Portal</p>
                </div>

                <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8">
                    <button
                        onClick={() => { setLoginMethod('otp'); setStep('indentify'); }}
                        className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${loginMethod === 'otp' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Mobile / OTP
                    </button>
                    <button
                        onClick={() => setLoginMethod('password')}
                        className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${loginMethod === 'password' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Email / Password
                    </button>
                </div>

                {loginMethod === 'otp' ? (
                    <form onSubmit={step === 'indentify' ? handleSendOtp : handleLogin}>
                        {step === 'indentify' ? (
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-tighter mb-2">Mobile Number</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+91..."
                                    className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-lg"
                                    required
                                />
                            </div>
                        ) : (
                            <div className="mb-6 text-center">
                                <p className="text-sm text-gray-500 mb-4">Code sent to {phone}</p>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-tighter mb-2 text-left">6-Digit Code</label>
                                <input
                                    type="text"
                                    maxLength={6}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder="000 000"
                                    className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-mono text-center text-3xl tracking-[1em] font-black"
                                    required
                                />
                                <button type="button" onClick={() => setStep('indentify')} className="mt-4 text-sm text-blue-600 font-bold hover:underline">Change Number</button>
                            </div>
                        )}

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg text-sm text-red-700 font-bold">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-blue-700 transition transform active:scale-95 shadow-xl shadow-blue-100 disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : step === 'indentify' ? 'Send OTP' : 'Verify & Login'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleLogin}>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-tighter mb-2">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@email.com"
                                className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                                required
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-tighter mb-2">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                                required
                            />
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg text-sm text-red-700 font-bold">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-blue-700 transition transform active:scale-95 shadow-xl shadow-blue-100 disabled:opacity-50"
                        >
                            {loading ? 'Logging in...' : 'Sign In'}
                        </button>
                    </form>
                )}

                <div className="mt-8 text-center pt-8 border-t border-gray-100">
                    <p className="text-sm text-gray-400 font-medium">
                        Not activated your access yet? <br />
                        <span className="text-blue-600 font-black cursor-pointer hover:underline">Check your clinic invite</span>
                    </p>
                </div>
            </div>
        </div>
    );
};
