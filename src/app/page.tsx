import Link from 'next/link';
import React, { JSX } from 'react';

export default function Home(): JSX.Element {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black font-sans text-white">

      {/* Background Image with Overlay */}
      <div
        className="absolute inset-0 z-0 bg-[url('/hero-bg.png')] bg-cover bg-center bg-no-repeat opacity-80"
      >
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Content Container (Glassmorphism) */}
      <main className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-8 rounded-3xl border border-white/10 bg-white/10 p-10 text-center shadow-2xl backdrop-blur-md sm:p-20">

        {/* Main Headings */}
        <div className="space-y-4">
          <h1 className="font-outfit text-5xl font-extrabold tracking-tight text-white sm:text-7xl drop-shadow-lg">
            Train With Chacha
          </h1>
          <p className="mx-auto max-w-lg text-lg font-light text-gray-200 sm:text-2xl">
            <span className="block font-medium text-white mt-1">Manage your sessions or start your journey today.</span>
          </p>
        </div>

        {/* Button Container */}
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:justify-center sm:gap-6">

          {/* Option 1: New Client (Primary Action) */}
          <Link href="/signup" className="w-full sm:w-auto">
            <button className="w-full transform rounded-full bg-linear-to-r from-blue-600 to-indigo-600 px-8 py-4 text-xl font-bold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/25">
              New Client?
            </button>
          </Link>

          {/* Option 2: Log In (Secondary Action) */}
          <Link href="/login" className="w-full sm:w-auto">
            <button className="w-full transform rounded-full border-2 border-white/50 bg-white/5 px-8 py-4 text-xl font-bold text-white shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/20 hover:border-white">
              Client Log In
            </button>
          </Link>

        </div>

      </main>

      {/* Footer / Decorative */}
      <footer className="absolute bottom-6 z-10 text-xs text-gray-400">
        © {new Date().getFullYear()} Train With Chacha. All rights reserved.
      </footer>
    </div>
  );
}