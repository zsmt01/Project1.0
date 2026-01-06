'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function MeasurementPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Measurements State
    const [height, setHeight] = useState('');
    const [waist, setWaist] = useState('');
    const [hip, setHip] = useState('');
    const [armLeft, setArmLeft] = useState('');
    const [armRight, setArmRight] = useState('');
    const [legLeft, setLegLeft] = useState('');
    const [legRight, setLegRight] = useState('');
    const [bodyFat, setBodyFat] = useState('');
    const [bmi, setBmi] = useState('');
    const [notes, setNotes] = useState('');

    // On load, find out who the user is
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
            } else {
                // If they aren't logged in, kick them back to login
                router.push('/login');
            }
        };
        getUser();
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) return;
        setLoading(true);

        const { error } = await supabase.from('measurements').insert([
            {
                user_id: userId,
                height_cm: height ? parseFloat(height) : null,
                waist_cm: waist ? parseFloat(waist) : null,
                hip_cm: hip ? parseFloat(hip) : null,
                arm_left_cm: armLeft ? parseFloat(armLeft) : null,
                arm_right_cm: armRight ? parseFloat(armRight) : null,
                leg_left_cm: legLeft ? parseFloat(legLeft) : null,
                leg_right_cm: legRight ? parseFloat(legRight) : null,
                body_fat_percent: bodyFat ? parseFloat(bodyFat) : null,
                bmi: bmi ? parseFloat(bmi) : null,
                notes: notes,
            }
        ]);

        if (error) {
            alert('Error: ' + error.message);
            setLoading(false);
        } else {
            // SUCCESS! Now they are fully onboarded.
            alert('Onboarding Complete!');
            router.push('/dashboard'); // Or wherever you want them to go next
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-blue-50 p-6">
            <div className="w-full max-w-lg bg-white p-8 shadow-xl rounded-2xl border-t-4 border-blue-600">
                <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Initial Assessment</h1>
                <p className="text-center text-gray-500 mb-6">Let's get a baseline for your progress.</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-black">Height (cm)</label>
                            <input type="number" min="0" step="0.1" value={height} onChange={e => setHeight(e.target.value)} required className="w-full p-2 border rounded text-black placeholder:text-gray-500" placeholder="170" />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-black">Body Fat (%)</label>
                            <input type="number" min="0" step="0.1" value={bodyFat} onChange={e => setBodyFat(e.target.value)} required className="w-full p-2 border rounded text-black placeholder:text-gray-500" placeholder="22.5" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-black">Waist (cm)</label>
                            <input type="number" min="0" step="0.1" value={waist} onChange={e => setWaist(e.target.value)} required className="w-full p-2 border rounded text-black" />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-black">Hip (cm)</label>
                            <input type="number" min="0" step="0.1" value={hip} onChange={e => setHip(e.target.value)} required className="w-full p-2 border rounded text-black" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-black">BMI</label>
                            <input type="number" min="0" step="0.1" value={bmi} onChange={e => setBmi(e.target.value)} required className="w-full p-2 border rounded text-black placeholder:text-gray-500" placeholder="24.0" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-black">Left Arm (cm)</label>
                            <input type="number" min="0" step="0.1" value={armLeft} onChange={e => setArmLeft(e.target.value)} required className="w-full p-2 border rounded text-black" />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-black">Right Arm (cm)</label>
                            <input type="number" min="0" step="0.1" value={armRight} onChange={e => setArmRight(e.target.value)} required className="w-full p-2 border rounded text-black" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-black">Left Leg (cm)</label>
                            <input type="number" min="0" step="0.1" value={legLeft} onChange={e => setLegLeft(e.target.value)} required className="w-full p-2 border rounded text-black" />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-black">Right Leg (cm)</label>
                            <input type="number" min="0" step="0.1" value={legRight} onChange={e => setLegRight(e.target.value)} required className="w-full p-2 border rounded text-black" />
                        </div>
                    </div>

                    <textarea placeholder="Additional Notes (e.g. hydration levels)" value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 border rounded text-black placeholder:text-gray-500" />

                    <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 transition">
                        {loading ? 'Saving...' : 'Complete Form'}
                    </button>
                </form>
            </div>
        </div>
    );
}