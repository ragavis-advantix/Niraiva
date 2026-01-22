import crypto from 'crypto';
import { patientRepository } from '../patients/patient.repository';
import { authRepository } from './auth.repository';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export const authService = {
    /**
     * Verify patient invite token and DOB
     * If valid, generates and "sends" OTP
     */
    async verifyInvite(token: string, dob: string) {
        // Hash the token
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find invite
        const invite = await patientRepository.findInviteByToken(hashedToken);

        if (!invite) {
            throw new Error('Invalid or expired invite');
        }

        // Verify DOB matches
        const patientDob = new Date(invite.patient_master.dob).toISOString().split('T')[0];
        const providedDob = new Date(dob).toISOString().split('T')[0];

        if (patientDob !== providedDob) {
            throw new Error('Date of birth does not match');
        }

        // Generate mock OTP (6 digits)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        // In a real app, send OTP via SMS/Email here
        console.log(`[MOCK OTP] Sent OTP ${otp} to patient ${invite.patient_master.full_name}`);

        // Store OTP in invite record
        const { error } = await supabaseAdmin
            .from('patient_invites')
            .update({
                otp,
                otp_expires_at: otpExpiresAt.toISOString(),
                otp_verified: false
            })
            .eq('id', invite.id);

        if (error) throw error;

        return {
            success: true,
            message: 'Identity verified. OTP sent to your registered mobile number.',
            patient: {
                id: invite.patient_master.id,
                full_name: invite.patient_master.full_name,
                mrn: invite.patient_master.mrn
            }
        };
    },

    /**
     * Verify OTP
     */
    async verifyOtp(token: string, otp: string) {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const invite = await patientRepository.findInviteByToken(hashedToken);

        if (!invite) {
            throw new Error('Invalid or expired invite');
        }

        if (!invite.otp || invite.otp !== otp) {
            throw new Error('Invalid OTP');
        }

        if (new Date() > new Date(invite.otp_expires_at)) {
            throw new Error('OTP has expired');
        }

        // Mark OTP as verified
        const { error } = await supabaseAdmin
            .from('patient_invites')
            .update({ otp_verified: true })
            .eq('id', invite.id);

        if (error) throw error;

        return { success: true, message: 'OTP verified successfully' };
    },

    /**
     * Activate patient account
     * Creates Supabase auth user and links to patient_master
     */
    async activatePatient(token: string, phone: string, password?: string) {
        // Verify invite first
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const invite = await patientRepository.findInviteByToken(hashedToken);

        if (!invite) {
            throw new Error('Invalid or expired invite');
        }

        if (!invite.otp_verified) {
            throw new Error('OTP must be verified before activation');
        }

        const patient = invite.patient_master;

        // Check if patient already has an account
        const existingAccount = await authRepository.findByPatientId(patient.id);
        if (existingAccount) {
            throw new Error('Patient already has an active account');
        }

        // Create Supabase Auth user
        const authData: any = {
            phone,
            phone_confirm: true,
            user_metadata: {
                full_name: patient.full_name,
                mrn: patient.mrn
            }
        };

        if (password) {
            authData.password = password;
        }

        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser(authData);

        if (authError) {
            throw new Error(`Failed to create auth user: ${authError.message}`);
        }

        // Create user_accounts entry
        await authRepository.createUserAccount({
            auth_user_id: authUser.user.id,
            role: 'patient',
            linked_patient_id: patient.id
        });

        // Mark invite as used
        await patientRepository.markInviteUsed(invite.id);

        return {
            success: true,
            message: 'Account activated successfully',
            user: {
                id: authUser.user.id,
                phone: authUser.user.phone,
                patient_id: patient.id
            }
        };
    },

    /**
     * Get enriched user information
     */
    async getMe(authUserId: string) {
        const { data: userAccount, error } = await supabaseAdmin
            .from('user_accounts')
            .select(`
                *,
                patient_master (id, full_name, mrn)
            `)
            .eq('auth_user_id', authUserId)
            .single();

        if (error) throw error;

        return {
            user: {
                id: userAccount.auth_user_id,
                role: userAccount.role,
                linked_patient_id: userAccount.linked_patient_id,
                patient: userAccount.patient_master
            }
        };
    }
};
