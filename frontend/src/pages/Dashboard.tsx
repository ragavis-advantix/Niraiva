import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import { VoiceCommand } from '@/components/VoiceCommand';
import { ReportUploader } from '@/components/ReportUploader';
import { HealthCard } from '@/components/HealthCard';
import { useData } from '@/contexts/DataContext';
import { AbhaVerificationModal } from '@/components/AbhaVerificationModal';
import { toast } from 'sonner';
import { checkAbhaLinked, saveAbhaProfile } from '@/utils/healthData';
import { useAuth } from '@/contexts/AuthContext';
import { useReports } from '@/contexts/ReportContext';
import { Pill, Thermometer, Heart, UploadCloud } from 'lucide-react';

const calculateAge = (dob: string | null | undefined): number | null => {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const formatHeightWeight = (height: any, weight: any) => {
  const heightValue = height?.value;
  const heightUnit = height?.unit || 'cm';
  const weightValue = weight?.value;
  const weightUnit = weight?.unit || 'kg';

  if (!heightValue && !weightValue) return '-';
  if (heightValue && weightValue) return `${heightValue} ${heightUnit} · ${weightValue} ${weightUnit}`;
  if (heightValue && !weightValue) return `${heightValue} ${heightUnit}`;
  if (!heightValue && weightValue) return `${weightValue} ${weightUnit}`;
  return '-';
};

const PRIMARY_VITALS = [
  'systolic blood pressure',
  'diastolic blood pressure',
  'heart rate',
  'pulse rate',
  'oxygen saturation',
  'spo2',
  'respiratory rate',
  'temperature',
  'body temperature',
  'blood glucose',
  'random blood sugar',
  'fasting blood sugar'
];

const PRIMARY_CHRONIC_CONDITIONS = [
  'hypertension',
  'essential primary hypertension',
  'diabetes',
  'type 2 diabetes mellitus',
  'type 1 diabetes mellitus',
  'chronic kidney disease',
  'ckd',
  'coronary artery disease',
  'ischemic heart disease',
  'angina pectoris',
  'asthma',
  'copd',
  'hypothyroidism',
  'hyperthyroidism',
  'dyslipidemia',
  'hyperlipidemia'
];

const normalizeClinicalName = (value: string) =>
  value.toLowerCase().replace(/[^a-z\s]/g, '').trim();

const Dashboard = () => {
  const { userProfile, refreshUserData } = useData();
  const { user, session } = useAuth();
  const { reports, loading: reportsLoading } = useReports();
  const [showAbhaModal, setShowAbhaModal] = useState(false);

  const derivedData = useMemo(() => {
    if (!reports || reports.length === 0) return null;

    const parameters: any[] = [];
    const conditions: any[] = [];
    const medications: any[] = [];
    let profile: any = null;

    // Use latest profile found (reports are sorted newest first)
    for (const r of reports) {
      if (r.report_json?.data?.profile) {
        profile = { ...r.report_json.data.profile };

        // AUTO-CALCULATE BMI if missing
        if (!profile.bmi && profile.height?.value && profile.weight?.value) {
          const heightM = profile.height.value / 100;
          profile.bmi = Number((profile.weight.value / (heightM * heightM)).toFixed(1));
        }
        break; // Stop at newest valid profile
      }
    }

    // Aggregated data from all reports
    reports.forEach((r) => {
      const data = r.report_json?.data;
      if (!data) return;

      if (Array.isArray(data.parameters)) {
        const normalizedParams = data.parameters.map((p: any, idx: number) => ({
          ...p,
          id: p.id || `param-${idx}-${r.id}`,
          status: p.status || 'normal',
          timestamp: p.timestamp || p.date || r.date || new Date().toISOString()
        }));

        // Filter for PRIMARY VITALS
        const primaryParams = normalizedParams.filter(p =>
          PRIMARY_VITALS.includes(normalizeClinicalName(p.name))
        );

        parameters.push(...primaryParams);
      }

      if (Array.isArray(data.conditions)) {
        // Filter for PRIMARY CHRONIC CONDITIONS
        const chronicOnly = data.conditions.filter((c: any) =>
          PRIMARY_CHRONIC_CONDITIONS.includes(normalizeClinicalName(c.name))
        );
        conditions.push(...chronicOnly);
      }

      if (Array.isArray(data.medications)) {
        medications.push(...data.medications);
      }
    });

    // Deduplicate parameters by name (keeping the newest one)
    const uniqueParametersMap = new Map<string, any>();
    parameters.forEach(p => {
      const key = normalizeClinicalName(p.name);
      if (!uniqueParametersMap.has(key)) {
        uniqueParametersMap.set(key, p);
      }
    });
    const uniqueParameters = Array.from(uniqueParametersMap.values());

    // Deduplicate conditions by name (keeping the newest one)
    const uniqueConditionsMap = new Map<string, any>();
    conditions.forEach(cond => {
      const key = normalizeClinicalName(cond.name);
      if (!uniqueConditionsMap.has(key)) {
        uniqueConditionsMap.set(key, {
          ...cond,
          currentStatus: cond.currentStatus || cond.status || 'N/A',
          diagnosedDate: cond.diagnosedDate || null
        });
      }
    });
    const uniqueConditions = Array.from(uniqueConditionsMap.values());

    return {
      profile,
      parameters: uniqueParameters,
      conditions: uniqueConditions,
      medications
    };
  }, [reports]);

  const headerMetrics = useMemo(() => {
    if (!derivedData?.profile) return null;

    const h = derivedData.profile.height?.value;
    const w = derivedData.profile.weight?.value;

    return {
      age: derivedData.profile.age ?? null,
      bloodType: derivedData.profile.bloodType ?? null,
      heightWeight: h && w ? `${h} cm / ${w} kg` : null,
      bmi: derivedData.profile.bmi ?? null
    };
  }, [derivedData]);

  const displayName = derivedData?.profile?.name ||
    [userProfile?.first_name, userProfile?.middle_name, userProfile?.last_name].filter(Boolean).join(' ') ||
    user?.email?.split('@')[0] ||
    'User';

  const displayAge = derivedData?.profile?.age ??
    calculateAge(userProfile?.dob) ??
    null;

  console.log('[Dashboard] 🎯 MOUNTED - User:', user?.email, '| Session:', !!session, '| Reports:', reports?.length, '| Loading:', reportsLoading);

  const handleLinkABHA = () => {
    setShowAbhaModal(true);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const checkAbhaStatus = async () => {
      if (user?.id) {
        const isLinked = await checkAbhaLinked(user.id);
        if (!isLinked) {
          setShowAbhaModal(true);
        }
      }
    };

    checkAbhaStatus();
  }, [user?.id]);

  if (reportsLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-medium">Loading your health dashboard...</p>
      </div>
    );
  }

  // FHIR patient fetching removed — no longer used in dashboard

  const handleAbhaSuccess = async (abhaProfile: any) => {
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      await saveAbhaProfile(user.id, abhaProfile);
      await refreshUserData();
      toast.success('ABHA profile linked successfully');
    } catch (error: any) {
      console.error('Error saving ABHA profile:', error);
      toast.error(error.message || 'Failed to save ABHA profile');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F6F9FF] to-white dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      <Navbar />



      <div className="w-full max-w-[1100px] mx-auto px-4 sm:px-6 space-y-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-2"
        >
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Health Dashboard</h1>
          {/* Subtitle removed for cleaner UI */}

          {/* ABHA Verification Modal */}
          <AbhaVerificationModal isOpen={showAbhaModal} onClose={() => setShowAbhaModal(false)} onSuccess={handleAbhaSuccess} />

          {/* Profile Section (compact horizontal card) */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 md:p-6 mb-5 transition-colors duration-300" id="profile">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">

              {/* Left: Avatar + basic info (compact) */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-semibold text-gray-700">{displayName.charAt(0)}</div>

                <div className="space-y-1">
                  <h2 className="text-xl font-semibold text-light-text dark:text-dark-text">{displayName}</h2>
                  <p className="text-sm text-light-subtext dark:text-dark-subtext">
                    {displayAge ? `${displayAge} years` : ''} {(derivedData?.profile?.gender || userProfile?.gender) ? `• ${derivedData?.profile?.gender || userProfile?.gender}` : ''}
                  </p>

                  {/* Allergy badges with proper medical styling */}
                  <div className="flex flex-wrap gap-2 mt-1">
                    {userProfile?.allergies?.map((a: any, i: number) => (
                      <span key={i} className="bg-red-100 text-red-700 border border-red-200 px-3 py-1 rounded-full text-xs flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {a} <span className="ml-1 text-[10px] opacity-75">(Allergy)</span>
                      </span>
                    ))}
                  </div>

                  <button onClick={handleLinkABHA} className="mt-1 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
                    Link ABHA
                  </button>
                </div>
              </div>

              {/* Right: compact stats on one row */}
              <div className="grid grid-cols-4 gap-6">
                {/* Height & Weight */}
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="text-light-subtext dark:text-dark-subtext text-xs mb-1">Height & Weight</div>
                  <div className="font-medium text-light-text dark:text-dark-text">
                    {headerMetrics?.heightWeight ?? '-'}
                  </div>
                </div>

                {/* Blood Type */}
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="text-light-subtext dark:text-dark-subtext text-xs mb-1">Blood Type</div>
                  <div className="font-medium text-light-text dark:text-dark-text">
                    {headerMetrics?.bloodType ?? '-'}
                  </div>
                </div>

                {/* Age */}
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="text-light-subtext dark:text-dark-subtext text-xs mb-1">Age</div>
                  <div className="font-medium text-light-text dark:text-dark-text">
                    {headerMetrics?.age ? `${headerMetrics.age} yrs` : '-'}
                  </div>
                </div>

                {/* BMI */}
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="text-light-subtext dark:text-dark-subtext text-xs mb-1">BMI</div>
                  <div className="font-medium text-light-text dark:text-dark-text">
                    {headerMetrics?.bmi ?? '-'}
                  </div>
                </div>
              </div>

            </div>
          </motion.div>

          {/* Current Medications */}
          {derivedData?.medications && derivedData.medications.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-cardBorder p-4 md:p-6 mb-5 transition-colors duration-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-light-text dark:text-dark-text">Current Medications</h2>
                <div className="flex items-center gap-2 text-sm text-light-subtext dark:text-dark-subtext"><Pill className="w-4 h-4 text-blue-500 dark:text-blue-400" /> {derivedData.medications.length} items</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {derivedData.medications.map((med: any, index: number) => (
                  <div key={index} className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 dark:border-dark-cardBorder bg-white dark:bg-dark-card">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                      <Pill className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-light-text dark:text-dark-text truncate">{med.name}</div>
                      <div className="text-sm text-light-subtext dark:text-dark-subtext truncate">{med.dosage} • {med.frequency}</div>
                    </div>
                    <div className="text-sm text-light-subtext dark:text-dark-subtext whitespace-nowrap">{med.startDate ? `Since ${new Date(med.startDate).toLocaleDateString('en-IN')}` : ''}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Health Parameters Section */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-cardBorder p-4 md:p-6 mb-5 transition-colors duration-300">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-light-text dark:text-dark-text">Main Health Vitals</h2>
                <p className="text-sm text-gray-500 mt-0.5">Daily vitals tracked for your health monitoring</p>
              </div>
              <div className="flex items-center gap-3 text-sm text-light-subtext dark:text-dark-subtext">
                <Thermometer className="w-4 h-4 text-red-400 dark:text-red-300" />
                <Heart className="w-4 h-4 text-pink-400 dark:text-pink-300" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {derivedData?.parameters && derivedData.parameters.length > 0 ? (
                derivedData.parameters.map((param, idx) => (
                  <div key={param.id || idx} className="flex flex-col justify-between h-40">
                    <HealthCard parameter={param} />
                  </div>
                ))
              ) : (
                <div className="col-span-full py-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                  <p className="text-light-subtext dark:text-dark-subtext">No health parameters recorded.</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Chronic Conditions Section */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }} className="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-100 dark:border-dark-cardBorder p-4 md:p-6 mb-5 transition-colors duration-300">
            <h2 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">Chronic Conditions</h2>
            <div className="max-w-md">
              <div className="space-y-4">
                {derivedData?.conditions && derivedData.conditions.length > 0 ? (
                  derivedData.conditions.map((cond: any, idx: number) => {
                    const severity = cond.severity as string | undefined;
                    const badgeLabel = severity || cond.currentStatus || 'unknown';
                    const badgeClass = severity === 'severe'
                      ? 'bg-red-100 text-red-600'
                      : severity === 'moderate'
                        ? 'bg-yellow-100 text-yellow-600'
                        : severity === 'mild'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-600';

                    const statusLabel = cond.currentStatus || cond.status || null;

                    return (
                      <div key={cond.id || cond.name || idx} className="glass-card p-4 md:p-5">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{cond.name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-sm ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                        </div>

                        <div className="text-sm text-light-subtext dark:text-dark-subtext mb-2">
                          <span className="font-medium">Diagnosed:</span>{' '}
                          {cond.diagnosedDate ? new Date(cond.diagnosedDate).toLocaleDateString('en-IN') : 'Unknown'}
                        </div>
                        <div className="text-sm text-light-text dark:text-dark-text mb-2">
                          <span className="font-medium">Current Status:</span>{' '}
                          <span className={`${statusLabel === 'controlled' ? 'text-green-600 dark:text-green-400' : statusLabel === 'worsening' ? 'text-red-600 dark:text-red-400' : 'text-light-text dark:text-dark-text'}`}>{cond.currentStatus || 'N/A'}</span>
                        </div>

                        {Array.isArray(cond.relatedParameters) && cond.relatedParameters.length > 0 && (
                          <div className="mt-2">
                            <div className="text-sm font-medium text-light-text dark:text-dark-text mb-1">Related Parameters:</div>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {cond.relatedParameters.map((p: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{p}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {cond.notes && (
                          <div className="mt-3 text-sm text-light-subtext dark:text-dark-subtext">{cond.notes}</div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-light-subtext dark:text-dark-subtext">No chronic conditions recorded.</div>
                )}
              </div>
            </div>
          </motion.div>

          {/* FHIR Patient Records removed from UI */}

          {/* Health Upload Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-4 mb-4 max-w-3xl mx-auto"
          >
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-xl shadow-sm border border-blue-100 dark:border-gray-600 p-6 transition-colors duration-300">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Upload Health Reports</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Upload your medical reports for AI-powered analysis
                  </p>
                </div>
                <UploadCloud className="w-12 h-12 text-blue-500 dark:text-blue-400" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Drag & Drop Upload
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Camera Capture
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  AI Parsing
                </div>
              </div>

              <a
                href="/patient/upload-reports"
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
              >
                <UploadCloud className="w-5 h-5 mr-2" />
                Go to Upload Page
              </a>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Voice Command floating at the bottom right, matching Timeline page */}
      <div className="fixed bottom-6 right-6 z-50 shadow-lg">
        <VoiceCommand />
      </div>
    </div>
  );
};

export default Dashboard;