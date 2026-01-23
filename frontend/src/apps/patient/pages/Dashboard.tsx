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
  'blood pressure',
  'systolic blood pressure',
  'diastolic blood pressure',
  'heart rate',
  'pulse rate',
  'pulse',
  'oxygen saturation',
  'spo2',
  'respiratory rate',
  'temperature',
  'body temperature',
  'blood glucose',
  'blood sugar',
  'random blood sugar',
  'fasting blood sugar',
  'weight',
  'height',
  'bmi'
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
  const { userProfile, refreshUserData, healthSnapshot, applyUpdate } = useData();
  const { user, session } = useAuth();
  const { reports, loading: reportsLoading } = useReports();
  const [showAbhaModal, setShowAbhaModal] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  useEffect(() => {
    if (userProfile?.full_name || userProfile?.first_name) {
      setEditedName(userProfile.full_name || [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ') || '');
    }
  }, [userProfile]);

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      setIsEditingName(false);
      return;
    }
    try {
      await applyUpdate({
        op: 'update',
        section: 'profile',
        key: 'full_name',
        value: editedName.trim()
      });
      setIsEditingName(false);
      toast.success('Name updated');
    } catch (err) {
      toast.error('Failed to update name');
    }
  };

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

    // Aggregated parameters and conditions from all reports
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

        const primaryParams = normalizedParams.filter(p =>
          PRIMARY_VITALS.includes(normalizeClinicalName(p.name))
        );

        parameters.push(...primaryParams);
      }

      if (Array.isArray(data.conditions)) {
        // Relaxing the filtering — if the AI says it's a condition, show it.
        const normalizedConditions = data.conditions.map((c: any) => {
          const name = typeof c === 'string' ? c : (c.name || c.condition);
          return typeof c === 'object' ? { ...c, name } : { name };
        }).filter((c: any) => !!c.name);

        conditions.push(...normalizedConditions);
      }
    });

    // MEDICATIONS: Select ONLY from the latest report that has a medication list
    // Reports are already sorted newest first by the context
    let rawMedications: any[] = [];
    for (const r of reports) {
      const meds = r.report_json?.data?.medications;
      if (Array.isArray(meds) && meds.length > 0) {
        rawMedications = meds
          .map((m: any, idx: number) => ({
            ...m,
            id: m.id || `med-${normalizeClinicalName(m.name || 'unnamed')}-${idx}`,
            name: (m.name || m.medication_name || m.drug_name || '')?.trim() || null,
            dosage: (m.dosage || m.dose || m.strength || '')?.trim() || null,
            frequency: (m.frequency || m.freq || '')?.trim() || null,
            startDate: m.startDate || m.start_date || r.uploaded_at || r.date
          }))
          .filter((m: any) => m.name && m.name !== '.' && m.name.length > 1); // Filter out invalid entries
        break; // ⛔ STOP at latest valid medication list
      }
    }

    // --- INTEGRATE HEALTH SNAPSHOT (Consolidated Truth) ---
    const snapshotParameters: any[] = [];
    if (healthSnapshot) {
      const {
        systolic_bp, diastolic_bp, heart_rate, spo2, temperature,
        hba1c, ldl, vitamin_b12, last_updated
      } = healthSnapshot;

      if (systolic_bp && diastolic_bp) {
        snapshotParameters.push({
          id: 'snap-bp',
          name: 'Blood Pressure',
          value: `${systolic_bp}/${diastolic_bp}`,
          unit: 'mmHg',
          status: (systolic_bp > 140 || diastolic_bp > 90) ? 'warning' : 'normal',
          timestamp: last_updated
        });
      }

      if (heart_rate) {
        snapshotParameters.push({
          id: 'snap-hr',
          name: 'Pulse',
          value: heart_rate,
          unit: 'bpm',
          status: (heart_rate > 100 || heart_rate < 60) ? 'warning' : 'normal',
          timestamp: last_updated
        });
      }

      if (spo2) {
        snapshotParameters.push({
          id: 'snap-spo2',
          name: 'Oxygen Saturation',
          value: spo2,
          unit: '%',
          status: spo2 < 95 ? 'warning' : 'normal',
          timestamp: last_updated
        });
      }

      if (temperature) {
        snapshotParameters.push({
          id: 'snap-temp',
          name: 'Temperature',
          value: temperature,
          unit: '°C',
          status: temperature > 37.5 ? 'warning' : 'normal',
          timestamp: last_updated
        });
      }

      if (hba1c) {
        snapshotParameters.push({
          id: 'snap-hba1c',
          name: 'HbA1c',
          value: hba1c,
          unit: '%',
          status: hba1c > 6.5 ? 'warning' : 'normal',
          timestamp: last_updated
        });
      }

      if (ldl) {
        snapshotParameters.push({
          id: 'snap-ldl',
          name: 'LDL Cholesterol',
          value: ldl,
          unit: 'mg/dL',
          status: ldl > 130 ? 'warning' : 'normal',
          timestamp: last_updated
        });
      }
    }

    // Deduplicate parameters (Snapshot takes priority, then newest report)
    const uniqueParametersMap = new Map<string, any>();

    // 1. Add snapshot params first
    snapshotParameters.forEach(p => uniqueParametersMap.set(normalizeClinicalName(p.name), p));

    // 2. Add report params if not already set by snapshot
    parameters.forEach(p => {
      const key = normalizeClinicalName(p.name);
      if (!uniqueParametersMap.has(key)) {
        uniqueParametersMap.set(key, p);
      }
    });

    const uniqueParameters = Array.from(uniqueParametersMap.values());

    // Deduplicate medications (final safety check)
    const uniqueMedMap = new Map<string, any>();
    rawMedications.forEach(med => {
      const key = normalizeClinicalName(med.name || 'unnamed');
      if (!uniqueMedMap.has(key)) {
        uniqueMedMap.set(key, med);
      }
    });
    const uniqueMedications = Array.from(uniqueMedMap.values());

    // --- CHRONIC CONDITIONS (Snapshot priority) ---
    const finalConditions = healthSnapshot?.chronic_conditions?.length
      ? healthSnapshot.chronic_conditions.map((name: string, idx: number) => ({
        id: `snap-cond-${idx}`,
        name,
        currentStatus: 'controlled',
        diagnosedDate: null
      }))
      : Array.from(new Map(conditions.map(c => [normalizeClinicalName(c.name), c])).values());

    return {
      profile,
      parameters: uniqueParameters,
      conditions: finalConditions,
      medications: uniqueMedications
    };
  }, [reports, healthSnapshot, normalizeClinicalName]);

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

  const displayName = editedName ||
    userProfile?.full_name ||
    [userProfile?.first_name, userProfile?.middle_name, userProfile?.last_name].filter(Boolean).join(' ') ||
    user?.email?.split('@')[0] ||
    'User';

  const displayAge = healthSnapshot?.age ||
    userProfile?.age ||
    calculateAge(userProfile?.dob) ||
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
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onBlur={handleSaveName}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                        autoFocus
                        className="text-xl font-semibold bg-white dark:bg-gray-700 border-b-2 border-blue-500 focus:outline-none px-1 rounded shadow-sm"
                      />
                      <button onClick={handleSaveName} className="text-blue-500 hover:text-blue-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <h2
                      className="text-xl font-semibold text-light-text dark:text-dark-text cursor-pointer hover:text-blue-500 group flex items-center gap-2"
                      onClick={() => setIsEditingName(true)}
                    >
                      {displayName}
                      <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </h2>
                  )}
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
                {derivedData.medications.map((med: any, index: number) => {
                  const daysAgo = med.startDate
                    ? Math.floor((Date.now() - new Date(med.startDate).getTime()) / (1000 * 60 * 60 * 24))
                    : null;

                  return (
                    <div key={med.id || index} className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 dark:border-dark-cardBorder bg-white dark:bg-dark-card">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                        <Pill className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-light-text dark:text-dark-text truncate">{med.name}</div>
                          {daysAgo !== null && daysAgo <= 7 && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider">New</span>
                          )}
                        </div>
                        <div className="text-sm text-light-subtext dark:text-dark-subtext truncate">{med.dosage} • {med.frequency}</div>
                      </div>
                      <div className="text-sm text-light-subtext dark:text-dark-subtext whitespace-nowrap">{med.startDate ? `Since ${new Date(med.startDate).toLocaleDateString('en-IN')}` : ''}</div>
                    </div>
                  );
                })}
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
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2 text-light-text dark:text-dark-text">Chronic Conditions</h2>
              <p className="text-sm text-light-subtext dark:text-dark-subtext">Ongoing medical conditions requiring management</p>
            </div>

            {/* Main Conditions Grid */}
            {derivedData?.conditions && derivedData.conditions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {derivedData.conditions.slice(0, 6).map((cond: any, idx: number) => {
                  const severity = (cond.severity as string | undefined)?.toLowerCase() || 'mild';
                  const isSevere = severity === 'severe';
                  const isModerate = severity === 'moderate';
                  const statusLabel = cond.currentStatus || cond.status || 'Unknown';
                  const isControlled = statusLabel.toLowerCase().includes('controlled');
                  const isWorsening = statusLabel.toLowerCase().includes('worsening');

                  const severityColor = isSevere
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : isModerate
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';

                  const statusColor = isControlled
                    ? 'text-green-600 dark:text-green-400'
                    : isWorsening
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400';

                  return (
                    <div
                      key={cond.id || cond.name || idx}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      {/* Header: Name + Severity Badge */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="font-semibold text-gray-900 dark:text-white flex-1 leading-tight">
                          {cond.name}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 ${severityColor}`}>
                          {severity.charAt(0).toUpperCase() + severity.slice(1)}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="mb-3">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</div>
                        <div className={`text-sm font-medium ${statusColor}`}>
                          {statusLabel}
                        </div>
                      </div>

                      {/* Related Parameters (if any) */}
                      {Array.isArray(cond.relatedParameters) && cond.relatedParameters.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Tracked Parameters</div>
                          <div className="flex flex-wrap gap-1">
                            {cond.relatedParameters.slice(0, 2).map((p: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded text-xs"
                              >
                                {p}
                              </span>
                            ))}
                            {cond.relatedParameters.length > 2 && (
                              <span className="px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                                +{cond.relatedParameters.length - 2} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Diagnosed Date */}
                      {cond.diagnosedDate && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
                          Since{' '}
                          {new Date(cond.diagnosedDate).toLocaleDateString('en-IN', {
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                <p className="text-light-subtext dark:text-dark-subtext">No chronic conditions recorded yet.</p>
              </div>
            )}

            {/* Secondary Findings Collapsible Section */}
            {derivedData?.conditions && derivedData.conditions.length > 6 && (
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <details className="cursor-pointer">
                  <summary className="font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                    {derivedData.conditions.length - 6} Additional Clinical Findings
                  </summary>
                  <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    {derivedData.conditions.slice(6).map((cond: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <span className="text-gray-400 mt-0.5">•</span>
                        <div className="flex-1">
                          <div className="font-medium text-gray-700 dark:text-gray-300">{cond.name}</div>
                          {cond.diagnosedDate && (
                            <div className="text-xs text-gray-500 dark:text-gray-500">
                              {new Date(cond.diagnosedDate).toLocaleDateString('en-IN')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
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