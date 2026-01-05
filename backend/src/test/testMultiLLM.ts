import 'dotenv/config';
import { MultiLLMService } from '../services/MultiLLMService';

async function testFallback() {
    const multiLLM = new MultiLLMService();
    const mockOCRText = `
        PATIENT: Rahul Sharma
        DATE: 12-Oct-2023
        TEST: HB1AC
        RESULT: 6.8%
        REF RANGE: 4.0-5.6% (Normal)
        
        PRESCRIPTION:
        Metformin 500mg - 1-0-1 for 3 months
    `;

    console.log('🧪 Starting Multi-LLM Fallback Test...');

    try {
        const result = await multiLLM.parseReport(mockOCRText);
        console.log('--- TEST RESULT ---');
        console.log(`Provider: ${result.provider}`);
        console.log(`Type: ${result.data.type}`);
        console.log(`Patient: ${result.data.patient_name}`);
        console.log(`Confidence: ${result.data.confidence}`);
        console.log('-------------------');

        if (result.data.medications && result.data.medications.length > 0) {
            console.log(`Meds found: ${result.data.medications.map(m => m.name).join(', ')}`);
        }
    } catch (error: any) {
        console.error('❌ Test failed:', error.message);
    }
}

testFallback();
