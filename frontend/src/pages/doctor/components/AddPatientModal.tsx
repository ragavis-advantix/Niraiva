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
        gender: 'Male',
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
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/doctor/create-patient`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await (await import('@/lib/supabase')).supabase.auth.getSession()).data.session?.access_token}`,
                },
                body: JSON.stringify({
                    ...formData,
                    chronicConditions: conditions,
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
            setFormData({ fullName: '', phone: '', gender: 'Male', dob: '' });
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
            <DialogContent className="sm:max-w-[425px] bg-[#0B1220] border-white/10 text-white shadow-[0_0_40px_rgba(0,255,255,0.15)]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-white">Add New Patient</DialogTitle>
                    <DialogDescription className="text-cyan-200/70">
                        Enter patient details to create an account and link them to your portal.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName" className="text-gray-300">Full Name</Label>
                        <Input
                            id="fullName"
                            required
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-cyan-500/50"
                            placeholder="e.g. John Doe"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-gray-300">Phone Number</Label>
                            <Input
                                id="phone"
                                required
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-cyan-500/50"
                                placeholder="e.g. 9876543210"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dob" className="text-gray-300">Date of Birth</Label>
                            <Input
                                id="dob"
                                type="date"
                                required
                                value={formData.dob}
                                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-cyan-500/50"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="gender" className="text-gray-300">Gender</Label>
                        <Select
                            value={formData.gender}
                            onValueChange={(val) => setFormData({ ...formData, gender: val })}
                        >
                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0B1220] border-white/10 text-white">
                                <SelectItem value="Male">Male</SelectItem>
                                <SelectItem value="Female">Female</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="conditions" className="text-gray-300">Chronic Conditions (Optional)</Label>
                        <Input
                            id="conditions"
                            value={newCondition}
                            onChange={(e) => setNewCondition(e.target.value)}
                            onKeyDown={handleAddCondition}
                            className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-cyan-500/50"
                            placeholder="Type and press Enter to add"
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                            {conditions.map((c, i) => (
                                <span key={i} className="flex items-center gap-1 px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full border border-cyan-500/30">
                                    {c}
                                    <button type="button" onClick={() => removeCondition(i)} className="hover:text-white">
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
                            className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white shadow-[0_0_15px_rgba(0,255,255,0.3)]"
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
