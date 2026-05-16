'use client';

import Link from 'next/link';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation'; // <--- Import for redirection
import { createClient } from '@/utils/supabase/client'; // <--- Import your supabase SSR client

export default function LoginPage() {
    const router = useRouter();
    const supabase = createClient();

    // State for inputs
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // State for handling feedback (loading spinners, error messages)
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg(null);

        // 1. Ask Supabase to sign in with the email and password
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            // 2. If Supabase returns an error (wrong password, user not found), show it
            console.error("Login Error Details:", error); // <--- LOGGING ADDED
            setErrorMsg(error.message);
            setLoading(false);
        } else {
            // 3. If successful, redirect the user to the dashboard
            console.log('Login successful:', data);

            // Recursive redirection based on email (temporary role check)
            if (data.user?.email?.includes('zchacha') || data.user?.email?.includes('admin')) {
                router.push('/adash');
            } else {
                router.push('/cdash');
            }
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
            <div className="w-full max-w-md bg-white p-8 shadow-xl rounded-2xl">

                <div className="mb-6 text-center">
                    <h1 className="text-3xl font-extrabold text-blue-900">Welcome</h1>
                    <p className="text-gray-500 mt-2">Please sign in to your account</p>
                </div>

                {/* Show Error Message if login fails */}
                {errorMsg && (
                    <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700" htmlFor="email">
                            Email Address
                        </label>
                        <input
                            id="email"
                            type="email"
                            placeholder="mom@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700" htmlFor="password">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`mt-2 w-full rounded-lg p-3 font-bold text-white shadow-md transition 
              ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}
            `}
                    >
                        {loading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-600">
                    <p>
                        Don't have an account?{' '}
                        <Link href="/signup" className="font-bold text-blue-600 hover:underline">
                            Sign up
                        </Link>
                    </p>
                    <p className="mt-2">
                        <Link href="/" className="text-gray-400 hover:text-gray-600">
                            ← Back to Home
                        </Link>
                    </p>
                </div>

            </div>
        </div>
    );
}