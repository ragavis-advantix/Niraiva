import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import LoginSelectorModal from '@/components/LoginSelectorModal';
import {
    Shield,
    Activity,
    Upload,
    Lock,
    CheckCircle,
    ArrowRight,
    Zap
} from 'lucide-react';

export default function LandingPage() {
    const navigate = useNavigate();
    const [openLoginModal, setOpenLoginModal] = useState(false);

    const features = [
        {
            icon: <CheckCircle className="w-8 h-8" />,
            title: "ABHA Integrated",
            description: "Create, verify & link your ABHA Health ID in one tap.",
            badge: "ABHA",
            color: "from-blue-500 to-cyan-500"
        },
        {
            icon: <Zap className="w-8 h-8" />,
            title: "FHIR Compliant",
            description: "Securely exchange medical records following global FHIR standards.",
            badge: "FHIR R4",
            color: "from-orange-500 to-red-500"
        },
        {
            icon: <Lock className="w-8 h-8" />,
            title: "Encrypted Health Records",
            description: "Your medical files stored with hospital-grade security.",
            badge: "AES-256",
            color: "from-purple-500 to-pink-500"
        },
        {
            icon: <Activity className="w-8 h-8" />,
            title: "Smart Personal Dashboard",
            description: "Track symptoms, vitals, visits, scans & reports effortlessly.",
            badge: "Real-time",
            color: "from-green-500 to-emerald-500"
        },
        {
            icon: <Upload className="w-8 h-8" />,
            title: "Medical Report Sync",
            description: "Upload images or medical records and organize them instantly.",
            badge: "AI-Powered",
            color: "from-cyan-500 to-blue-500"
        }
    ];

    const certifications = [
        { name: "ABHA", subtitle: "Health ID" },
        { name: "ABDM", subtitle: "Digital Mission" },
        { name: "NDHM", subtitle: "Health Mission" },
        { name: "FHIR", subtitle: "R4 Standard" },
        { name: "HL7", subtitle: "Interoperability" }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
            {/* Navbar */}
            <nav className="fixed top-0 w-full bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo - Text Only */}
                        <div className="text-2xl font-bold tracking-wide text-white">
                            NIRAIVA
                        </div>

                        {/* Center Links */}
                        <div className="hidden md:flex items-center gap-8 text-sm">
                            <a href="#solutions" className="text-gray-300 hover:text-white transition-colors">Solutions</a>
                            <a href="/abha" className="text-gray-300 hover:text-white transition-colors">ABHA</a>
                            <a href="/fhir" className="text-gray-300 hover:text-white transition-colors">FHIR</a>
                            <a href="/security" className="text-gray-300 hover:text-white transition-colors">Security</a>
                            <a href="#contact" className="text-gray-300 hover:text-white transition-colors">Contact</a>
                        </div>

                        {/* Right Buttons */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setOpenLoginModal(true)}
                                className="px-6 py-2 border border-cyan-400/50 text-cyan-400 rounded-lg hover:bg-cyan-400/10 transition-all"
                            >
                                Login
                            </button>
                            <button
                                onClick={() => navigate('/signup')}
                                className="px-6 py-2 bg-gradient-to-r from-coral-500 to-orange-500 text-white rounded-lg hover:shadow-lg hover:shadow-coral-500/50 transition-all"
                            >
                                Sign Up
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        {/* Left: Headline + CTA */}
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8 }}
                            className="space-y-8"
                        >
                            <div className="space-y-4">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="inline-block px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 text-sm"
                                >
                                    ✨ The Future of Patient-Centered Healthcare
                                </motion.div>

                                <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                                    Your Health,{' '}
                                    <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                                        Connected.
                                    </span>{' '}
                                    <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                                        Secure.
                                    </span>{' '}
                                    <span className="bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent">
                                        Interoperable.
                                    </span>
                                </h1>

                                <p className="text-xl text-gray-400 leading-relaxed">
                                    Experience the future of patient-centered healthcare. Niraiva brings digital health to life with{' '}
                                    <span className="text-cyan-400 font-semibold">ABHA integration</span>, seamless{' '}
                                    <span className="text-orange-400 font-semibold">FHIR syncing</span>, trusted record storage,
                                    and a smooth patient experience — all in one platform.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={() => navigate('/signup')}
                                    className="group px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-2xl hover:shadow-cyan-500/50 transition-all flex items-center justify-center gap-2"
                                >
                                    Create Your Health ID
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                                <button
                                    onClick={() => setOpenLoginModal(true)}
                                    className="px-8 py-4 border-2 border-cyan-400/50 text-cyan-400 rounded-xl font-semibold hover:bg-cyan-400/10 transition-all"
                                >
                                    Login to Your Records
                                </button>
                            </div>

                            {/* Trust Indicators */}
                            <div className="flex items-center gap-6 pt-4">
                                <div className="flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-green-400" />
                                    <span className="text-sm text-gray-400">Bank-Grade Security</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-blue-400" />
                                    <span className="text-sm text-gray-400">ABDM Certified</span>
                                </div>
                            </div>
                        </motion.div>

                        {/* Right: Hero Visual - Static (No Rotation) */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                            className="relative"
                        >
                            <div className="relative">
                                {/* Glowing Background */}
                                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 blur-3xl rounded-full" />

                                {/* Hero Image - Static */}
                                <img
                                    src="/hero_visual_collage_1764092326684.png"
                                    alt="Niraiva Healthcare Platform"
                                    className="relative z-10 w-full h-auto drop-shadow-2xl"
                                />
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 px-6 bg-slate-800/50">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-4xl font-bold mb-4">
                            Everything You Need for{' '}
                            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                                Modern Healthcare
                            </span>
                        </h2>
                        <p className="text-gray-400 text-lg">
                            Built on ABDM standards, powered by FHIR, secured for you
                        </p>
                    </motion.div>

                    {/* Feature Cards */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((feature, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className="group relative bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 hover:border-cyan-500/50 transition-all hover:shadow-xl hover:shadow-cyan-500/10"
                            >
                                {/* Gradient Overlay */}
                                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity`} />

                                <div className="relative z-10 space-y-4">
                                    {/* Icon */}
                                    <div className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center text-white`}>
                                        {feature.icon}
                                    </div>

                                    {/* Badge */}
                                    <span className="inline-block px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 text-xs font-semibold">
                                        {feature.badge}
                                    </span>

                                    {/* Content */}
                                    <h3 className="text-xl font-bold text-white">{feature.title}</h3>
                                    <p className="text-gray-400">{feature.description}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Patient Experience Showcase */}
            <section className="py-20 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        {/* Left: Enhanced Mockup */}
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-3xl" />
                            <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-3xl border border-slate-700 shadow-2xl">
                                <div className="space-y-4">
                                    {/* Dashboard Header */}
                                    <div className="h-12 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl flex items-center px-4">
                                        <div className="w-8 h-8 bg-white/20 rounded-lg" />
                                        <div className="ml-3 h-4 w-32 bg-white/30 rounded" />
                                    </div>

                                    {/* ABHA Card + FHIR Badge */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="h-32 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl p-4 flex flex-col justify-between">
                                            <div className="text-xs text-white/80">ABHA Health ID</div>
                                            <div className="h-3 w-24 bg-white/40 rounded" />
                                        </div>
                                        <div className="h-32 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl p-4 flex items-center justify-center">
                                            <div className="text-white font-bold text-sm">FHIR R4</div>
                                        </div>
                                    </div>

                                    {/* Vitals Grid */}
                                    <div className="h-48 bg-slate-700/50 rounded-xl p-4 space-y-3">
                                        <div className="h-4 w-20 bg-slate-600 rounded" />
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="h-16 bg-slate-600/50 rounded-lg" />
                                            <div className="h-16 bg-slate-600/50 rounded-lg" />
                                            <div className="h-16 bg-slate-600/50 rounded-lg" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Right: Content */}
                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="space-y-6"
                        >
                            <h2 className="text-4xl font-bold">
                                Designed for{' '}
                                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                                    Patients.
                                </span>
                                <br />
                                Built for{' '}
                                <span className="bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">
                                    Healthcare Standards.
                                </span>
                            </h2>

                            <p className="text-xl text-gray-400 leading-relaxed">
                                Niraiva simplifies digital health: from ABHA linking to secure FHIR syncing,
                                every action is fast, safe, and beautifully designed.
                            </p>

                            <ul className="space-y-4">
                                {[
                                    "Create your ABHA Health ID",
                                    "Sync hospital records automatically",
                                    "Bank-grade encrypted storage",
                                    "Organize all medical files easily"
                                ].map((item, index) => (
                                    <li key={index} className="flex items-center gap-3">
                                        <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
                                        <span className="text-gray-300">{item}</span>
                                    </li>
                                ))}
                            </ul>

                            <button className="group px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-2xl hover:shadow-cyan-500/50 transition-all flex items-center gap-2">
                                Explore Features
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Certifications Band */}
            <section className="py-16 px-6 bg-slate-800/50 border-y border-slate-700">
                <div className="max-w-7xl mx-auto">
                    <p className="text-center text-gray-400 mb-8">
                        Built on the Ayushman Bharat Digital Mission Standards
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-12">
                        {certifications.map((cert, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, scale: 0.8 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className="text-center"
                            >
                                <div className="text-2xl font-bold text-cyan-400">{cert.name}</div>
                                <div className="text-sm text-gray-500">{cert.subtitle}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 bg-slate-900 border-t border-slate-800">
                <div className="max-w-7xl mx-auto">
                    <div className="grid md:grid-cols-4 gap-8 mb-8">
                        {/* Logo */}
                        <div>
                            <div className="text-xl font-bold mb-4">NIRAIVA</div>
                            <p className="text-gray-400 text-sm">
                                Your trusted digital health companion
                            </p>
                        </div>

                        {/* Links */}
                        <div>
                            <h4 className="font-semibold mb-4">Product</h4>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li><a href="#" className="hover:text-cyan-400 transition-colors">Features</a></li>
                                <li><a href="/abha" className="hover:text-cyan-400 transition-colors">ABHA Integration</a></li>
                                <li><a href="/fhir" className="hover:text-cyan-400 transition-colors">FHIR Sync</a></li>
                                <li><a href="/security" className="hover:text-cyan-400 transition-colors">Security</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-4">Company</h4>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li><a href="#" className="hover:text-cyan-400 transition-colors">About</a></li>
                                <li><a href="#" className="hover:text-cyan-400 transition-colors">Careers</a></li>
                                <li><a href="#" className="hover:text-cyan-400 transition-colors">Contact</a></li>
                                <li><a href="#" className="hover:text-cyan-400 transition-colors">Blog</a></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-4">Legal</h4>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li><a href="#" className="hover:text-cyan-400 transition-colors">Privacy Policy</a></li>
                                <li><a href="#" className="hover:text-cyan-400 transition-colors">Terms of Service</a></li>
                                <li><a href="#" className="hover:text-cyan-400 transition-colors">Cookie Policy</a></li>
                                <li><a href="#" className="hover:text-cyan-400 transition-colors">Compliance</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-800 text-center text-gray-500 text-sm">
                        © 2025 Niraiva. All rights reserved. Built with ❤️ for better healthcare.
                    </div>
                </div>
            </footer>

            {/* Login Selector Modal */}
            <LoginSelectorModal
                open={openLoginModal}
                onClose={() => setOpenLoginModal(false)}
            />
        </div>
    );
}
