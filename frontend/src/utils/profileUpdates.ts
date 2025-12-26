// Import Supabase client
import { supabase } from '../lib/supabase';

// Function to add allergy to user profile
export async function addAllergy(userId: string, allergy: string): Promise<boolean> {
  try {
    // First get current profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      // Profile doesn't exist, create it with minimal required fields
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          allergies: [allergy],
          first_name: '',
          gender: '',
          mobile_number: '',
          mobile_verified: false,
          address: '',
          district_code: '',
          state_code: '',
          pin_code: '',
          state_name: '',
          district_name: '',
          abha_status: 'PENDING',
          dob: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      return !insertError;
    }

    // Create or update allergies array
    const currentAllergies = profile.allergies || [];
    const updatedAllergies = Array.from(new Set([...currentAllergies, allergy]));

    // Update the profile
    const { error } = await supabase
      .from('user_profiles')
      .update({
        allergies: updatedAllergies,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    return !error;
  } catch (error) {
    console.error('Error adding allergy:', error);
    return false;
  }
}

// Function to remove allergy from user profile
export async function removeAllergy(userId: string, allergy: string): Promise<boolean> {
  try {
    // First get current allergies
    const { data, error: fetchError } = await supabase
      .from('user_profiles')
      .select('allergies')
      .eq('user_id', userId)
      .single();

    if (fetchError?.code === 'PGRST116' || !data?.allergies) {
      // Profile doesn't exist or no allergies, nothing to remove
      return false;
    }

    // Filter out the allergy to remove
    const updatedAllergies = data.allergies.filter(
      (a: string) => a.toLowerCase() !== allergy.toLowerCase()
    );

    // Update the profile
    const { error } = await supabase
      .from('user_profiles')
      .update({
        allergies: updatedAllergies,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    return !error;
  } catch (error) {
    console.error('Error removing allergy:', error);
    return false;
  }
}