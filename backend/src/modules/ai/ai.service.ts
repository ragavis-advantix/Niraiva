/**
 * AI Service - System-Only Document Parsing
 * 
 * CRITICAL RULES:
 * 1. AI parsing runs ONLY on system/doctor uploaded documents
 * 2. NEVER runs on patient uploads
 * 3. Output goes to medical_records table only
 * 4. AI never overwrites doctor truth
 */

export const aiService = {
    /**
     * Parse medical document
     * Called only from medical-records.service (not personal-records)
     */
    async parseDocument(filePath: string, recordType: string): Promise<any> {
        try {
            // TODO: Integrate with actual AI service (Gemini, OpenAI, etc.)
            // For now, return mock parsed data

            console.log(`AI parsing document: ${filePath} (type: ${recordType})`);

            // Mock parsed data based on record type
            switch (recordType) {
                case 'lab':
                    return this.mockLabResults();
                case 'imaging':
                    return this.mockImagingResults();
                case 'prescription':
                    return this.mockPrescriptionData();
                default:
                    return {};
            }
        } catch (error) {
            console.error('AI parsing error:', error);
            throw error;
        }
    },

    /**
     * Mock lab results
     */
    mockLabResults() {
        return {
            test_name: 'Complete Blood Count',
            test_date: new Date().toISOString(),
            results: [
                { parameter: 'Hemoglobin', value: 14.5, unit: 'g/dL', range: '12-16', status: 'normal' },
                { parameter: 'WBC Count', value: 7200, unit: '/cumm', range: '4000-11000', status: 'normal' },
                { parameter: 'Platelet Count', value: 250000, unit: '/cumm', range: '150000-450000', status: 'normal' }
            ]
        };
    },

    /**
     * Mock imaging results
     */
    mockImagingResults() {
        return {
            imaging_type: 'X-Ray Chest',
            imaging_date: new Date().toISOString(),
            findings: 'No acute cardiopulmonary abnormality detected',
            impression: 'Normal chest X-ray'
        };
    },

    /**
     * Mock prescription data
     */
    mockPrescriptionData() {
        return {
            prescription_date: new Date().toISOString(),
            medications: [
                { name: 'Amoxicillin', dosage: '500mg', frequency: 'Twice daily', duration: '7 days' },
                { name: 'Paracetamol', dosage: '650mg', frequency: 'As needed', duration: '5 days' }
            ]
        };
    },

    /**
     * Validate that upload source is authorized for AI parsing
     * Returns true only if uploaded by doctor/clinical staff
     */
    validateUploadSource(uploadedBy?: string, userRole?: string): boolean {
        if (!uploadedBy || !userRole) {
            return false;
        }

        const authorizedRoles = ['doctor', 'clinical_staff', 'admin'];
        return authorizedRoles.includes(userRole);
    }
};
