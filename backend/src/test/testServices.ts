/**
 * Quick Test Script for Health Report Upload System
 * Tests OCR and Gemini services initialization
 * 
 * Run: npx ts-node src/test/testServices.ts
 */

import 'dotenv/config';
import { OCRService } from '../services/ocrService';
import { GeminiService } from '../services/geminiService';

async function testServices() {
    console.log('🧪 Testing Health Report Upload Services\n');

    // Test 1: Check environment variables
    console.log('1️⃣ Checking environment variables...');
    const requiredVars = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_BUCKET',
        'OCRSPACE_API_KEY',
        'GEMINI_API_KEY',
    ];

    let allPresent = true;
    for (const varName of requiredVars) {
        const value = process.env[varName];
        if (value) {
            console.log(`   ✅ ${varName}: ${value.substring(0, 20)}...`);
        } else {
            console.log(`   ❌ ${varName}: NOT SET`);
            allPresent = false;
        }
    }

    if (!allPresent) {
        console.log('\n❌ Some environment variables are missing. Please check .env file.');
        process.exit(1);
    }

    console.log('\n2️⃣ Initializing OCR Service...');
    try {
        const ocrService = new OCRService();
        console.log('   ✅ OCR Service initialized successfully');
    } catch (error: any) {
        console.log(`   ❌ OCR Service failed: ${error.message}`);
    }

    console.log('\n3️⃣ Initializing Gemini Service...');
    try {
        const geminiService = new GeminiService();
        console.log('   ✅ Gemini Service initialized successfully');
    } catch (error: any) {
        console.log(`   ❌ Gemini Service failed: ${error.message}`);
    }

    console.log('\n4️⃣ Testing Gemini with sample medical text...');
    try {
        const geminiService = new GeminiService();
        const sampleOCR = `
        LABORATORY REPORT
        Patient Name: John Doe
        Date: 2024-12-06
        
        COMPLETE BLOOD COUNT
        Hemoglobin: 14.5 g/dL (Ref: 13.0-17.0)
        WBC Count: 7500 cells/µL (Ref: 4000-11000)
        Platelet Count: 250000 cells/µL (Ref: 150000-450000)
        `;

        console.log('   Sending sample text to Gemini...');
        const result = await geminiService.parseReport(sampleOCR);

        console.log(`   ✅ Gemini parsed successfully!`);
        console.log(`   Report Type: ${result.type}`);
        console.log(`   Confidence: ${result.confidence}`);
        console.log(`   Tests Found: ${result.tests?.length || 0}`);
        console.log(`   Patient: ${result.patient_name || 'N/A'}`);
    } catch (error: any) {
        console.log(`   ❌ Gemini test failed: ${error.message}`);
    }

    console.log('\n✅ All tests completed!\n');
}

testServices().catch(console.error);
