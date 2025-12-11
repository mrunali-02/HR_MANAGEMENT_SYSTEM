import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CalendarView = ({ attendance = [], holidays = [], onDateClick, role }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year, month) => {
        return new Date(year, month, 1).getDay();
    };

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
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

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const status = attendanceMap[dateStr];
            const isHoliday = holidayMap[dateStr];
            const isToday = dateStr === today;

            let bgColor = 'bg-white';
            if (isHoliday) bgColor = 'bg-gray-300';
            else if (status === 'present') bgColor = 'bg-green-100';
            else if (status === 'absent') bgColor = 'bg-red-100';
            else if (['casual', 'sick', 'earned', 'paid'].includes(status)) bgColor = 'bg-yellow-100';

            days.push(
                <div
                    key={d}
                    onClick={() => onDateClick && onDateClick(dateStr, isHoliday)}
                    className={`h-24 border border-gray-100 p-2 relative transition hover:shadow-md ${bgColor} ${onDateClick ? 'cursor-pointer hover:bg-opacity-80' : ''}`}
                >
                    <div className={`flex justify-between items-start`}>
                        <span className={`text-sm font-semibold ${isToday ? 'bg-indigo-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-gray-700'}`}>
                            {d}
                        </span>
                    </div>
                    <div className="mt-2 text-xs">
                        {isHoliday && <div className="font-bold text-gray-600 truncate">{isHoliday}</div>}
                        {!isHoliday && status && <div className="capitalize font-medium truncate">{status}</div>}
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
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-green-100 border border-green-200 block"></span> Present
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-red-100 border border-red-200 block"></span> Absent
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-yellow-100 border border-yellow-200 block"></span> Leave
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-gray-300 border border-gray-400 block"></span> Holiday
                </div>
                {role && (role === 'admin' || role === 'hr') && (
                    <div className="ml-auto text-gray-500 italic">
                        * Click on a date to toggle Holiday
                    </div>
                )}
            </div>
        </div>
    );
};

export default CalendarView;
