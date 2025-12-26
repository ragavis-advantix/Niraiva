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
  const [userSpecificNodes, setUserSpecificNodes] = useState<DiagnosticNode[]>([]);
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
      <div className="container mx-auto px-4 pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Diagnostic Pathway</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Interactive visualization of treatment and diagnostic pathways
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="glass-panel p-6 h-full"
              id="pathway"
            >
              <div className="flex flex-wrap items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Condition Pathway</h2>

                <div className="flex flex-wrap mt-2 sm:mt-0">
                  {chronicConditions.map((condition) => (
                    <button
                      key={condition.id}
                      onClick={() => setSelectedCondition(condition)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors mr-2 mb-2 sm:mb-0 ${selectedCondition.id === condition.id
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

              <div className="mb-4 glass-card p-4 flex items-start">
                <Info className="h-5 w-5 text-niraiva-500 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">About this view</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    This interactive pathway diagram visualizes the clinical decision process for {selectedCondition.name}.
                    Each node represents a key diagnostic or treatment step. You can zoom using pinch gestures or the mouse wheel at any point,
                    and drag to pan around the diagram. Click on any node to see detailed information.
                  </p>
                </div>
              </div>

              {reports.length > 0 && (
                <div className="mb-4 glass-card p-4 flex items-start bg-niraiva-50 dark:bg-niraiva-900/10">
                  <FileText className="h-5 w-5 text-niraiva-600 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1">Enhanced with Reports</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      The pathway visualization has been enhanced with data from {reports.length} uploaded health report(s).
                    </p>
                  </div>
                </div>
              )}

              <DiagnosticMap nodes={userSpecificNodes} className="mt-6" />
            </motion.div>
          </div>

          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-6"
            >
              <ReportUploader />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="glass-panel p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Patient Summary</h2>

              <div className="mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-300">ABHA ID</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {userProfile.abha_number || 'Not set'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Allergies</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {userProfile.allergies?.length || 0} known
                  </span>
                </div>

                <div className="flex justify-between mb-2">
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

              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg" id="treatment">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Current Treatment</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  {selectedCondition.id === 'cond-001' ? (
                    <>Current treatment involves <span className="font-medium">Metformin 500mg twice daily</span> along with lifestyle modifications including diet control and regular exercise.</>
                  ) : selectedCondition.id === 'cond-002' ? (
                    <>Currently prescribed <span className="font-medium">Lisinopril 10mg once daily</span> with regular blood pressure monitoring and sodium-restricted diet.</>
                  ) : (
                    <>Managing with <span className="font-medium">Atorvastatin 20mg daily</span> alongside dietary modifications focused on reducing saturated fat intake.</>
                  )}
                </p>
              </div>

              <div id="clinical-notes">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Key Clinical Notes</h3>

                <div className="space-y-3">
                  <div className="p-3 bg-niraiva-50 dark:bg-niraiva-900/10 rounded-lg border border-niraiva-100 dark:border-niraiva-900/20">
                    <div className="flex items-start">
                      <Activity className="h-5 w-5 text-niraiva-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm">Recent Progress</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          {selectedCondition.id === 'cond-001' ? (
                            <>HbA1c decreased from 7.8% at diagnosis to 6.2% currently, indicating good glycemic control.</>
                          ) : selectedCondition.id === 'cond-002' ? (
                            <>Blood pressure reduced from 150/95 mmHg to 128/82 mmHg with current regimen.</>
                          ) : (
                            <>LDL cholesterol decreased from 165 mg/dL to 118 mg/dL since treatment initiation.</>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-niraiva-50 dark:bg-niraiva-900/10 rounded-lg border border-niraiva-100 dark:border-niraiva-900/20">
                    <div className="flex items-start">
                      <Activity className="h-5 w-5 text-niraiva-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm">Lifestyle Impact</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          {selectedCondition.id === 'cond-001' ? (
                            <>Weight reduction of 5kg and improved diet have contributed significantly to better glycemic control.</>
                          ) : selectedCondition.id === 'cond-002' ? (
                            <>Sodium restriction and regular exercise have supported pharmacological treatment.</>
                          ) : (
                            <>Adoption of Mediterranean diet principles has improved overall lipid profile.</>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {reports.length > 0 ? (
                    <div className="p-3 bg-niraiva-50 dark:bg-niraiva-900/10 rounded-lg border border-niraiva-100 dark:border-niraiva-900/20 animate-pulse">
                      <div className="flex items-start">
                        <Activity className="h-5 w-5 text-niraiva-600 mr-2 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm">Report Analysis</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                            Analysis of {reports.length} uploaded report(s) suggests {selectedCondition.severity === 'mild' ? 'continued improvement' : 'treatment adjustment may be beneficial'}. Detailed clinical review recommended.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-niraiva-50 dark:bg-niraiva-900/10 rounded-lg border border-niraiva-100 dark:border-niraiva-900/20">
                      <div className="flex items-start">
                        <Activity className="h-5 w-5 text-niraiva-600 mr-2 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm">Next Steps</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                            {selectedCondition.id === 'cond-001' ? (
                              <>Scheduled for annual diabetic retinopathy screening in next 2 months.</>
                            ) : selectedCondition.id === 'cond-002' ? (
                              <>Plan to assess renal function in upcoming visit to evaluate medication dosing.</>
                            ) : (
                              <>Consider additional therapy if LDL target not achieved in 3 months.</>
                            )}
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

              <div className="space-y-8">
                {selectedCondition.id === 'cond-001' ? (
                  <>
                    {/* HbA1c Trend for Diabetes */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">HbA1c (%)</h3>
                        <span className="text-sm text-health-good">Improving</span>
                      </div>

                      <div className="h-[100px] relative mb-2">
                        <div className="absolute inset-0">
                          <svg className="w-full h-full" viewBox="0 0 500 100" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="hba1cGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
                              </linearGradient>
                            </defs>

                            <path
                              d="M0,20 L100,25 L200,30 L300,40 L400,45 L500,50 L500,100 L0,100 Z"
                              fill="url(#hba1cGradient)"
                            />

                            <path
                              d="M0,20 L100,25 L200,30 L300,40 L400,45 L500,50"
                              stroke="#0EA5E9"
                              strokeWidth="2"
                              fill="none"
                            />

                            <circle cx="0" cy="20" r="4" fill="#0EA5E9" />
                            <circle cx="100" cy="25" r="4" fill="#0EA5E9" />
                            <circle cx="200" cy="30" r="4" fill="#0EA5E9" />
                            <circle cx="300" cy="40" r="4" fill="#0EA5E9" />
                            <circle cx="400" cy="45" r="4" fill="#0EA5E9" />
                            <circle cx="500" cy="50" r="4" fill="#0EA5E9" />
                          </svg>
                        </div>
                      </div>

                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Mar 2020</span>
                        <span>Jan 2023</span>
                      </div>

                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        HbA1c decreased from <span className="font-medium text-health-poor">7.8%</span> to <span className="font-medium text-health-moderate">6.2%</span> over 3 years
                      </div>
                    </div>
                  </>
                ) : selectedCondition.id === 'cond-002' ? (
                  <>
                    {/* Blood Pressure Trend for Hypertension */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">Systolic BP (mmHg)</h3>
                        <span className="text-sm text-health-good">Improving</span>
                      </div>

                      <div className="h-[100px] relative mb-2">
                        <div className="absolute inset-0">
                          <svg className="w-full h-full" viewBox="0 0 500 100" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="bpGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#F97316" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
                              </linearGradient>
                            </defs>

                            <path
                              d="M0,10 L100,20 L200,35 L300,45 L400,60 L500,65 L500,100 L0,100 Z"
                              fill="url(#bpGradient)"
                            />

                            <path
                              d="M0,10 L100,20 L200,35 L300,45 L400,60 L500,65"
                              stroke="#F97316"
                              strokeWidth="2"
                              fill="none"
                            />

                            <circle cx="0" cy="10" r="4" fill="#F97316" />
                            <circle cx="100" cy="20" r="4" fill="#F97316" />
                            <circle cx="200" cy="35" r="4" fill="#F97316" />
                            <circle cx="300" cy="45" r="4" fill="#F97316" />
                            <circle cx="400" cy="60" r="4" fill="#F97316" />
                            <circle cx="500" cy="65" r="4" fill="#F97316" />
                          </svg>
                        </div>
                      </div>

                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Nov 2019</span>
                        <span>Jan 2023</span>
                      </div>

                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        Systolic BP decreased from <span className="font-medium text-health-poor">150 mmHg</span> to <span className="font-medium text-health-good">128 mmHg</span> with treatment
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* LDL Trend for Hyperlipidemia */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">LDL Cholesterol (mg/dL)</h3>
                        <span className="text-sm text-health-good">Improving</span>
                      </div>

                      <div className="h-[100px] relative mb-2">
                        <div className="absolute inset-0">
                          <svg className="w-full h-full" viewBox="0 0 500 100" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="ldlGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                              </linearGradient>
                            </defs>

                            <path
                              d="M0,15 L100,25 L200,40 L300,55 L400,60 L500,70 L500,100 L0,100 Z"
                              fill="url(#ldlGradient)"
                            />

                            <path
                              d="M0,15 L100,25 L200,40 L300,55 L400,60 L500,70"
                              stroke="#8B5CF6"
                              strokeWidth="2"
                              fill="none"
                            />

                            <circle cx="0" cy="15" r="4" fill="#8B5CF6" />
                            <circle cx="100" cy="25" r="4" fill="#8B5CF6" />
                            <circle cx="200" cy="40" r="4" fill="#8B5CF6" />
                            <circle cx="300" cy="55" r="4" fill="#8B5CF6" />
                            <circle cx="400" cy="60" r="4" fill="#8B5CF6" />
                            <circle cx="500" cy="70" r="4" fill="#8B5CF6" />
                          </svg>
                        </div>
                      </div>

                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>May 2021</span>
                        <span>Jan 2023</span>
                      </div>

                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        LDL decreased from <span className="font-medium text-health-poor">165 mg/dL</span> to <span className="font-medium text-health-moderate">118 mg/dL</span> with statin therapy
                      </div>
                    </div>
                  </>
                )}

                {/* Weight Trend for all conditions */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">Weight (kg)</h3>
                    <span className="text-sm text-health-good">Improving</span>
                  </div>

                  <div className="h-[100px] relative mb-2">
                    <div className="absolute inset-0">
                      <svg className="w-full h-full" viewBox="0 0 500 100" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="weightGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                          </linearGradient>
                        </defs>

                        <path
                          d="M0,30 L100,40 L200,50 L300,55 L400,65 L500,70 L500,100 L0,100 Z"
                          fill="url(#weightGradient)"
                        />

                        <path
                          d="M0,30 L100,40 L200,50 L300,55 L400,65 L500,70"
                          stroke="#10B981"
                          strokeWidth="2"
                          fill="none"
                        />

                        <circle cx="0" cy="30" r="4" fill="#10B981" />
                        <circle cx="100" cy="40" r="4" fill="#10B981" />
                        <circle cx="200" cy="50" r="4" fill="#10B981" />
                        <circle cx="300" cy="55" r="4" fill="#10B981" />
                        <circle cx="400" cy="65" r="4" fill="#10B981" />
                        <circle cx="500" cy="70" r="4" fill="#10B981" />
                      </svg>
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Mar 2020</span>
                    <span>Jan 2023</span>
                  </div>

                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    Weight decreased from <span className="font-medium text-health-moderate">83 kg</span> to <span className="font-medium text-health-good">78 kg</span> over 3 years
                  </div>
                </div>
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
