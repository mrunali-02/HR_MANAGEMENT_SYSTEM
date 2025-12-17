import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';

const CalendarView = ({ attendance = [], holidays = [], onDateClick, role, calendarStats, onMonthChange }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDayDetails, setSelectedDayDetails] = useState(null);

    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year, month) => {
        return new Date(year, month, 1).getDay();
    };

    const handlePrevMonth = () => {
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
        setCurrentDate(newDate);
        if (onMonthChange) onMonthChange(newDate.getMonth() + 1, newDate.getFullYear());
    };

    const handleNextMonth = () => {
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1);
        setCurrentDate(newDate);
        if (onMonthChange) onMonthChange(newDate.getMonth() + 1, newDate.getFullYear());
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const monthName = currentDate.toLocaleString('default', { month: 'long' });

    // Map data for quick lookup
    const attendanceMap = {};
    attendance.forEach(a => {
        attendanceMap[a.date] = a.status; // 'present', 'absent', etc.
    });

    const holidayMap = {};
    holidays.forEach(h => {
        let dateKey = h.date;
        if (typeof h.date === 'string') {
            // Create date object and extract local YYYY-MM-DD
            const d = new Date(h.date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dateKey = `${year}-${month}-${day}`;
        }
        holidayMap[dateKey] = h.name;
    });

    const renderDays = () => {
        const days = [];
        // Empty cells for padding
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50/50 border border-gray-100"></div>);
        }

        const today = new Date().toISOString().split('T')[0];
        const isAdminOrHr = role === 'admin' || role === 'hr';

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const status = attendanceMap[dateStr];
            const isHoliday = holidayMap[dateStr];
            const dateObj = new Date(year, month, d);
            const dayOfWeek = dateObj.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 0=Sun, 6=Sat
            const isToday = dateStr === today;
            const stats = calendarStats && calendarStats[dateStr];

            let bgColor = 'bg-white';
            if (isHoliday) bgColor = 'bg-gray-300';
            else if (isWeekend) bgColor = 'bg-gray-200';
            else if (!isAdminOrHr) {
                // Regular user coloring logic
                if (status === 'present' || status === 'remote') bgColor = 'bg-green-100';
                else if (status === 'absent') bgColor = 'bg-red-100';
                else if (['casual', 'sick', 'earned', 'paid'].includes(status)) bgColor = 'bg-yellow-100';
            }

            days.push(
                <div
                    key={d}
                    onClick={() => {
                        if (onDateClick) onDateClick(dateStr, isHoliday);
                    }}
                    className={`h-24 border border-gray-100 p-2 relative transition hover:shadow-md ${bgColor} ${(onDateClick || (isAdminOrHr && stats)) ? 'cursor-pointer hover:bg-opacity-80' : ''}`}
                >
                    <div className={`flex justify-between items-start`}>
                        <span className={`text-sm font-semibold ${isToday ? 'bg-indigo-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-gray-700'}`}>
                            {d}
                        </span>
                    </div>

                    <div className="mt-1 text-xs space-y-1">
                        {isHoliday ? (
                            <div className="font-bold text-gray-600 truncate">{isHoliday}</div>
                        ) : isAdminOrHr && stats ? (
                            <>
                                {stats.present?.length > 0 && (
                                    <div
                                        className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 rounded px-1 -ml-1 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedDayDetails({ date: dateStr, ...stats });
                                        }}
                                        title="View Present Details"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                        <span className="text-[10px] text-gray-700 font-medium hover:underline">{stats.present.length} Present</span>
                                    </div>
                                )}
                                {stats.leave?.length > 0 && (
                                    <div
                                        className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 rounded px-1 -ml-1 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedDayDetails({ date: dateStr, ...stats });
                                        }}
                                        title="View Leave Details"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                                        <span className="text-[10px] text-gray-700 font-medium hover:underline">{stats.leave.length} On Leave</span>
                                    </div>
                                )}
                                {stats.absent?.length > 0 && (
                                    <div
                                        className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 rounded px-1 -ml-1 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedDayDetails({ date: dateStr, ...stats });
                                        }}
                                        title="View Absent Details"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                        <span className="text-[10px] text-gray-700 font-medium hover:underline">{stats.absent.length} Absent</span>
                                    </div>
                                )}
                            </>
                        ) : (
                            // Regular user view
                            status && <div className="capitalize font-medium truncate text-gray-700">{status}</div>
                        )}
                    </div>
                </div>
            );
        }
        return days;
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">{monthName} {year}</h2>
                <div className="flex space-x-2">
                    <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-200 text-gray-600">
                        <ChevronLeft size={20} />
                    </button>
                    <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-200 text-gray-600">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Weekday Labels */}
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-500 text-center py-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day}>{day}</div>
                ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7">
                {renderDays()}
            </div>

            {/* Legend */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-4 text-xs">
                {role === 'employee' ? (
                    <>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-green-100 border border-green-200 block"></span> Present
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-red-100 border border-red-200 block"></span> Absent
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-yellow-100 border border-yellow-200 block"></span> Leave
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Present Count
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Absent Count
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div> Leave Count
                        </div>
                    </>
                )}
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-gray-300 border border-gray-400 block"></span> Holiday
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-gray-200 border border-gray-300 block"></span> Weekend
                </div>
                {role && (role === 'admin' || role === 'hr') && (
                    <div className="ml-auto text-gray-500 italic">
                        * Click on a date to toggle Holiday or View Details
                    </div>
                )}
            </div>

            {/* Details Modal */}
            {selectedDayDetails && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="flex justify-between items-center mb-4 p-4 border-b">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Details for {formatDate(selectedDayDetails.date)}
                            </h3>
                            <button
                                onClick={() => setSelectedDayDetails(null)}
                                className="text-gray-400 hover:text-gray-500"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-4">
                            {/* Present */}
                            <div>
                                <h4 className="text-sm font-bold text-green-700 mb-2 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Present ({selectedDayDetails.present?.length || 0})
                                </h4>
                                <div className="pl-4">
                                    {selectedDayDetails.present?.length > 0 ? (
                                        <ul className="list-disc text-sm text-gray-600">
                                            {selectedDayDetails.present.map((name, i) => <li key={i}>{name}</li>)}
                                        </ul>
                                    ) : <p className="text-xs text-gray-400 italic">No one present</p>}
                                </div>
                            </div>

                            {/* Leaves */}
                            <div>
                                <h4 className="text-sm font-bold text-yellow-700 mb-2 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div> On Leave ({selectedDayDetails.leave?.length || 0})
                                </h4>
                                <div className="pl-4">
                                    {selectedDayDetails.leave?.length > 0 ? (
                                        <ul className="list-disc text-sm text-gray-600">
                                            {selectedDayDetails.leave.map((l, i) => (
                                                <li key={i}>
                                                    <span className="font-medium">{l.name}</span> <span className="text-xs text-gray-400">({l.type})</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : <p className="text-xs text-gray-400 italic">No leaves</p>}
                                </div>
                            </div>

                            {/* Absent */}
                            <div>
                                <h4 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Absent ({selectedDayDetails.absent?.length || 0})
                                </h4>
                                <div className="pl-4">
                                    {selectedDayDetails.absent?.length > 0 ? (
                                        <ul className="list-disc text-sm text-gray-600">
                                            {selectedDayDetails.absent.map((name, i) => <li key={i}>{name}</li>)}
                                        </ul>
                                    ) : <p className="text-xs text-gray-400 italic">No absentees recorded</p>}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 text-right">
                            <button onClick={() => setSelectedDayDetails(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm font-medium">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarView;