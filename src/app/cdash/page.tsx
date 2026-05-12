'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Dashboard() {
    const router = useRouter();
    const supabase = createClient();
    const [profile, setProfile] = useState<any>(null);
    const [requests, setRequests] = useState<any[]>([]);
    const [allRequests, setAllRequests] = useState<any[]>([]); // New state for global demand
    const [blockedTime, setBlockedTime] = useState<any[]>([]); // New state for blocked slots
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedSessionView, setSelectedSessionView] = useState<any>(null);

    // Range Selection State
    const [startTime, setStartTime] = useState<string | null>(null);
    const [endTime, setEndTime] = useState<string | null>(null);

    // Calendar State
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // --- CAROUSEL LOGIC ---
    const [currentSlide, setCurrentSlide] = useState(0);
    const slides = [
        { id: 'progress', title: 'Waist Measurement Progress' },
        { id: 'next-sessions', title: 'Upcoming Sessions' }
    ];

    // --- ACTIONS DROPDOWN STATE ---
    const [showActions, setShowActions] = useState(false);


    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    };

    // Filter confirmed future sessions
    const upcomingSessions = requests.filter(r =>
        r.status === 'confirmed' && new Date(r.start_time) > new Date()
    ).slice(0, 3); // Show top 3

    const pendingProposals = requests.filter(r => r.move_status === 'pending');

    // Fetch Data on Load
    useEffect(() => {
        let channel: any;

        const getData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            // 1. Get Profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            setProfile(profileData);

            // 2. Get Requests
            const { data: requestData } = await supabase
                .from('requests')
                .select('*')
                .eq('user_id', user.id)
                .gte('end_time', new Date().toISOString())
                .order('start_time', { ascending: true });

            if (requestData) setRequests(requestData);

            // 2b. Get all Requests for Demand Mapping
            const { data: allReqData } = await supabase
                .from('requests')
                .select('start_time, end_time, status, user_id, move_status')
                .gte('end_time', new Date().toISOString());

            if (allReqData) setAllRequests(allReqData);

            // 3. Get Blocked Time (Initial Fetch)
            const { data: blockedData } = await supabase
                .from('blocked_time')
                .select('*');

            if (blockedData) setBlockedTime(blockedData);

            // 4. Realtime Subscription for Blocked Time AND Requests
            channel = supabase
                .channel('public:realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_time' }, () => {
                    // Refresh blocked data
                    supabase.from('blocked_time').select('*').then(({ data }) => { if (data) setBlockedTime(data); });
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
                    // Refresh local user's requests first
                    supabase.from('requests').select('*').eq('user_id', user.id)
                        .gte('end_time', new Date().toISOString())
                        .order('start_time', { ascending: true })
                        .then(({ data }) => { if (data) setRequests(data); });

                    // Refresh global requests
                    supabase.from('requests').select('start_time, end_time, status, user_id, move_status')
                        .gte('end_time', new Date().toISOString())
                        .then(({ data }) => { if (data) setAllRequests(data); });
                })
                .subscribe();
        };

        getData();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [router]);

    // --- CALENDAR LOGIC ---

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday

        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
        return days;
    };

    const changeMonth = (offset: number) => {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
        setCurrentMonth(newDate);
    };

    const generateTimeSlots = (dateStr: string) => {
        const slots = [];
        const startHour = 6; // 6:00 AM
        const endHour = 22; // 10:00 PM

        for (let i = startHour; i < endHour; i++) {
            const hour = i % 12 || 12;
            const ampm = i < 12 ? 'AM' : 'PM';
            const timeString = `${hour}:00 ${ampm}`;

            // Construct a full Date object for this slot to check against blocks
            const slotStart = new Date(`${dateStr} ${i}:00`);
            const slotEnd = new Date(`${dateStr} ${i + 1}:00`);

            // Check Collision with Blocked Time
            const isBlocked = blockedTime.some(block => {
                const blockStart = new Date(block.start_time);
                const blockEnd = new Date(block.end_time);
                // Intersection check
                return (slotStart < blockEnd && slotEnd > blockStart);
            });

            // Calculate Demand metrics
            let demandCount = 0;
            let isGloballyConfirmed = false;
            let hasMyRequest = false;

            allRequests.forEach(req => {
                const reqStart = new Date(req.start_time);
                const reqEnd = new Date(req.end_time);

                if (slotStart < reqEnd && slotEnd > reqStart && req.status !== 'rejected') {
                    if (req.status === 'confirmed') {
                        isGloballyConfirmed = true;
                    } else if (req.status === 'pending' || req.move_status === 'pending') {
                        demandCount++;
                    }
                    if (profile && req.user_id === profile.id) {
                        hasMyRequest = true;
                    }
                }
            });

            const now = new Date();
            const isPast = slotStart < now;

            if (!isBlocked && !isGloballyConfirmed) {
                slots.push({
                    timeString,
                    demandCount,
                    hasMyRequest,
                    isPast
                });
            }
        }
        return slots;
    };

    const availableSlots = selectedDate ? generateTimeSlots(selectedDate) : [];

    const handleDateClick = (date: Date) => {
        const dateStr = date.toLocaleDateString('en-CA');
        setSelectedDate(dateStr);
        // Reset selections when changing date
        setStartTime(null);
        setEndTime(null);
    };



    const handleTimeClick = (time: string) => {
        setStartTime(time);

        // Automatic End Time: Add 1 Hour
        const [timePart, period] = time.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);

        // Convert to 24h for calculation
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;

        let endHours = hours + 1;

        // Convert back to 12h Format
        const endPeriod = endHours >= 12 && endHours < 24 ? 'PM' : 'AM';
        let displayHours = endHours % 12;
        if (displayHours === 0) displayHours = 12;

        setEndTime(`${displayHours}:00 ${endPeriod}`);
    };

    const confirmBooking = async () => {
        if (!startTime || !endTime || !profile) return;

        const confirmText = `Request session from ${startTime} to ${endTime} on ${selectedDate}?`;
        if (window.confirm(confirmText)) {
            const { error } = await supabase.from('requests').insert([{
                user_id: profile.id,
                start_time: `${selectedDate} ${startTime}`,
                end_time: `${selectedDate} ${endTime}`,
                status: 'pending'
            }]);

            if (!error) {
                alert('Request Sent!');
                setStartTime(null);
                setEndTime(null);
                // Refresh requests list explicitly as a fallback
                const fallbackFetch = async () => {
                    const { data: newRequests } = await supabase
                        .from('requests')
                        .select('*')
                        .eq('user_id', profile.id)
                        .order('start_time', { ascending: true });
                    if (newRequests) setRequests(newRequests);
                };
                fallbackFetch();

                // Instantly inject into allRequests to guarantee immediate visual shading updates for local user
                setAllRequests(prev => [...prev, {
                    user_id: profile.id,
                    start_time: `${selectedDate} ${startTime}`,
                    end_time: `${selectedDate} ${endTime}`,
                    status: 'pending',
                    move_status: 'none'
                }]);
            } else {
                console.error("Booking error:", error);
                alert(`Booking couldn't be processed: ${error.message}`);
            }
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return 'bg-green-100 text-green-700 border-green-200';
            case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        }
    };

    if (!profile) return <div className="p-10">Loading Dashboard...</div>;

    const days = getDaysInMonth(currentMonth);
    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const handleDeclineProposal = async (reqId: string) => {
        if (!confirm("Decline this time change?")) return;

        await supabase.from('requests').update({
            status: 'pending',
            move_status: 'rejected',
            proposed_start: null,
            proposed_end: null
        }).eq('id', reqId);
        // Realtime will update list
    };

    const handleAcceptProposal = async (reqId: string, pStart: string, pEnd: string) => {
        if (!confirm("Accept this new time?")) return;

        await supabase.from('requests').update({
            start_time: pStart,
            end_time: pEnd,
            move_status: 'none', // Reset status
            proposed_start: null,
            proposed_end: null
        }).eq('id', reqId);
        // Realtime will update list
    };





    return (
        <div className="min-h-screen bg-gray-50 p-6 relative" onClick={() => setShowActions(false)}>

            {/* NOTIFICATION CENTER (Top Right) */}
            {pendingProposals.length > 0 && (
                <div className="fixed top-6 right-6 z-50">
                    <div className="bg-white rounded-xl shadow-xl p-4 border border-blue-100 max-w-sm animate-fade-in-down">
                        <div className="flex items-center gap-2 mb-3 text-blue-800 font-bold border-b border-gray-100 pb-2">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                            Reschedule Requests
                        </div>
                        <div className="space-y-3">
                            {pendingProposals.map(p => (
                                <div key={p.id} className="bg-blue-50 p-3 rounded-lg text-sm">
                                    <p className="text-gray-700 mb-1">
                                        Proposed change for <strong>{new Date(p.start_time).toLocaleDateString()}</strong>:
                                    </p>
                                    <div className="flex items-center justify-between bg-white p-2 rounded border border-blue-100 mb-2">
                                        <span className="text-gray-500 line-through text-xs">
                                            {new Date(p.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                        </span>
                                        <span className="text-gray-400">→</span>
                                        <span className="text-blue-700 font-bold">
                                            {new Date(p.proposed_start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleAcceptProposal(p.id, p.proposed_start, p.proposed_end)}
                                            className="flex-1 bg-green-500 text-white py-1 rounded hover:bg-green-600 font-bold text-xs"
                                        >
                                            Accept
                                        </button>
                                        <button
                                            onClick={() => handleDeclineProposal(p.id)}
                                            className="flex-1 bg-gray-200 text-gray-700 py-1 rounded hover:bg-gray-300 font-bold text-xs"
                                        >
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 1. WELCOME HEADER */}
            <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-blue-900">
                        Welcome back, {profile.full_name?.split(' ')[0]}!
                    </h1>
                    <p className="text-gray-600 mt-1">You've been consistent for 3 weeks straight.</p>
                </div>
                <div className="mt-4 md:mt-0 relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
                        className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold shadow hover:bg-blue-700 transition flex items-center gap-2"
                    >
                        Actions ▾
                    </button>

                    {showActions && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-blue-100 overflow-hidden z-20 animate-fade-in-up">
                            <Link href="/measurements">
                                <button className="cursor-pointer w-full text-left px-4 py-3 hover:bg-blue-50 text-gray-700 font-medium transition flex items-center gap-2 border-b border-gray-100">
                                    📏 Log Stats
                                </button>
                            </Link>
                            <button className="cursor-pointer w-full text-left px-4 py-3 hover:bg-blue-50 text-gray-700 font-medium transition flex items-center gap-2 border-b border-gray-100">
                                👤 Update Profile
                            </button>
                            <button className="cursor-pointer w-full text-left px-4 py-3 hover:bg-blue-50 font-medium transition flex items-center gap-2 text-red-500">
                                📞 Support
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* DASHBOARD GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT COLUMN (2/3 Width) */}
                <div className="lg:col-span-2 space-y-8">

                    {/* 2. CAROUSEL WIDGET AREA (Progress & Next Sessions) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden min-h-[360px] flex flex-col">

                        {/* Header & Controls */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-800 transition-all duration-300">
                                {slides[currentSlide].title}
                            </h3>
                            <div className="flex items-center gap-2">
                                <button onClick={prevSlide} className="cursor-pointer p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-blue-600 transition">
                                    ←
                                </button>
                                <div className="flex gap-1">
                                    {slides.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={`h-2 w-2 rounded-full transition-all duration-300 ${currentSlide === idx ? 'bg-blue-600 w-4' : 'bg-gray-200'}`}
                                        />
                                    ))}
                                </div>
                                <button onClick={nextSlide} className="cursor-pointer p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-blue-600 transition">
                                    →
                                </button>
                            </div>
                        </div>

                        {/* Slide Content Container */}
                        <div className="relative flex-1">

                            {/* SLIDE 1: PROGRESS */}
                            <div className={`transition-opacity duration-500 absolute inset-0 ${currentSlide === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                                <div className="h-full flex flex-col">
                                    <div className="flex-1 bg-blue-50 rounded-xl flex items-center justify-center text-blue-400 mb-4 border border-dashed border-blue-200">
                                        [Graph Component Will Go Here]
                                    </div>
                                    <div className="flex gap-4 text-sm mt-auto">
                                        <span className="text-green-600 font-bold">▼ 4cm Down</span>
                                        <span className="text-gray-500">Since last month</span>
                                    </div>
                                </div>
                            </div>

                            {/* SLIDE 2: UPCOMING SESSIONS */}
                            <div className={`transition-opacity duration-500 absolute inset-0 ${currentSlide === 1 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                                <div className="h-full overflow-y-auto pr-1">
                                    {upcomingSessions.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                            <p>No upcoming confirmed sessions.</p>
                                            <button
                                                onClick={() => {
                                                    const calendarElement = document.getElementById('booking-calendar');
                                                    if (calendarElement) calendarElement.scrollIntoView({ behavior: 'smooth' });
                                                }}
                                                className="mt-2 text-blue-600 hover:underline text-sm"
                                            >
                                                Book one below!
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {upcomingSessions.map(session => (
                                                <div
                                                    key={session.id}
                                                    onClick={() => setSelectedSessionView(session)}
                                                    className="bg-linear-to-br from-blue-500 to-blue-600 text-white p-4 rounded-xl shadow-md transform transition hover:scale-[1.02] cursor-pointer"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-medium">Confirmed</span>
                                                        <span className="text-2xl opacity-50">🏋️</span>
                                                    </div>
                                                    <p className="text-lg font-bold">
                                                        {new Date(session.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                                    </p>
                                                    <p className="text-blue-100 font-mono text-sm mt-1">
                                                        {new Date(session.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                                        {' - '}
                                                        {new Date(session.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* 3. YOUR REQUESTS */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Session Requests</h3>
                        {requests.length === 0 ? (
                            <p className="text-gray-500 italic">No bookings yet. Pick a time on the calendar!</p>
                        ) : (
                            <div className="space-y-3">
                                {requests.map((req) => (
                                    <div key={req.id} className="flex flex-col p-3 rounded-lg bg-gray-50 border border-gray-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-700">
                                                    {new Date(req.start_time).toLocaleDateString('en-US', {
                                                        weekday: 'short', month: 'short', day: 'numeric'
                                                    })}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {new Date(req.start_time).toLocaleTimeString('en-US', {
                                                        hour: 'numeric', minute: '2-digit'
                                                    })}
                                                    {' - '}
                                                    {new Date(req.end_time).toLocaleTimeString('en-US', {
                                                        hour: 'numeric', minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(req.status)} uppercase tracking-wide`}>
                                                {req.status}
                                            </span>
                                        </div>
                                        {req.status === 'pending' && req.move_status === 'rejected' && (
                                            <div className="mt-1 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
                                                Time change declined. The coach has been notified. You can wait for their response or book a different slot.
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 4. TRAINER NOTES */}
                    <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-100 relative">
                        <div className="absolute top-4 right-4 text-yellow-400 text-4xl opacity-20">❝</div>
                        <h3 className="text-lg font-bold text-yellow-800 mb-2">Note from Chacha:</h3>
                        <p className="text-yellow-900 italic">
                            "Great energy on Tuesday! Let's focus on your form for the squats next time.
                            Don't forget to stretch your hamstrings."
                        </p>
                    </div>

                </div>

                {/* RIGHT COLUMN (1/3 Width) */}
                <div className="space-y-8">

                    {/* 5. BOOKING WIDGET */}
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                        <h3 className="text-xl font-bold text-blue-900 mb-4">Book Next Session</h3>

                        <div className="flex items-center justify-between mb-4">
                            <button onClick={() => changeMonth(-1)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">←</button>
                            <span className="font-bold text-lg text-gray-800">{monthName}</span>
                            <button onClick={() => changeMonth(1)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">→</button>
                        </div>

                        <div className="grid grid-cols-7 text-center mb-2">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                                <div key={d} className="text-xs font-semibold text-gray-400">{d}</div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1 mb-6">
                            {days.map((date, idx) => {
                                if (!date) return <div key={idx} />;
                                const dateStr = date.toLocaleDateString('en-CA');
                                const isSelected = selectedDate === dateStr;
                                const isToday = new Date().toDateString() === date.toDateString();

                                const todayDate = new Date();
                                todayDate.setHours(0, 0, 0, 0);
                                const isPast = date < todayDate;

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => !isPast && handleDateClick(date)}
                                        disabled={isPast}
                                        className={`
                                            h-10 w-full rounded-lg flex items-center justify-center text-sm font-medium transition
                                            ${isPast ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50' :
                                                isSelected ? 'bg-blue-600 text-white shadow-md scale-105 cursor-pointer' : 'hover:bg-blue-50 text-gray-700 cursor-pointer'}
                                            ${isToday ? 'border-2 border-blue-200' : ''}
                                        `}
                                    >
                                        {date.getDate()}
                                    </button>
                                );
                            })}
                        </div>

                        {selectedDate ? (
                            <div className="space-y-4 animate-fade-in-up">
                                <p className="text-sm font-semibold text-gray-500">
                                    {startTime && endTime
                                        ? `Selected: ${startTime} - ${endTime}`
                                        : "Select a Session Block"}
                                </p>
                                <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200">
                                    {availableSlots.map((slotObj) => {
                                        const isSelected = slotObj.timeString === startTime;

                                        let bgClass = "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50";
                                        if (slotObj.isPast) {
                                            bgClass = "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200 opacity-50";
                                        } else if (slotObj.hasMyRequest) {
                                            bgClass = "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200 opacity-75";
                                        } else if (isSelected) {
                                            bgClass = "bg-blue-600 text-white border-blue-600 shadow-lg transform scale-105";
                                        } else if (slotObj.demandCount > 0) {
                                            if (slotObj.demandCount <= 2) bgClass = "bg-green-100 text-green-900 border-green-300 hover:bg-green-200 shadow-inner";
                                            else if (slotObj.demandCount <= 5) bgClass = "bg-yellow-100 text-yellow-900 border-yellow-300 hover:bg-yellow-200 shadow-inner";
                                            else bgClass = "bg-red-100 text-red-900 border-red-300 hover:bg-red-200 shadow-inner";
                                        }

                                        const isDisabled = slotObj.hasMyRequest || slotObj.isPast;

                                        return (
                                            <button
                                                key={slotObj.timeString}
                                                onClick={() => !isDisabled && handleTimeClick(slotObj.timeString)}
                                                disabled={isDisabled}
                                                className={`cursor-pointer py-3 px-2 rounded-xl text-sm font-semibold transition border ${bgClass}`}
                                            >
                                                {slotObj.timeString}
                                            </button>
                                        );
                                    })}
                                </div>

                                {startTime && endTime && (
                                    <button
                                        onClick={confirmBooking}
                                        className="cursor-pointer w-full py-3 rounded-xl bg-green-500 text-white font-bold shadow-lg hover:bg-green-600 transition animate-bounce-in"
                                    >
                                        Confirm Booking
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-400 text-sm">
                                Select a date to see available times.
                            </div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h3>
                        <div className="flex flex-col gap-3">
                            <button className="cursor-pointer w-full text-left p-3 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition flex items-center gap-3">
                                👤 Update Profile
                            </button>
                            <button className="cursor-pointer w-full text-left p-3 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition flex items-center gap-3">
                                📞 Call Chacha (Support)
                            </button>
                        </div>
                    </div>

                </div>
            </div>

            {/* SESSION DETAILS MODAL */}
            {selectedSessionView && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fade-in-up">
                        <div className="text-center mb-6">
                            <span className="text-4xl">🏋️</span>
                            <h2 className="text-2xl font-extrabold text-blue-900 mt-2">Session Details</h2>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">Time & Date</p>
                                <p className="text-gray-800 font-medium">
                                    {new Date(selectedSessionView.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </p>
                                <p className="text-gray-600">
                                    {new Date(selectedSessionView.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                    {' - '}
                                    {new Date(selectedSessionView.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </p>
                            </div>

                            {selectedSessionView.notes ? (
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 relative">
                                    <p className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-1">Trainer Notes</p>
                                    <p className="text-blue-900 italic">"{selectedSessionView.notes}"</p>
                                </div>
                            ) : (
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 relative">
                                    <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">Trainer Notes</p>
                                    <p className="text-gray-500 italic">No notes added yet.</p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setSelectedSessionView(null)}
                            className="bg-blue-600 text-white font-medium py-2.5 px-6 rounded-lg shadow hover:bg-blue-700 transition block mx-auto"
                        >
                            Back
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}