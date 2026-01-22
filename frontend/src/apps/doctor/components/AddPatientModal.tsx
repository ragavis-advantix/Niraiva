import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getApiBaseUrl } from '@/lib/fhir';
import { Loader2, Plus, X } from 'lucide-react';

interface AddPatientModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddPatientModal({ open, onClose, onSuccess }: AddPatientModalProps) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        gender: 'male',
        dob: '',
    });
    const [conditions, setConditions] = useState<string[]>([]);
    const [newCondition, setNewCondition] = useState('');

    const handleAddCondition = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && newCondition.trim()) {
            e.preventDefault();
            if (!conditions.includes(newCondition.trim())) {
                setConditions([...conditions, newCondition.trim()]);
            }
            setNewCondition('');
        }
    };

    const removeCondition = (index: number) => {
        setConditions(conditions.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const apiBase = getApiBaseUrl(); // Moved outside headers for syntactic correctness
            const response = await fetch(`${apiBase}/api/doctor/create-patient`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await (await import('@/lib/supabase')).supabase.auth.getSession()).data.session?.access_token}`,
                },
                body: JSON.stringify({
                    name: formData.fullName.trim(),
                    phone: formData.phone.trim(),
                    dob: formData.dob,
                    gender: formData.gender,
                    chronic_conditions: conditions.length > 0 ? conditions : null,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create patient');
            }

            toast({
                title: 'Success',
                description: 'Patient created and linked successfully.',
            });
            onSuccess();
            onClose();
            // Reset form
            setFormData({ fullName: '', phone: '', gender: 'male', dob: '' });
            setConditions([]);
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] bg-white border-gray-200 text-gray-900 shadow-xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-gray-900">Add New Patient</DialogTitle>
                    <DialogDescription className="text-gray-600">
                        Enter patient details to create an account and link them to your portal.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName" className="text-gray-700">Full Name</Label>
                        <Input
                            id="fullName"
                            required
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:ring-cyan-500/20"
                            placeholder="e.g. John Doe"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-gray-700">Phone Number</Label>
                            <Input
                                id="phone"
                                required
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:ring-cyan-500/20"
                                placeholder="e.g. 9876543210"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dob" className="text-gray-700">Date of Birth</Label>
                            <Input
                                id="dob"
                                type="date"
                                required
                                value={formData.dob}
                                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                                className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:ring-cyan-500/20"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="gender" className="text-gray-700">Gender</Label>
                        <Select
                            value={formData.gender}
                            onValueChange={(val) => setFormData({ ...formData, gender: val })}
                        >
                            <SelectTrigger className="bg-gray-50 border-gray-200 text-gray-900">
                                <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-200 text-gray-900">
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="conditions" className="text-gray-700">Chronic Conditions (Optional)</Label>
                        <Input
                            id="conditions"
                            value={newCondition}
                            onChange={(e) => setNewCondition(e.target.value)}
                            onKeyDown={handleAddCondition}
                            className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:ring-cyan-500/20"
                            placeholder="Type and press Enter to add"
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                            {conditions.map((c, i) => (
                                <span key={i} className="flex items-center gap-1 px-2 py-1 bg-cyan-50 text-cyan-700 text-xs rounded-full border border-cyan-200">
                                    {c}
                                    <button type="button" onClick={() => removeCondition(i)} className="hover:text-cyan-900">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white shadow-lg shadow-cyan-500/20"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            Create Patient
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
