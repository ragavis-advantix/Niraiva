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
  generateUserSpecificNodes,
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
  const [userSpecificNodes, setUserSpecificNodes] = useState<any[]>([]);
  const [clinicalSummary, setClinicalSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [pathwayData, setPathwayData] = useState<{ nodes: any[], edges: any[] }>({ nodes: [], edges: [] });
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

  // Generate user-specific diagnostic nodes when user profile or reports change
  useEffect(() => {
    if (!userProfile?.user_id) return;

    const loadNodes = async () => {
      try {
        // Generate base nodes
        const nodes = await generateUserSpecificNodes(userProfile.user_id);

        if (reports.length > 0) {
          // If we have reports, enhance the nodes with report data
          const enhancedNodes = nodes.map((node: DiagnosticNode) => {
            // Add report info as a child node
            const reportNode: DiagnosticNode = {
              id: `report-${Date.now()}`,
              name: "Source Reports",
              value: reports.length,
              unit: "files"
            };

            return {
              ...node,
              children: [...(node.children || []), reportNode],
              value: reports.length > 2 ? reports.length : node.value
            };
          });

          setUserSpecificNodes(enhancedNodes);
        } else {
          setUserSpecificNodes(nodes);
        }
      } catch (error) {
        console.error('Error loading diagnostic nodes:', error);
      }
    };

    loadNodes();
  }, [userProfile?.user_id, reports, selectedCondition]);

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

  // NEW: Fetch Real Pathway Graph
  useEffect(() => {
    if (!user?.id) return;

    const fetchPathway = async () => {
      try {
        const apiBase = getApiBaseUrl();
        const response = await fetch(`${apiBase}/api/diagnostic-pathway/${user.id}?conditionFilter=${selectedCondition.name}`, {
          headers: {
            'Authorization': `Bearer ${session?.access_token || ''}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          let adaptedNodes = [];

          if (data.isGuideline) {
            // Guideline nodes use 'steps' logic
            adaptedNodes = data.nodes.map((n: any, idx: number) => ({
              id: n.id,
              name: n.data.label,
              title: n.data.label,
              type: n.data.type,
              status: n.data.status,
              description: n.data.description,
              // Use vertical grid for guideline
              x: 0,
              y: idx,
              connections: data.edges
                .filter((e: any) => e.source === n.id)
                .map((e: any) => e.target)
            }));
          } else {
            // Raw events
            adaptedNodes = data.nodes.map((n: any, idx: number) => ({
              id: n.id,
              name: n.data.label,
              title: n.data.label,
              type: n.data.type,
              date: n.data.date,
              description: n.data.metadata?.notes || n.data.type,
              x: idx,
              y: n.data.type === 'test' ? 1 : 0,
              connections: data.edges
                .filter((e: any) => e.source === n.id)
                .map((e: any) => e.target)
            }));
          }
          setPathwayData(data);
          setUserSpecificNodes(adaptedNodes);
        }
      } catch (err) {
        console.error('Error fetching pathway:', err);
      }
    };

    fetchPathway();
  }, [user?.id, session?.access_token, reports.length, selectedCondition?.id]);

  if (!chronicConditions || chronicConditions.length === 0 || !selectedCondition) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">No Conditions</h1>
          <p className="text-gray-600 dark:text-gray-300">No chronic conditions have been added yet.</p>
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
                  {chronicConditions.map((condition) => (
                    <button
                      key={condition.id}
                      onClick={() => setSelectedCondition(condition)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors mr-1.5 mb-1.5 sm:mb-0 ${selectedCondition.id === condition.id
                        ? 'bg-niraiva-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      id={`condition-${condition.id}`}
                    >
                      {condition.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-2 glass-card p-2 flex items-start text-xs">
                <Info className="h-4 w-4 text-niraiva-500 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-0.5 text-xs">About this view</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-tight">
                    Pathway diagram for {selectedCondition.name}. Zoom with scroll/pinch, drag to pan, click nodes for details.
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
                    {new Date(selectedCondition.diagnosedDate).toLocaleDateString('en-IN')}
                  </span>
                </div>

                <div className="flex justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-300">Current Severity</span>
                  <span className={`font-medium ${selectedCondition.severity === 'mild' ? 'text-health-good' :
                    selectedCondition.severity === 'moderate' ? 'text-health-moderate' :
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
