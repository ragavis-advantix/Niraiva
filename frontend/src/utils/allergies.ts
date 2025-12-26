import { supabase } from "../lib/supabase";

// Add allergy management functions to healthData.ts
export async function addAllergy(userId: string, allergy: string): Promise<boolean> {
  // First, get the current allergies
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("allergies")
    .eq("user_id", userId)
    .single();

  // Create or update the allergies array
  const currentAllergies = profile?.allergies || [];
  const newAllergies = [...new Set([...currentAllergies, allergy])]; // Use Set to remove duplicates

  // Update the profile with new allergies
  const { error } = await supabase
    .from("user_profiles")
    .update({
      allergies: newAllergies,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);

  if (error) {
    console.error("Error adding allergy:", error);
    return false;
  }

  return true;
}

export async function removeAllergy(userId: string, allergy: string): Promise<boolean> {
  // First, get the current allergies
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("allergies")
    .eq("user_id", userId)
    .single();

  // Remove the allergy from the array
  const currentAllergies = profile?.allergies || [];
  const newAllergies = currentAllergies.filter(
    (a: string) => a.toLowerCase() !== allergy.toLowerCase()
  );

  // Update the profile with new allergies
  const { error } = await supabase
    .from("user_profiles")
    .update({
      allergies: newAllergies,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);

  if (error) {
    console.error("Error removing allergy:", error);
    return false;
  }

  return true;
}