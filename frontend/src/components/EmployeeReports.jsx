import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { formatDate } from '../utils/dateUtils';

const COLORS = ['#4a6fa5', '#8fa59b', '#3f4a59', '#2e2e2e'];

const EmployeeReports = ({ attendanceData = [], leaveData = [], employees = [] }) => {
    const [activeTab, setActiveTab] = useState('attendance');

    // Filters
    const [startDate, setStartDate] = useState(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    // Default end date to 1 month in future to catch upcoming leaves
    const [endDate, setEndDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [department, setDepartment] = useState('');

    const isAdmin = employees.length > 0;

    // --- Filter Data ---
    const filteredAttendance = useMemo(() => {
        return attendanceData.filter(rec => {
            const date = rec.date || rec.attendance_date; // Handle different key names if any
            if (!date) return false;
            const recDate = new Date(date);
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0); // Start of day
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // End of day

            const dateMatch = recDate >= start && recDate <= end;
            const deptMatch = department ? (rec.department || '').toLowerCase().includes(department.toLowerCase()) : true;
            return dateMatch && deptMatch;
        });
    }, [attendanceData, startDate, endDate, department]);

    const filteredLeaves = useMemo(() => {
        return leaveData.filter(rec => {
            const date = rec.start_date;
            if (!date) return false;
            const recDate = new Date(date);
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            const dateMatch = recDate >= start && recDate <= end;
            // For leaves, department might be on the record if fetched via Admin endpoint
            const deptMatch = department ? (rec.department || '').toLowerCase().includes(department.toLowerCase()) : true;
            return dateMatch && deptMatch;
        });
    }, [leaveData, startDate, endDate, department]);


    // --- Attendance Data Processing ---
    const attendanceStats = useMemo(() => {
        const data = filteredAttendance;
        // 1. Status Distribution
        const statusCounts = {};
        data.forEach(rec => {
            const s = rec.status || 'Unknown';
            statusCounts[s] = (statusCounts[s] || 0) + 1;
        });
        const pieData = Object.keys(statusCounts).map((key, index) => ({
            name: key,
            value: statusCounts[key],
            color: COLORS[index % COLORS.length]
        }));

        // 2. Daily Working Hours
        const barData = data.slice(0, 30).map(rec => {
            let hours = 0;
            if (rec.total_hours) {
                // If total_hours is "HH:MM", parse it. If it's number, use it.
                // Admin export returns "HH:MM" (from formatted SQL). Employee data returns "HH:MM".
                if (typeof rec.total_hours === 'string' && rec.total_hours.includes(':')) {
                    const [h, m] = rec.total_hours.split(':').map(Number);
                    hours = h + (m / 60);
                } else {
                    hours = parseFloat(rec.total_hours) || 0;
                }
            }
            return {
                date: rec.date || rec.attendance_date,
                hours: parseFloat(hours.toFixed(2))
            };
        }).reverse();

        return { pieData, barData };
    }, [filteredAttendance]);

    // --- Leave Data Processing ---
    const leaveStats = useMemo(() => {
        const data = filteredLeaves;
        // 1. Leave Type Distribution
        const typeCounts = {};
        data.forEach(leave => {
            const t = leave.type || 'Other';
            typeCounts[t] = (typeCounts[t] || 0) + 1;
        });
        const pieData = Object.keys(typeCounts).map((key, index) => ({
            name: key === 'paid' ? 'Planned' : key.replace(/_/g, ' '),
            value: typeCounts[key],
            color: COLORS[index % COLORS.length]
        }));

        // 2. Monthly Trend (Leaves per month)
        // Note: With date filters, monthly trend might be just one month, but still useful.
        const monthCounts = {};
        data.forEach(leave => {
            const d = new Date(leave.start_date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthCounts[key] = (monthCounts[key] || 0) + 1;
        });
        const barData = Object.keys(monthCounts).sort().map(key => ({
            month: key,
            count: monthCounts[key]
        }));

        return { pieData, barData };
    }, [filteredLeaves]);

    // --- Role Data Processing ---
    const roleStats = useMemo(() => {
        if (!isAdmin) return { pieData: [] };
        const roleCounts = {};
        employees.forEach(emp => {
            const r = emp.role || 'Unknown';
            roleCounts[r] = (roleCounts[r] || 0) + 1;
        });
        const pieData = Object.keys(roleCounts).map((key, index) => ({
            name: key,
            value: roleCounts[key],
            color: COLORS[index % COLORS.length]
        }));
        return { pieData };
    }, [employees, isAdmin]);


    // --- Excel Download Handlers ---
    const downloadAttendanceExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredAttendance);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(data, `Attendance_Report_${startDate}_to_${endDate}.xlsx`);
    };

    const downloadLeaveExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredLeaves);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Leaves");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(data, `Leave_Report_${startDate}_to_${endDate}.xlsx`);
    };

    const downloadRoleExcel = () => {
        const dataForExcel = employees.map(e => ({
            Name: e.name,
            Email: e.email,
            Role: e.role,
            Department: e.department,
            Status: e.status
        }));
        const formattedData = dataForExcel.map(item => {
            const formattedItem = {};
            Object.keys(item).forEach(key => {
                let val = item[key];
                if (typeof val === 'string' && (key.includes('date') || key.includes('joined_on') || key.includes('dob') || key.includes('created_at'))) {
                    if (val.match(/^\d{4}-\d{2}-\d{2}/)) {
                        val = formatDate(val);
                    }
                }
                formattedItem[key] = val;
            });
            return formattedItem;
        });

        const ws = XLSX.utils.json_to_sheet(formattedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Employees_By_Role");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(data, `Employee_Roles_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                {/* Filters */}
                <div className="flex flex-wrap gap-2 items-end">
                    <div>
                        <label className="block text-xs font-medium text-secondary mb-1">Start Date</label>
                        <input
                            type="date"
                            className="border rounded px-2 py-1 text-sm bg-white text-primary"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-secondary mb-1">End Date</label>
                        <input
                            type="date"
                            className="border rounded px-2 py-1 text-sm bg-white text-primary"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>
                    {isAdmin && (
                        <div>
                            <label className="block text-xs font-medium text-secondary mb-1">Department</label>
                            <input
                                type="text"
                                placeholder="Filter Dept"
                                className="border rounded px-2 py-1 text-sm w-32 bg-white text-primary"
                                value={department}
                                onChange={e => setDepartment(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[#e2e8f0]">
                    <button
                        className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'attendance' ? 'border-b-2 border-[color:var(--accent-primary)] text-accent' : 'text-secondary hover:text-primary'}`}
                        onClick={() => setActiveTab('attendance')}
                    >
                        Attendance
                    </button>
                    <button
                        className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'leaves' ? 'border-b-2 border-[color:var(--accent-primary)] text-accent' : 'text-secondary hover:text-primary'}`}
                        onClick={() => setActiveTab('leaves')}
                    >
                        Leaves
                    </button>
                    {isAdmin && (
                        <button
                            className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'roles' ? 'border-b-2 border-[color:var(--accent-primary)] text-accent' : 'text-secondary hover:text-primary'}`}
                            onClick={() => setActiveTab('roles')}
                        >
                            Employees by Role
                        </button>
                    )}
                </div>
            </div>

            {/* Attendance Content */}
            {activeTab === 'attendance' && (
                <div className="space-y-8">
                    <div className="flex flex-wrap justify-between items-center gap-4">
                        <h3 className="text-lg font-medium text-primary">Attendance Overview</h3>
                        <div className="flex items-center gap-3">
                            <div className="text-sm text-secondary hidden sm:block">Showing {filteredAttendance.length} records</div>
                            <button
                                onClick={downloadAttendanceExcel}
                                className="bg-[color:var(--status-success)] text-white px-4 py-2 rounded hover:opacity-90 transition text-sm font-medium shadow-sm"
                            >
                                Export Excel
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-[color:var(--bg-main)] p-4 rounded shadow-sm">
                            <h4 className="text-sm font-semibold text-secondary mb-4 text-center">Status Distribution</h4>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={attendanceStats.pieData}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={80}
                                            fill="#4a6fa5"
                                            dataKey="value"
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {attendanceStats.pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-[color:var(--bg-main)] p-4 rounded shadow-sm">
                            <h4 className="text-sm font-semibold text-secondary mb-4 text-center">Daily Work Hours (Recent)</h4>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={attendanceStats.barData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#3f4a59' }} axisLine={false} tickLine={false} />
                                        <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft', fill: '#3f4a59' }} tick={{ fill: '#3f4a59' }} axisLine={false} tickLine={false} />
                                        <RechartsTooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                        <Bar dataKey="hours" fill="#4a6fa5" name="Hours" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Leave Content */}
            {activeTab === 'leaves' && (
                <div className="space-y-8">
                    <div className="flex flex-wrap justify-between items-center gap-4">
                        <h3 className="text-lg font-medium text-primary">Leave Overview</h3>
                        <div className="flex items-center gap-3">
                            <div className="text-sm text-secondary hidden sm:block">Showing {filteredLeaves.length} records</div>
                            <button
                                onClick={downloadLeaveExcel}
                                className="bg-[color:var(--status-success)] text-white px-4 py-2 rounded hover:opacity-90 transition text-sm font-medium shadow-sm"
                            >
                                Export Excel
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-[color:var(--bg-main)] p-4 rounded shadow-sm">
                            <h4 className="text-sm font-semibold text-secondary mb-4 text-center">Leave Type Distribution</h4>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={leaveStats.pieData}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={80}
                                            fill="#8fa59b"
                                            dataKey="value"
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {leaveStats.pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-[color:var(--bg-main)] p-4 rounded shadow-sm">
                            <h4 className="text-sm font-semibold text-secondary mb-4 text-center">Monthly Trend</h4>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={leaveStats.barData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="month" tick={{ fill: '#3f4a59' }} axisLine={false} tickLine={false} />
                                        <YAxis allowDecimals={false} label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: '#3f4a59' }} tick={{ fill: '#3f4a59' }} axisLine={false} tickLine={false} />
                                        <RechartsTooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                        <Bar dataKey="count" fill="#8fa59b" name="Leaves" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Roles Content */}
            {activeTab === 'roles' && isAdmin && (
                <div className="space-y-8">
                    <div className="flex flex-wrap justify-between items-center gap-4">
                        <h3 className="text-lg font-medium text-primary">Employees by Role</h3>
                        <div className="flex items-center gap-3">
                            <div className="text-sm text-secondary hidden sm:block">Total Employees: {employees.length}</div>
                            <button
                                onClick={downloadRoleExcel}
                                className="bg-[color:var(--status-success)] text-white px-4 py-2 rounded hover:opacity-90 transition text-sm font-medium shadow-sm"
                            >
                                Export Excel
                            </button>
                        </div>
                    </div>

                    <div className="bg-[color:var(--bg-main)] p-4 rounded shadow-sm max-w-2xl mx-auto">
                        <h4 className="text-sm font-semibold text-secondary mb-4 text-center">Role Distribution</h4>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={roleStats.pieData}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={100}
                                        fill="#3f4a59"
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {roleStats.pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeReports;
