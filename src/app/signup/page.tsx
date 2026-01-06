'use client';

import { useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [goals, setGoals] = useState('');
    const [injuries, setInjuries] = useState('');

    const handleSignup = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg(null);

        // 1. Create the Auth User
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
        });

        if (authError) {
            setErrorMsg(authError.message);
            setLoading(false);
            return;
        }

        if (authData.user) {
            // 2. Create the Profile Record
            // Ensures the profile is linked to the authenticated user
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([
                    {
                        id: authData.user.id,
                        full_name: fullName,
                        phone: phone,
                        fitness_goals: goals,
                        injuries: injuries,
                        role: 'client'
                    }
                ]);

            if (profileError) {
                console.error('Profile creation error:', profileError);
                setErrorMsg('Account created, but profile failed: ' + profileError.message);
                setLoading(false);
            } else {
                // 3. SUCCESS! Redirect to the Measurements page
                router.push('/measurements');
            }
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
            <div className="w-full max-w-lg bg-white p-8 shadow-xl rounded-2xl">
                <h1 className="text-3xl font-extrabold text-blue-900 text-center mb-6">New Client Registration</h1>

                {errorMsg && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{errorMsg}</div>}

                <form onSubmit={handleSignup} className="space-y-4">
                    <input type="text" placeholder="Full Name..." value={fullName} onChange={e => setFullName(e.target.value)} required className="w-full p-3 border rounded text-black placeholder:text-gray-400" />
                    <input type="email" placeholder="Email..." value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-3 border rounded text-black placeholder:text-gray-400" />
                    <input type="password" placeholder="Password..." value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-3 border rounded text-black placeholder:text-gray-400" />
                    <input type="tel" placeholder="Phone Number..." value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 border rounded text-black placeholder:text-gray-400" />
                    <select
                        value={goals}
                        onChange={e => setGoals(e.target.value)}
                        className="w-full p-3 border rounded text-black placeholder:text-gray-400 bg-white"
                        required
                    >
                        <option value="" disabled>Select Fitness Goal</option>
                        <option value="Muscle Gain">Muscle Gain</option>
                        <option value="Fat Loss">Fat Loss</option>
                        <option value="Staying Active">Staying Active</option>
                        <option value="Body Shaping">Body Shaping</option>

                    </select>
                    <textarea placeholder="Injuries or Health Concerns..." value={injuries} onChange={e => setInjuries(e.target.value)} className="w-full p-3 border rounded text-black placeholder:text-gray-400" />

                    <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 transition">
                        {loading ? 'Creating Profile...' : 'Next: Body Measurements →'}
                    </button>
                </form>

                <div className="mt-4 text-center">
                    <Link href="/" className="text-gray-500 hover:text-blue-600 text-sm">Cancel</Link>
                </div>
            </div>
        </div>
    );
}