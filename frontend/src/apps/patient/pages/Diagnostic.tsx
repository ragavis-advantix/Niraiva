import React, { useEffect, useState } from 'react';
import type { SVGProps } from 'react';
import { motion } from 'framer-motion';
import { Activity, Info, FileText } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { DiagnosticMap } from '@/components/DiagnosticMap';
import { ReportUploader } from '@/components/ReportUploader';
import { VoiceCommand } from '@/components/VoiceCommand';
import { useReports } from '@/contexts/ReportContext';
import {
  HealthParameter,
  DiagnosticNode
} from '@/utils/healthData';
import { ChronicCondition } from '@/utils/healthData';
import { useData } from '@/contexts/DataContext';
import { getApiBaseUrl } from '@/lib/fhir';
import { useAuth } from '@/contexts/AuthContext';
import { TrendChart } from '@/components/TrendChart';
import { supabase } from '@/lib/supabase';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Diagnostic page error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <button onClick={() => this.setState({ hasError: false })} className="btn">Try again</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const Diagnostic = () => {
  const { chronicConditions, userProfile } = useData();
  const { reports } = useReports();
  const { user, session } = useAuth();
  console.log('📱 [Diagnostic] Component render - reports:', reports.length, 'sample:', reports[0]?.name);

  const [userSpecificNodes, setUserSpecificNodes] = useState<any[]>([]);
  const [clinicalSummary, setClinicalSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  console.log('Chronic conditions:', chronicConditions);

  const [selectedCondition, setSelectedCondition] = useState<ChronicCondition | null>(() => chronicConditions?.[0] ?? null);

  // Reset page position on load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Update selected condition when conditions change
  useEffect(() => {
    if (chronicConditions && chronicConditions.length > 0) {
      // If current selection isn't in the list anymore, select the first condition
      if (!chronicConditions.find(c => c.id === selectedCondition?.id)) {
        setSelectedCondition(chronicConditions[0]);
      }
    }
  }, [chronicConditions, selectedCondition]);

  // Generate user-specific diagnostic nodes from REAL uploaded reports
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`⏰ [Diagnostic] Effect triggered at ${timestamp} - reports:`, reports.length, reports.map((r: any) => r.name).slice(0, 2));

    if (reports.length === 0) {
      console.log('⚠️ [Diagnostic] No reports, clearing nodes');
      setUserSpecificNodes([]);
      return;
    }

    try {
      console.log('📊 [Diagnostic] Starting to build nodes from reports:', reports.length);

      const parameters: Map<string, any> = new Map();
      const conditions: Map<string, any> = new Map();
      const medications: Map<string, any> = new Map();

      // Process all reports and aggregate real clinical data
      reports.forEach((report: any, idx: number) => {
        // Handle both parsedData and report_json structures
        const reportData = report.parsedData?.data || report.report_json?.data || {};

        console.log(`📄 [Diagnostic] Processing report ${idx + 1}:`, {
          filename: report.name || report.filename,
          hasData: !!reportData,
          params: reportData.parameters?.length || 0,
          conditions: reportData.conditions?.length || 0,
          meds: reportData.medications?.length || 0
        });

        // Extract parameters from report
        if (Array.isArray(reportData.parameters)) {
          reportData.parameters.forEach((param: any) => {
            const key = (param.name || param.test || '').trim();
            if (key && !parameters.has(key)) {
              parameters.set(key, {
                id: `param-${key}`,
                name: key,
                value: param.value ?? 0,
                unit: param.unit || '',
                status: param.status || 'normal'
              });
            }
          });
        }

        // Extract conditions from report
        if (Array.isArray(reportData.conditions)) {
          reportData.conditions.forEach((cond: any) => {
            const key = (cond.name || cond.diagnosis || '').trim();
            if (key && !conditions.has(key)) {
              conditions.set(key, {
                id: `cond-${key}`,
                name: key,
                severity: cond.severity || cond.currentStatus || 'moderate'
              });
            }
          });
        }

        // Extract medications from report
        if (Array.isArray(reportData.medications)) {
          reportData.medications.forEach((med: any) => {
            const key = (med.name || '').trim();
            if (key && !medications.has(key)) {
              medications.set(key, {
                id: `med-${key}`,
                name: key,
                dose: med.dosage || med.dose || 'As prescribed',
                frequency: med.frequency || ''
              });
            }
          });
        }
      });

      console.log('📊 [Diagnostic] Aggregated data:', {
        uniqueConditions: conditions.size,
        uniqueParameters: parameters.size,
        uniqueMedications: medications.size
      });

      const nodes: DiagnosticNode[] = [];

      // Create nodes from aggregated real data - prioritize conditions first
      if (conditions.size > 0) {
        nodes.push({
          id: 'chronic-conditions',
          name: 'Chronic Conditions',
          value: conditions.size,
          unit: 'conditions',
          children: Array.from(conditions.values()).map(cond => ({
            id: cond.id,
            name: cond.name,
            value: cond.severity
          }))
        });
      }

      if (parameters.size > 0) {
        nodes.push({
          id: 'health-parameters',
          name: 'Health Parameters',
          value: parameters.size,
          unit: 'items',
          children: Array.from(parameters.values()).map(param => ({
            id: param.id,
            name: param.name,
            value: param.value,
            unit: param.unit
          }))
        });
      }

      if (medications.size > 0) {
        nodes.push({
          id: 'active-medications',
          name: 'Active Medications',
          value: medications.size,
          unit: 'medications',
          children: Array.from(medications.values()).map(med => ({
            id: med.id,
            name: med.name,
            value: med.dose
          }))
        });
      }

      // Add source reports info if we have extracted data
      if (nodes.length > 0) {
        nodes.push({
          id: 'source-reports',
          name: 'Source Reports',
          value: reports.length,
          unit: 'files uploaded'
        });
      }

      console.log('✅ [Diagnostic] Final nodes:', nodes.length, {
        conditions: nodes.find(n => n.id === 'chronic-conditions')?.children?.length || 0,
        parameters: nodes.find(n => n.id === 'health-parameters')?.children?.length || 0,
        medications: nodes.find(n => n.id === 'active-medications')?.children?.length || 0
      });

      setUserSpecificNodes(nodes);
      console.log('✅ [Diagnostic] Nodes set to state - will now be rendered in DiagnosticMap');
    } catch (error) {
      console.error('❌ [Diagnostic] Error building nodes:', error);
      setUserSpecificNodes([]);
    }
  }, [reports]);
  // Fetch clinical summary from health reports
  useEffect(() => {
    if (!user?.id) return;

    const fetchClinicalSummary = async () => {
      try {
        setLoadingSummary(true);
        const apiBase = getApiBaseUrl();
        const response = await fetch(`${apiBase}/api/diagnostic-pathway/${user.id}/summary`, {
          headers: {
            'Authorization': `Bearer ${session?.access_token || ''}`,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch clinical summary: ${response.status}`);
        }

        const result = await response.json();
        setClinicalSummary(result);
        console.log('📋 Clinical summary loaded:', result);
      } catch (err) {
        console.error('Error fetching clinical summary:', err);
      } finally {
        setLoadingSummary(false);
      }
    };

    // Initial fetch
    fetchClinicalSummary();

    // Poll for updates every 30 seconds when reports are present
    const pollInterval = setInterval(fetchClinicalSummary, 30000);

    return () => clearInterval(pollInterval);
  }, [user?.id, session?.access_token, reports.length]);

  // Removed: The old fetchPathway API effect that was overwriting userSpecificNodes
  // Now we display nodes built directly from reports (see the useEffect above)
  // This ensures we show real uploaded data, not template pathways

  if ((!chronicConditions || chronicConditions.length === 0) && reports.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">No Clinical Data</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">No chronic conditions or uploaded reports found.</p>
          <p className="text-sm text-gray-500">Upload health reports to see your diagnostic pathway.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <Navbar />

      {/* Voice Command fixed to bottom right corner */}
      <div className="fixed bottom-6 right-6 z-50">
        <VoiceCommand />
      </div>
      <div className="container mx-auto px-2 pt-20 pb-8 max-w-6xl">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-4"
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Diagnostic Pathway</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Interactive visualization of your clinical history and treatment progression
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="md:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="glass-panel p-3 h-full"
              id="pathway"
            >
              <div className="flex flex-wrap items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Condition Pathway</h2>

                <div className="flex flex-wrap mt-2 sm:mt-0">
                  {chronicConditions && chronicConditions.length > 0 ? (
                    chronicConditions.map((condition) => (
                      <button
                        key={condition.id}
                        onClick={() => setSelectedCondition(condition)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors mr-1.5 mb-1.5 sm:mb-0 ${selectedCondition?.id === condition.id
                          ? 'bg-niraiva-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        id={`condition-${condition.id}`}
                      >
                        {condition.name}
                      </button>
                    ))
                  ) : (
                    // Show conditions extracted from reports if no chronicConditions
                    userSpecificNodes
                      .filter((n) => n.id === 'chronic-conditions')
                      .flatMap((n) => n.children || [])
                      .map((cond, idx) => (
                        <span
                          key={`cond-${idx}`}
                          className="px-3 py-1 rounded-full text-xs font-medium bg-niraiva-100 dark:bg-niraiva-900/30 text-niraiva-700 dark:text-niraiva-300 mr-1.5 mb-1.5 sm:mb-0"
                        >
                          {cond.name}
                        </span>
                      ))
                  )}
                </div>
              </div>

              <div className="mb-2 glass-card p-2 flex items-start text-xs">
                <Info className="h-4 w-4 text-niraiva-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-0.5 text-xs">About this view</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-tight">
                    Pathway diagram for {selectedCondition?.name || 'clinical data'}. Zoom with scroll/pinch, drag to pan, click nodes for details.
                  </p>
                </div>
              </div>

              {reports.length > 0 && (
                <div className="mb-2 glass-card p-2 flex items-start bg-niraiva-50 dark:bg-niraiva-900/10 text-xs">
                  <FileText className="h-4 w-4 text-niraiva-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-0.5 text-xs">Reports</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-tight">
                      Visualization enhanced with {reports.length} uploaded report(s).
                    </p>
                  </div>
                </div>
              )}

              {userSpecificNodes.length === 0 && reports.length > 0 && (
                <div className="p-8 text-center border-2 border-dashed border-red-400 bg-red-50 rounded-lg">
                  <p className="text-red-700 font-bold">❌ ERROR: Nodes not being built from reports!</p>
                  <p className="text-sm text-red-600 mt-2">Reports available: {reports.length}, but userSpecificNodes is empty</p>
                  <p className="text-xs text-red-500 mt-1">Check console logs for "[Diagnostic]" messages</p>
                </div>
              )}

              {console.log('🎨 [Diagnostic] Rendering DiagnosticMap with nodes:', userSpecificNodes.length, userSpecificNodes.map(n => n.id))}
              <DiagnosticMap nodes={userSpecificNodes} className="mt-3" />
            </motion.div>
          </div>

          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-3"
            >
              <ReportUploader />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="glass-panel p-4"
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Summary</h2>

              <div className="mb-2">
                <div className="flex justify-between mb-1 text-xs">
                  <span className="text-gray-600 dark:text-gray-300">ABHA ID</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {userProfile?.abha_number || 'Not set'}
                  </span>
                </div>

                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 dark:text-gray-300">Allergies</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {userProfile?.allergies?.length || 0} known
                  </span>
                </div>

                <div className="flex justify-between mb-1 text-xs">
                  <span className="text-gray-600 dark:text-gray-300">Diagnosis Date</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {selectedCondition?.diagnosedDate ? new Date(selectedCondition.diagnosedDate).toLocaleDateString('en-IN') : 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-300">Current Severity</span>
                  <span className={`font-medium ${selectedCondition?.severity === 'mild' ? 'text-health-good' :
                    selectedCondition?.severity === 'moderate' ? 'text-health-moderate' :
                      'text-health-poor'
                    }`}>
                    {selectedCondition?.severity
                      ? selectedCondition.severity.charAt(0).toUpperCase() + selectedCondition.severity.slice(1)
                      : 'Unknown'}
                  </span>
                </div>

                <div className="flex justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-300">Status</span>
                  <span className={`font-medium ${selectedCondition?.currentStatus === 'controlled' ? 'text-health-good' :
                    selectedCondition?.currentStatus === 'improving' ? 'text-health-moderate' :
                      'text-health-poor'
                    }`}>
                    {selectedCondition?.currentStatus
                      ? selectedCondition.currentStatus.charAt(0).toUpperCase() + selectedCondition.currentStatus.slice(1)
                      : 'Unknown'}
                  </span>
                </div>
              </div>

              {clinicalSummary?.medications && clinicalSummary.medications.length > 0 && (
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg" id="treatment">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">Current Treatment</h3>
                  <div className="space-y-2">
                    {clinicalSummary.medications.map((med: any, idx: number) => (
                      <p key={idx} className="text-gray-600 dark:text-gray-300 text-sm">
                        <span className="font-medium">{med.name}</span>
                        {med.dosage && ` ${med.dosage}`}
                        {med.frequency && ` - ${med.frequency}`}
                      </p>
                    ))}
                    {clinicalSummary.treatments && clinicalSummary.treatments.length > 0 && (
                      <p className="text-gray-600 dark:text-gray-300 text-sm border-t pt-2 mt-2">
                        {clinicalSummary.treatments[0]}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div id="clinical-notes">
                {(clinicalSummary?.parameters?.length > 0 || clinicalSummary?.conditions?.length > 0) && (
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3">Clinical Data from Reports</h3>
                )}

                <div className="space-y-3">
                  {/* Parameters from reports */}
                  {clinicalSummary?.parameters && clinicalSummary.parameters.length > 0 && (
                    <div className="p-3 bg-niraiva-50 dark:bg-niraiva-900/10 rounded-lg border border-niraiva-100 dark:border-niraiva-900/20">
                      <div className="flex items-start">
                        <Activity className="h-5 w-5 text-niraiva-600 mr-2 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm">Health Parameters</h4>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {clinicalSummary.parameters.slice(0, 4).map((param: any, idx: number) => (
                              <div key={idx} className="text-xs">
                                <span className="text-gray-600 dark:text-gray-300">{param.name || param.parameter_name}:</span>
                                <span className="font-medium text-gray-900 dark:text-white ml-1">
                                  {param.value} {param.unit || ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Conditions from reports */}
                  {clinicalSummary?.conditions && clinicalSummary.conditions.length > 0 && (
                    <div className="p-3 bg-niraiva-50 dark:bg-niraiva-900/10 rounded-lg border border-niraiva-100 dark:border-niraiva-900/20">
                      <div className="flex items-start">
                        <Activity className="h-5 w-5 text-niraiva-600 mr-2 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm">Conditions from Records</h4>
                          <div className="mt-1 space-y-1">
                            {clinicalSummary.conditions.map((cond: any, idx: number) => (
                              <p key={idx} className="text-xs text-gray-600 dark:text-gray-300">
                                • {cond.name}
                                {cond.severity && ` (${cond.severity})`}
                                {cond.currentStatus && ` - ${cond.currentStatus}`}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Data from uploaded reports */}
                  {reports.length > 0 ? (
                    <div className="p-3 bg-niraiva-50 dark:bg-niraiva-900/10 rounded-lg border border-niraiva-100 dark:border-niraiva-900/20">
                      <div className="flex items-start">
                        <FileText className="h-5 w-5 text-niraiva-600 mr-2 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm">Latest Uploads</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                            {reports.length} report(s) uploaded. Last updated: {clinicalSummary?.lastUpdated ? new Date(clinicalSummary.lastUpdated).toLocaleDateString('en-IN') : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-niraiva-50 dark:bg-niraiva-900/10 rounded-lg border border-niraiva-100 dark:border-niraiva-900/20">
                      <div className="flex items-start">
                        <FileText className="h-5 w-5 text-niraiva-600 mr-2 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm">Upload Health Reports</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                            No reports uploaded yet. Upload health reports to see clinical data extracted from your medical records.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {reports.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="glass-panel p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Health Parameter Trends</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {clinicalSummary?.parameterTrends ? (
                  Object.entries(clinicalSummary.parameterTrends).map(([name, trend]: [string, any]) => {
                    const latest = trend[trend.length - 1];
                    const chartColor = name.toLowerCase().includes('bp') || name.toLowerCase().includes('pressure') ? '#F97316' :
                      name.toLowerCase().includes('glucose') || name.toLowerCase().includes('sugar') ? '#10B981' :
                        name.toLowerCase().includes('ldl') || name.toLowerCase().includes('cholesterol') ? '#8B5CF6' : '#0EA5E9';

                    return (
                      <div key={name} className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                        <TrendChart
                          label={name.toUpperCase()}
                          data={trend}
                          unit={latest.unit || ''}
                          color={chartColor}
                        />
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-2 py-12 text-center text-slate-400">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No historical trends available yet. Upload more reports to see progress over time.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

const DiagnosticWithErrorBoundary = () => (
  <ErrorBoundary>
    <Diagnostic />
  </ErrorBoundary>
);

export default DiagnosticWithErrorBoundary;
