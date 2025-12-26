/**
 * FHIR Sync Service - Central export for all sync modules
 * 
 * This module provides a unified interface for syncing Niraiva data
 * to FHIR resources following ABDM ABHA v3 standards.
 */

export { syncPatient, getFhirPatientId, type PatientSyncData } from './syncPatient';
export { syncObservation, syncMultipleObservations, type VitalSign } from './syncObservation';
export { syncEncounter, type EncounterData } from './syncEncounter';
export { syncCondition, type ConditionData } from './syncCondition';
export { syncMedicationRequest, type MedicationData } from './syncMedicationRequest';
export { syncDiagnosticReport, type DiagnosticReportData } from './syncDiagnosticReport';
