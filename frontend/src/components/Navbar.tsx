
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Clock, Map, Menu, X, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfileButton from '@/components/ProfileButton';
import ThemeToggle from '@/components/ThemeToggle';
import { useIsMobile } from '@/hooks/use-mobile';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    path: '/patient/dashboard',
    label: 'Dashboard',
    icon: <Home className="h-5 w-5" />,
  },
  {
    path: '/patient/timeline',
    label: 'Timeline',
    icon: <Clock className="h-5 w-5" />,
  },
  {
    path: '/patient/diagnostic',
    label: 'Diagnostic',
    icon: <Map className="h-5 w-5" />,
  },
  {
    path: '/patient/upload-reports',
    label: 'Upload Reports',
    icon: <Upload className="h-5 w-5" />,
  },
];

export default function Navbar() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "w-full px-4 transition-all duration-300",
        scrolled ? "py-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-sm" : "py-4"
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* left: branding in-flow (logo + name) */}
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/lovable-uploads/61f90f3e-8203-4812-8785-a19b6e5eeaab.png"
            alt="Niraiva Logo"
            className="w-10 h-10 object-contain"
          />
          <span className="text-2xl font-bold text-gray-900 dark:text-white">Niraiva</span>
        </Link>
        <Link to="/" className="sr-only">
          Home
        </Link>

        {isMobile ? (
          <>
            <button
              onClick={toggleMenu}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full left-0 right-0 bg-white dark:bg-gray-900 shadow-lg mt-1 py-2 rounded-b-lg glass-panel"
              >
                <nav className="flex flex-col">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-2 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
                        location.pathname === item.path ? "text-niraiva-600 font-medium" : "text-gray-600 dark:text-gray-300"
                      )}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </nav>
                <div className="flex items-center justify-between px-4 py-2 border-t dark:border-gray-700">
                  <ThemeToggle />
                  <ProfileButton />
                </div>
              </motion.div>
            )}
          </>
        ) : (
          <nav className="flex items-center gap-3">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
                  location.pathname === item.path
                    ? "bg-niraiva-100 text-niraiva-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
            <ThemeToggle />
            <ProfileButton />
          </nav>
        )}
      </div>
    </motion.header>
  );
}
