import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface AbhaVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (abhaProfile: any) => void;
}

export function AbhaVerificationModal({ isOpen, onClose, onSuccess }: AbhaVerificationModalProps) {
  const [step, setStep] = useState<'mobile' | 'aadhar' | 'otp'>('mobile');
  const [mobile, setMobile] = useState('');
  const [aadhar, setAadhar] = useState('');
  const [otp, setOtp] = useState('');
  const [txnId, setTxnId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMobileSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('http://localhost:5000/api/abha/verify-mobile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ mobile })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to verify mobile');
      }

      setStep('aadhar');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAadharSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:5000/api/abha/verify-aadhar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ aadhar })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to verify Aadhar');
      }

      const data = await response.json();
      setTxnId(data.txnId);
      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:5000/api/abha/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          txnId,
          otp,
          mobile // Include mobile number for verification
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to verify OTP');
      }

      const data = await response.json();
      onSuccess(data.ABHAProfile);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'mobile':
        return (
          <div>
            <DialogHeader>
              <DialogTitle className="text-xl text-center">Enter Mobile Number</DialogTitle>
              <DialogDescription className="text-sm text-center">
                Please enter your mobile number to start ABHA verification
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="10-digit mobile number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                type="tel"
                maxLength={10}
                disabled={loading}
                className="border-gray-300 focus:ring-2 focus:ring-primary"
              />
              <Button
                onClick={handleMobileSubmit}
                disabled={mobile.length !== 10 || loading}
                className="w-full py-2 text-sm active:scale-95 transition-transform"
              >
                Continue
              </Button>
            </div>
          </div>
        );

      case 'aadhar':
        return (
          <div>
            <DialogHeader>
              <DialogTitle className="text-xl text-center">Enter Aadhar Number</DialogTitle>
              <DialogDescription className="text-sm text-center">
                Please enter your 12-digit Aadhar number
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="12-digit Aadhar number"
                value={aadhar}
                onChange={(e) => setAadhar(e.target.value)}
                type="text"
                maxLength={12}
                disabled={loading}
                className="border-gray-300 focus:ring-2 focus:ring-primary"
              />
              <Button
                onClick={handleAadharSubmit}
                disabled={aadhar.length !== 12 || loading}
                className="w-full py-2 text-sm active:scale-95 transition-transform"
              >
                Continue
              </Button>
            </div>
          </div>
        );

      case 'otp':
        return (
          <div>
            <DialogHeader>
              <DialogTitle className="text-xl text-center">Enter OTP</DialogTitle>
              <DialogDescription className="text-sm text-center">
                Please enter the OTP sent to your mobile number
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                type="text"
                maxLength={6}
                disabled={loading}
                className="border-gray-300 focus:ring-2 focus:ring-primary text-center text-lg tracking-widest"
              />
              <Button
                onClick={handleOtpSubmit}
                disabled={otp.length !== 6 || loading}
                className="w-full py-2 text-sm active:scale-95 transition-transform"
              >
                Verify OTP
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}