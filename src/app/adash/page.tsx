'use client';

import { useState, useEffect, MouseEvent } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
    const router = useRouter();
    const supabase = createClient();
    const [requests, setRequests] = useState<any[]>([]);
    const [blockedTime, setBlockedTime] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Week Navigation State
    const [currentWeekStart, setCurrentWeekStart] = useState(getMonday(new Date()));

    const goToPrevWeek = () => {
        setCurrentWeekStart(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() - 7);
            return d;
        });
    };

    const goToNextWeek = () => {
        setCurrentWeekStart(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() + 7);
            return d;
        });
    };

    const goToCurrentWeek = () => {
        setCurrentWeekStart(getMonday(new Date()));
    };

    // Generate Days for Header
    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(currentWeekStart);
        d.setDate(currentWeekStart.getDate() + i);
        weekDays.push(d);
    }

    // --- INTERACTION STATE ---
    const [selectedSession, setSelectedSession] = useState<any>(null); // For Modal
    const [notesInput, setNotesInput] = useState("");
    const [isSavingNotes, setIsSavingNotes] = useState(false);

    useEffect(() => {
        if (selectedSession) {
            setNotesInput(selectedSession.notes || "");
        }
    }, [selectedSession]);
    const [selection, setSelection] = useState<{ start: Date | null, end: Date | null } | null>(null); // For Dragging (Blocking)
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ dayIndex: number, hour: number } | null>(null);

    // Request Dragging State
    const [isDraggingRequest, setIsDraggingRequest] = useState(false);
    const [dragRequest, setDragRequest] = useState<any>(null); // The original request being moved
    const [dragRequestNewStart, setDragRequestNewStart] = useState<Date | null>(null); // Where it's visually at

    // Fetch Data
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch Requests (Filter out past sessions based on end_time)
            const { data: reqs, error: reqError } = await supabase
                .from('requests')
                .select('*, profiles(full_name, phone, fitness_goals)')
                .gte('end_time', new Date().toISOString())
                .order('created_at', { ascending: false });

            if (reqError) throw reqError;
            if (reqs) setRequests(reqs);

            // 2. Fetch Blocked Time
            const { data: blocks, error: blockError } = await supabase
                .from('blocked_time')
                .select('*');

            if (blockError) throw blockError;
            if (blocks) setBlockedTime(blocks);
        } catch (err: any) {
            console.error("Dashboard Fetch Error:", err);
            setError(err.message || "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Helper: Get Monday of current week
    function getMonday(d: Date) {
        d = new Date(d);
        var day = d.getDay(),
            diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0); // Normalize to midnight
        return d;
    }

    // --- ACTIONS ---

    // 1. Manage Requests (Inbox)
    const handleAction = async (id: string, status: 'confirmed' | 'rejected') => {
        await supabase.from('requests').update({ status }).eq('id', id);
        fetchData(); // Refresh
    };

    // 2. Manage Session (Modal)
    const handleCancelSession = async () => {
        if (!selectedSession) return;
        if (confirm("Are you sure you want to cancel this session?")) {
            await supabase.from('requests').update({ status: 'rejected' }).eq('id', selectedSession.id);
            setSelectedSession(null);
            fetchData();
        }
    };

    const handleSaveNotes = async () => {
        if (!selectedSession) return;
        setIsSavingNotes(true);
        await supabase.from('requests').update({ notes: notesInput }).eq('id', selectedSession.id);
        
        setSelectedSession({ ...selectedSession, notes: notesInput });
        fetchData();
        setIsSavingNotes(false);
    };

    // 3A. Block Time (Drag Logic) - EXISTING
    const handleMouseDown = (e: MouseEvent, dayIndex: number) => {
        if (isDraggingRequest) return; // Priority to request dragging
        e.preventDefault();
        // ... (existing logic)
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const hourOffset = y / 64;
        const hour = 6 + hourOffset;

        setDragStart({ dayIndex, hour });
        setIsDragging(true);
    };

    // 3B. Move Request (Drag Logic) - NEW
    const handleRequestMouseDown = (e: MouseEvent, req: any) => {
        e.stopPropagation(); // Don't trigger block creation
        e.preventDefault();
        setDragRequest(req);
        setIsDraggingRequest(true);
    };

    const handleMouseMove = (e: MouseEvent, dayIndex: number) => {
        // A. Handling Block Creation Drag
        if (isDragging && dragStart) {
            if (dragStart.dayIndex !== dayIndex) return;
            // ... existing logic ...
            if (!weekDays[dayIndex]) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const hourOffset = y / 64;
            const currentHour = 6 + hourOffset;

            const startH = Math.min(dragStart.hour, currentHour);
            const endH = Math.max(dragStart.hour, currentHour);

            const d = new Date(weekDays[dayIndex]);
            d.setHours(Math.floor(startH), (startH % 1) * 60, 0, 0);

            const eDate = new Date(weekDays[dayIndex]);
            eDate.setHours(Math.floor(endH), (endH % 1) * 60, 0, 0);

            setSelection({ start: d, end: eDate });
            return;
        }

        // B. Handling Request Move Drag
        if (isDraggingRequest && dragRequest) {
            if (!weekDays[dayIndex]) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const hourOffset = y / 64; // e.g., 9.5 for 9:30
            const currentHour = 6 + hourOffset;

            // Snap to nearest hour (floor)
            const snappedHour = Math.floor(currentHour);

            // Construct new start time for ghost
            const newStart = new Date(weekDays[dayIndex]);
            newStart.setHours(snappedHour, 0, 0, 0);

            setDragRequestNewStart(newStart);
        }
    };


    const handleMouseUp = async () => {
        // A. End Block Creation
        if (isDragging) {
            if (!selection?.start || !selection?.end) {
                setIsDragging(false);
                setSelection(null);
                setDragStart(null);
                return;
            }

            const durationMins = (selection.end.getTime() - selection.start.getTime()) / (1000 * 60);
            if (durationMins < 10) {
                setIsDragging(false);
                setSelection(null);
                setDragStart(null);
                return;
            }

            const reason = prompt("Reason for blocking this time?", "Lunch");

            if (reason) {
                await supabase.from('blocked_time').insert([{
                    start_time: selection.start.toISOString(),
                    end_time: selection.end.toISOString(),
                    reason
                }]);
                fetchData();
            }

            setIsDragging(false);
            setSelection(null);
            setDragStart(null);
            return;
        }

        // B. End Request Move
        if (isDraggingRequest) {
            if (dragRequest && dragRequestNewStart) {
                // Confirm move
                if (confirm(`Propose moving session to ${dragRequestNewStart.toLocaleString()}?`)) {
                    // Calculate end time (duration must matching original)
                    const durationMs = new Date(dragRequest.end_time).getTime() - new Date(dragRequest.start_time).getTime();
                    const newEnd = new Date(dragRequestNewStart.getTime() + durationMs);

                    await supabase.from('requests').update({
                        proposed_start: dragRequestNewStart.toISOString(),
                        proposed_end: newEnd.toISOString(),
                        move_status: 'pending'
                    }).eq('id', dragRequest.id);

                    fetchData();
                }
            }
            setIsDraggingRequest(false);
            setDragRequest(null);
            setDragRequestNewStart(null);
        }
    };


    if (loading) return <div className="p-10">Loading Admin Dashboard...</div>;
    if (error) return (
        <div className="p-10">
            <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
                <h3 className="font-bold">Error Loading Dashboard</h3>
                <p>{error}</p>
                <button onClick={fetchData} className="cursor-pointer mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 rounded text-sm font-semibold transition">
                    Retry
                </button>
            </div>
        </div>
    );

    const pendingRequests = requests.filter(r => r.status === 'pending');
    const confirmedRequests = requests.filter(r => r.status === 'confirmed');

    return (
        <div className="min-h-screen bg-gray-100 p-6 flex flex-col gap-6" onMouseUp={handleMouseUp} onMouseLeave={() => { setIsDragging(false); setIsDraggingRequest(false); }}>

            {/* TOP BAR */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-black text-gray-800">Admin Dashboard</h1>
                    <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1">
                        <button onClick={goToPrevWeek} className="cursor-pointer p-1 px-3 hover:bg-white hover:shadow-sm rounded-md transition text-sm font-bold text-gray-600">&lt;</button>
                        <span className="text-sm font-bold px-2 text-gray-700 w-32 text-center">
                            {currentWeekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                        <button onClick={goToNextWeek} className="cursor-pointer p-1 px-3 hover:bg-white hover:shadow-sm rounded-md transition text-sm font-bold text-gray-600">&gt;</button>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={goToCurrentWeek} className="cursor-pointer px-4 py-2 bg-gray-50 border border-gray-200 text-gray-600 text-sm font-bold rounded-lg hover:bg-gray-100 transition">This Week</button>
                    <button onClick={fetchData} className="cursor-pointer px-4 py-2 bg-blue-100 text-blue-800 text-sm font-bold rounded-lg hover:bg-blue-200 transition">↻ Refresh</button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">

                {/* LEFT COLUMN: INBOX (Fixed width) */}
                <div className="w-full lg:w-96 bg-white rounded-xl shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <h2 className="font-bold text-gray-700 flex items-center justify-between">
                            Request Inbox
                            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">{pendingRequests.length}</span>
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {pendingRequests.length === 0 && (
                            <p className="text-center text-gray-400 text-sm py-10">All caught up! 🎉</p>
                        )}
                        {pendingRequests.map(req => (
                            <div key={req.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition bg-white">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-bold text-gray-900">{req.profiles?.full_name || 'Unknown User'}</h3>
                                        <p className="text-xs text-gray-500">{req.profiles?.fitness_goals || 'No goals set'}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-blue-600">
                                            {new Date(req.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {new Date(req.start_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </div>
                                    </div>
                                </div>
                                {req.notes && (
                                    <div className="text-xs text-gray-500 italic mb-2">"{req.notes}"</div>
                                )}
                                <div className="grid grid-cols-2 gap-2 mt-3">
                                    <button
                                        onClick={() => handleAction(req.id, 'rejected')}
                                        className="py-1.5 text-xs font-bold text-red-600 bg-red-50 rounded hover:bg-red-100"
                                    >
                                        Decline
                                    </button>
                                    <button
                                        onClick={() => handleAction(req.id, 'confirmed')}
                                        className="py-1.5 text-xs font-bold text-green-600 bg-green-50 rounded hover:bg-green-100"
                                    >
                                        Approve
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT COLUMN: WEEKLY SCHEDULE (Flexible) */}
                <div className="flex-1 bg-white rounded-xl shadow-sm flex flex-col overflow-hidden relative select-none">
                    {/* Header: Days */}
                    <div className="grid grid-cols-7 border-b border-gray-200 text-center bg-gray-50">
                        {weekDays.map((d, i) => (
                            <div key={i} className={`p-2 border-r border-gray-100 ${i === 6 ? 'border-none' : ''} ${d.getDate() === new Date().getDate() ? 'bg-blue-50 text-blue-600 font-bold' : ''}`}>
                                <div className="text-xs uppercase text-gray-500">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                <div className="text-lg font-bold text-gray-800">{d.getDate()}</div>
                            </div>
                        ))}
                    </div>

                    {/* Schedule Grid */}
                    <div className="flex-1 overflow-y-auto bg-gray-50 cursor-default">
                        <div className="relative h-[1024px] min-w-[700px] bg-white">
                            {/* Background Grid Lines (6am - 10pm) */}
                            <div className="absolute inset-0 flex flex-col pointer-events-none">
                                {Array.from({ length: 16 }).map((_, i) => (
                                    <div key={i} className="border-b border-gray-100 h-16 box-border relative w-full">
                                        <span className="absolute left-2 -top-2.5 text-xs font-bold text-gray-400 bg-white px-2 rounded">
                                            {i + 6}:00
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Working Hours Background & Interaction Layer */}
                            <div className="grid grid-cols-7 absolute inset-0">
                                {weekDays.map((d, colIndex) => (
                                    <div
                                        key={colIndex}
                                        className="border-r border-dashed border-gray-200 h-full relative group"
                                        onMouseDown={(e) => handleMouseDown(e, colIndex)}
                                        // onMouseUp should be handled globally or here. Global is safer for drag ending outside
                                        onMouseMove={(e) => handleMouseMove(e, colIndex)}
                                    >
                                        {/* Hover hint */}
                                        {/* <div className="hidden group-hover:block absolute top-0 left-0 bg-blue-500 w-1 h-full opacity-20 pointer-events-none"></div> */}
                                    </div>
                                ))}
                            </div>

                            {/* OVERLAYS: Bookings & Blocks & Selection */}

                            {/* 0. Drag Selection Preview (Gray) */}
                            {selection && selection.start && selection.end && (
                                <div
                                    className="absolute bg-gray-400 opacity-30 pointer-events-none border border-gray-600 z-20"
                                    style={{
                                        left: `${(Math.floor((selection!.start!.getTime() - currentWeekStart.getTime()) / (1000 * 60 * 60 * 24))) * (100 / 7)}%`,
                                        width: `${100 / 7}%`,
                                        top: `${(selection!.start!.getHours() + selection!.start!.getMinutes() / 60 - 6) * 64}px`,
                                        height: `${((selection!.end!.getTime() - selection!.start!.getTime()) / (1000 * 60 * 60)) * 64}px`
                                    }}
                                />
                            )}

                            {/* 0.5 Drag Request Preview (Yellow Ghost) */}
                            {isDraggingRequest && dragRequestNewStart && dragRequest && (
                                <div
                                    className="absolute bg-yellow-400 opacity-50 pointer-events-none border-2 border-yellow-600 z-30 rounded shadow-xl left-0"
                                    style={{
                                        left: `${(Math.floor((dragRequestNewStart.getTime() - currentWeekStart.getTime()) / (1000 * 60 * 60 * 24))) * (100 / 7)}%`,
                                        width: `${100 / 7}%`,
                                        top: `${(dragRequestNewStart.getHours() - 6) * 64}px`,
                                        height: `${((new Date(dragRequest.end_time).getTime() - new Date(dragRequest.start_time).getTime()) / (1000 * 60 * 60)) * 64}px`
                                    }}
                                >
                                    <div className="p-1 text-xs font-bold text-yellow-900">Moving...</div>
                                </div>
                            )}

                            {/* 1. Confirmed Bookings (Blue) */}
                            {confirmedRequests.map(req => {
                                const start = req.move_status === 'pending' ? new Date(req.proposed_start) : new Date(req.start_time);
                                const end = req.move_status === 'pending' ? new Date(req.proposed_end) : new Date(req.end_time);

                                const dayDiff = Math.floor((start.getTime() - currentWeekStart.getTime()) / (1000 * 60 * 60 * 24));
                                if (dayDiff < 0 || dayDiff > 6) return null;

                                const startHour = start.getHours() + start.getMinutes() / 60;
                                const endHour = end.getHours() + end.getMinutes() / 60;

                                const top = (startHour - 6) * 64;
                                const height = (endHour - startHour) * 64;
                                const left = `${(dayDiff) * (100 / 7)}%`;
                                const width = `${100 / 7}%`;

                                // Visuals based on status
                                const isPending = req.move_status === 'pending';
                                const isRejected = req.move_status === 'rejected';

                                let bgClass = "bg-blue-500 hover:bg-blue-600 border-blue-600";
                                if (isPending) bgClass = "bg-yellow-400 hover:bg-yellow-500 border-yellow-600 text-yellow-900";
                                if (isRejected) bgClass = "bg-red-500 hover:bg-red-600 border-red-700";

                                return (
                                    <div
                                        key={req.id}
                                        className={`absolute rounded p-1 text-xs overflow-hidden transition cursor-grab active:cursor-grabbing z-10 shadow-md border ${bgClass} text-white`}
                                        style={{ top: `${top}px`, height: `${height}px`, left, width: `calc(${width} - 4px)`, marginLeft: '2px' }}
                                        title={`${req.profiles?.full_name} (${req.status})`}
                                        onClick={(e) => { e.stopPropagation(); setSelectedSession(req); }}
                                        onMouseDown={(e) => handleRequestMouseDown(e, req)}
                                    >
                                        <div className="font-bold truncate">
                                            {req.profiles?.full_name}
                                            {isPending && " (Pending Move)"}
                                            {isRejected && " (Move Rejected!)"}
                                        </div>
                                        <div className="opacity-80 truncate text-[10px]">
                                            {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* 2. Blocked Time (Red Hashed) */}
                            {blockedTime.map(block => {
                                const start = new Date(block.start_time);
                                const end = new Date(block.end_time);

                                const dayDiff = Math.floor((start.getTime() - currentWeekStart.getTime()) / (1000 * 60 * 60 * 24));
                                if (dayDiff < 0 || dayDiff > 6) return null;

                                const startHour = start.getHours() + start.getMinutes() / 60;
                                const endHour = end.getHours() + end.getMinutes() / 60;

                                const top = (startHour - 6) * 64;
                                const height = (endHour - startHour) * 64;
                                const left = `${(dayDiff) * (100 / 7)}%`;
                                const width = `${100 / 7}%`;

                                return (
                                    <div
                                        key={block.id}
                                        className="absolute bg-red-100 border border-red-200 text-red-800 rounded p-1 text-xs overflow-hidden cursor-not-allowed z-0"
                                        style={{
                                            top: `${top}px`,
                                            height: `${height}px`,
                                            left,
                                            width: `calc(${width} - 4px)`,
                                            marginLeft: '2px',
                                            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,0,0,0.05) 5px, rgba(255,0,0,0.05) 10px)'
                                        }}
                                    >
                                        <div className="font-bold truncate opacity-50">BLOCKED</div>
                                        <div className="opacity-50 text-[10px] truncate">{block.reason}</div>
                                    </div>
                                );
                            })}

                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL: Manage Session */}
            {selectedSession && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-2xl shadow-xl w-96 animate-fade-in-up">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Manage Session</h3>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Client</label>
                                <p className="text-lg font-medium text-gray-900">{selectedSession.profiles?.full_name}</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Time</label>
                                <p className="text-md text-gray-700">
                                    {new Date(selectedSession.start_time).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                                    <br />
                                    {new Date(selectedSession.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {new Date(selectedSession.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Phone</label>
                                <p className="text-md text-gray-700">{selectedSession.profiles?.phone || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Goals</label>
                                <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{selectedSession.profiles?.fitness_goals || 'None'}</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Trainer Notes for Session</label>
                                <textarea
                                    value={notesInput}
                                    onChange={(e) => setNotesInput(e.target.value)}
                                    placeholder="Add notes for this session..."
                                    className="w-full text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1 min-h-[80px]"
                                />
                                <button
                                    onClick={handleSaveNotes}
                                    disabled={isSavingNotes || notesInput === (selectedSession.notes || "")}
                                    className={`cursor-pointer mt-2 w-full py-2 font-bold rounded-lg transition text-sm
                                        ${isSavingNotes 
                                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                                            : notesInput === (selectedSession.notes || "")
                                                ? 'bg-gray-100 text-gray-400'
                                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200 shadow-sm'}
                                    `}
                                >
                                    {isSavingNotes ? "Saving..." : notesInput === (selectedSession.notes || "") ? "Notes Saved" : "Save Notes"}
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleCancelSession}
                                className="cursor-pointer flex-1 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition"
                            >
                                Cancel Booking
                            </button>
                            <button
                                onClick={() => setSelectedSession(null)}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
