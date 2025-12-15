// src/components/ManagerDashboard.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import CalendarView from '../components/CalendarView';
import './AdminDashboard.css'; // reuse admin styling

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const TABS = {
  DASHBOARD: 'dashboard',
  ATTENDANCE: 'attendance',
  WORK_HOURS: 'workHours',
  LEAVES: 'leaves',
  CALENDAR: 'calendar',
  REPORTS: 'reports',
  PROFILE: 'profile',
};

function ManagerDashboard() {
  const { id } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Manager-specific data
  const [teamAttendance, setTeamAttendance] = useState([]);
  const [teamWorkHours, setTeamWorkHours] = useState([]);
  const [teamLeaves, setTeamLeaves] = useState([]);
  const [teamStats, setTeamStats] = useState(null); // { teamSize, avgHoursPerDay, totalLeaves }
  const [managerProfile, setManagerProfile] = useState(null);

  // Password Change State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordStatus, setPasswordStatus] = useState({ loading: false, error: '', success: '' }); // New Enhanced Profile Data

  // My Calendar & Attendance
  const [holidays, setHolidays] = useState([]);
  const [myAttendanceRecords, setMyAttendanceRecords] = useState([]);
  const [myTodayAttendance, setMyTodayAttendance] = useState(null);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [checkoutMarked, setCheckoutMarked] = useState(false);

  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.id !== parseInt(id, 10) && user.role !== 'admin') {
      navigate('/login');
      return;
    }
    loadManagerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, navigate]);

  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const loadManagerData = async () => {
    setLoading(true);
    setError('');

    try {
      // 1) Manager profile (Enhanced)
      const profileRes = await axios.get(`${API_BASE_URL}/manager/${id}`, {
        headers: getAuthHeader(),
      });
      setManagerProfile(profileRes.data); // Use new state variable
      setProfile(profileRes.data); // Keep old one for safety if utilized elsewhere

      // 2) Team data
      try {
        const [attendanceRes, workRes, leavesRes, statsRes] = await Promise.allSettled([
          axios.get(`${API_BASE_URL}/manager/team/attendance`, { headers: getAuthHeader() }),
          axios.get(`${API_BASE_URL}/manager/team/work-hours`, { headers: getAuthHeader() }),
          axios.get(`${API_BASE_URL}/manager/team/leave-requests`, { headers: getAuthHeader() }),
          axios.get(`${API_BASE_URL}/manager/team/stats`, { headers: getAuthHeader() }),
        ]);

        if (attendanceRes.status === 'fulfilled') {
          setTeamAttendance(attendanceRes.value.data.attendance || []);
        } else {
          setTeamAttendance([]);
        }

        if (workRes.status === 'fulfilled') {
          setTeamWorkHours(workRes.value.data.workHours || []);
        } else {
          setTeamWorkHours([]);
        }

        if (leavesRes.status === 'fulfilled') {
          setTeamLeaves(leavesRes.value.data.requests || []);
        } else {
          setTeamLeaves([]);
        }

        if (statsRes.status === 'fulfilled') {
          setTeamStats(statsRes.value.data || null);
        } else {
          setTeamStats(null);
        }
      } catch (innerErr) {
        console.error('Manager team data error:', innerErr);
      }
      // 3) Holidays & My Attendance [NEW]
      try {
        const [holidayRes, myAttRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/holidays`, { headers: getAuthHeader() }),
          axios.get(`${API_BASE_URL}/employee/${id}/attendance`, { headers: getAuthHeader() }) // Managers are also employees
        ]);
        setHolidays(holidayRes.data.holidays || []);

        setMyAttendanceRecords(myAttRes.data.records || []);
        setMyTodayAttendance(myAttRes.data.today || null);
        setAttendanceMarked(myAttRes.data.today?.status === 'present');
        setCheckoutMarked(!!myAttRes.data.today?.check_out);

      } catch (err) {
        console.error('Error fetching calendar data:', err);
      }

    } catch (err) {
      console.error('Error loading manager data:', err);
      setError(err.response?.data?.error || 'Failed to load manager dashboard');
      if (err.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleApproveTeamLeave = async (leaveId) => {
    // Manager: Approve team leaves only
    try {
      await axios.put(
        `${API_BASE_URL}/manager/team/leave-requests/${leaveId}/approve`,
        {},
        { headers: getAuthHeader() }
      );
      setTeamLeaves((prev) =>
        prev.map((l) =>
          l.id === leaveId ? { ...l, status: 'approved' } : l
        )
      );
    } catch (err) {
      console.error('Manager approve leave error:', err);
      alert('Failed to approve team leave (check backend route).');
    }
  };

  const handleRejectTeamLeave = async (leaveId) => {
    if (!window.confirm('Reject this team leave request?')) return;
    try {
      await axios.put(
        `${API_BASE_URL}/manager/team/leave-requests/${leaveId}/reject`,
        {},
        { headers: getAuthHeader() }
      );
      setTeamLeaves((prev) =>
        prev.map((l) =>
          l.id === leaveId ? { ...l, status: 'rejected' } : l
        )
      );
    } catch (err) {
      console.error('Manager reject leave error:', err);
      alert('Failed to reject team leave (check backend route).');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg font-medium text-gray-700">
          Loading manager dashboard...
        </div>
      </div>
    );
  }

  const managerUser = profile?.user;

  // Handlers for My Attendance
  const handleMarkMyAttendance = async () => {
    if (attendanceMarked || myTodayAttendance?.status === 'present') return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/employee/${id}/attendance/mark`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Checked in successfully!');
      // Refresh
      const attRes = await axios.get(`${API_BASE_URL}/employee/${id}/attendance`, { headers: { Authorization: `Bearer ${token}` } });
      setMyAttendanceRecords(attRes.data.records || []);
      setMyTodayAttendance(attRes.data.today || null);
      setAttendanceMarked(attRes.data.today?.status === 'present');
    } catch (err) {
      console.error(err);
      alert('Check-in failed');
    }
  };

  const handleMyCheckout = async () => {
    if (!attendanceMarked || !myTodayAttendance?.check_in || checkoutMarked) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/employee/${id}/attendance/checkout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`Checked out! Work hours: ${res.data.total_hours}`);
      // Refresh
      const attRes = await axios.get(`${API_BASE_URL}/employee/${id}/attendance`, { headers: { Authorization: `Bearer ${token}` } });
      setMyAttendanceRecords(attRes.data.records || []);
      setMyTodayAttendance(attRes.data.today || null);
      setCheckoutMarked(!!attRes.data.today?.check_out);
    } catch (err) {
      console.error(err);
      alert('Checkout failed');
    }
  };


  // ---------- RENDER SECTIONS BASED ON PRIVILEGES ----------

  // DASHBOARD – Overview (team + counts)
  const renderDashboard = () => {
    const teamSize = (teamStats?.teamSize ?? teamAttendance.length) || 0;
    const pendingLeaves =
      teamLeaves.filter((l) => l.status === 'pending').length || 0;
    const approvedLeaves =
      teamLeaves.filter((l) => l.status === 'approved').length || 0;
    const rejectedLeaves =
      teamLeaves.filter((l) => l.status === 'rejected').length || 0;

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Manager Dashboard
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Summary of your team&apos;s attendance, leave and work hours.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase">Team Size</p>
            <p className="text-2xl font-semibold text-gray-900">{teamSize}</p>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase">Pending Leaves</p>
            <p className="text-2xl font-semibold text-yellow-600">
              {pendingLeaves}
            </p>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase">Approved Leaves</p>
            <p className="text-2xl font-semibold text-green-600">
              {approvedLeaves}
            </p>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase">Rejected Leaves</p>
            <p className="text-2xl font-semibold text-red-600">
              {rejectedLeaves}
            </p>
          </div>
        </div>

        {/* Small privilege hint from your module summary */}
        <div className="bg-white shadow rounded-lg p-4 text-sm text-gray-700">
          <p className="font-semibold mb-1">Your privileges (Manager):</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Attendance: view your team only</li>
            <li>Work hours: view your team&apos;s hours</li>
            <li>Leave: approve/reject only your team&apos;s leave requests</li>
            <li>Statistics & reports: team-level only</li>
          </ul>
        </div>
      </div>
    );
  };

  // ATTENDANCE – View-only team attendance
  const renderAttendance = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">
        Team Attendance (View Only)
      </h2>
      <p className="text-sm text-gray-500">
        As a manager, you can <strong>only view</strong> attendance records for
        your team. No direct edits here.
      </p>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check-in
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check-out
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teamAttendance.map((a) => (
                <tr key={a.id || `${a.user_id}-${a.date}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {a.employee_name || a.employee_email || a.user_id}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">{a.date}</td>
                  <td className="px-4 py-2 text-sm text-gray-500 capitalize">
                    {a.status || '-'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {a.check_in || '-'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {a.check_out || '-'}
                  </td>
                </tr>
              ))}
              {teamAttendance.length === 0 && (
                <tr>
                  <td
                    className="px-4 py-4 text-center text-sm text-gray-500"
                    colSpan={5}
                  >
                    No team attendance data available yet. Connect
                    <code className="px-1">/manager/team/attendance</code> API.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // WORK HOURS – View team hours
  const renderWorkHours = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Team Work Hours</h2>
      <p className="text-sm text-gray-500">
        View calculated work hours for your team members. You do not configure
        rules here (that is Admin/System).
      </p>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Hours
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Overtime
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teamWorkHours.map((h) => (
                <tr key={h.id || `${h.user_id}-${h.date}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {h.employee_name || h.employee_email || h.user_id}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">{h.date}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {h.hours || '-'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {h.overtime_hours || '0'}
                  </td>
                </tr>
              ))}
              {teamWorkHours.length === 0 && (
                <tr>
                  <td
                    className="px-4 py-4 text-center text-sm text-gray-500"
                    colSpan={4}
                  >
                    No team work-hour data yet. Connect
                    <code className="px-1">/manager/team/work-hours</code> API.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // LEAVES – Approve team leaves
  const renderLeaves = () => {
    const calculateDays = (start, end) => {
      if (!start || !end) return 0;
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (endDate < startDate) return 0;
      const diffTime = Math.abs(endDate - startDate);
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    };

    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Team Leave Requests</h2>
        <p className="text-sm text-gray-500">
          You can approve/reject <strong>only your team&apos;s</strong> leave
          applications.
        </p>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason (and Document)
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teamLeaves.map((la) => (
                  <tr key={la.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {la.employee_name || la.employee_email}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500 capitalize">
                      {la.type}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {la.start_date} → {la.end_date}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 font-semibold">
                      {la.days || calculateDays(la.start_date, la.end_date)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500 max-w-xs truncate">
                      {la.reason || '-'}
                      {la.document_url && (
                        <a
                          href={`${API_BASE_URL.replace('/api', '')}/${la.document_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-indigo-600 hover:text-indigo-800 text-xs underline"
                        >
                          View Doc
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${la.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : la.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : la.status === 'cancelled'
                              ? 'bg-gray-100 text-gray-500'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                      >
                        {la.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-sm">
                      {la.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApproveTeamLeave(la.id)}
                            className="inline-flex items-center px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectTeamLeave(la.id)}
                            className="inline-flex items-center px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">
                          No actions available
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {teamLeaves.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-4 text-center text-sm text-gray-500"
                      colSpan={7}
                    >
                      No team leave requests yet. Connect
                      <code className="px-1">
                        /manager/team/leave-requests
                      </code>{' '}
                      API.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ---------- CSV EXPORT LOGIC ----------
  const downloadCSV = (data, filename) => {
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }

    // Extract headers
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','), // Header row
      ...data.map(row => headers.map(fieldName => {
        const value = row[fieldName];
        // Handle strings with commas or newlines
        if (typeof value === 'string' && (value.includes(',') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDownloadAttendance = () => {
    const data = teamAttendance.map(a => ({
      ID: a.id,
      Date: a.date,
      Name: a.employee_name,
      Email: a.employee_email,
      'Check In': a.check_in || '-',
      'Check Out': a.check_out || '-',
      Status: a.status
    }));
    downloadCSV(data, `Team_Attendance_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleDownloadLeaves = () => {
    const data = teamLeaves.map(l => ({
      ID: l.id,
      Name: l.employee_name,
      Email: l.employee_email,
      Type: l.type,
      'Start Date': l.start_date,
      'End Date': l.end_date,
      Days: l.days,
      Reason: l.reason,
      Status: l.status,
      'Reviewed By': l.reviewed_by || '-'
    }));
    downloadCSV(data, `Team_Leaves_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleDownloadOvertime = () => {
    // Filter for actual overtime or just dump work hours with overtime column
    const data = teamWorkHours.map(w => ({
      ID: w.id,
      Date: w.date,
      Name: w.employee_name,
      'Total Hours': w.hours,
      'Overtime Hours': w.overtime_hours
    }));
    downloadCSV(data, `Team_Overtime_WorkHours_${new Date().toISOString().split('T')[0]}.csv`);
  };
  const renderReports = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Team Reports</h2>
      <p className="text-sm text-gray-500">
        View and export team-level reports. Admin controls global exports.
      </p>

      <div className="bg-white shadow rounded-lg p-4 space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">
          Team Summary (Statistics)
        </h3>
        {teamStats ? (
          <ul className="text-sm text-gray-700 space-y-1">
            <li>
              <strong>Team Size:</strong> {teamStats.teamSize ?? '-'}
            </li>
            <li>
              <strong>Avg. Work Hours:</strong>{' '}
              {teamStats.avgHoursPerDay ?? '-'}
            </li>
            <li>
              <strong>Total Leave Requests:</strong>{' '}
              {teamStats.totalLeaves ?? '-'}
            </li>
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            No team stats yet. Connect
            <code className="px-1">/manager/team/stats</code> API.
          </p>
        )}
      </div>

      {/* ANALYTICS CHARTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEAVE ANALYTICS */}
        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Request Distribution</h3>
          {teamLeaves.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Pending', value: teamLeaves.filter(l => l.status === 'pending').length },
                      { name: 'Approved', value: teamLeaves.filter(l => l.status === 'approved').length },
                      { name: 'Rejected', value: teamLeaves.filter(l => l.status === 'rejected').length },
                    ].filter(i => i.value > 0)}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label
                  >
                    <Cell fill="#EAB308" /> {/* Pending - Yellow */}
                    <Cell fill="#22C55E" /> {/* Approved - Green */}
                    <Cell fill="#EF4444" /> {/* Rejected - Red */}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-10">No leave data available for analytics.</p>
          )}
        </div>

        {/* ATTENDANCE ANALYTICS (Recent) */}
        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Overview (Last 30 records)</h3>
          {teamAttendance.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Present', value: teamAttendance.filter(a => a.status === 'present').length },
                      { name: 'Absent', value: teamAttendance.filter(a => a.status === 'absent').length },
                      { name: 'On Leave', value: teamAttendance.filter(a => a.status === 'on_leave').length },
                      { name: 'Remote', value: teamAttendance.filter(a => a.status === 'remote').length },
                    ].filter(i => i.value > 0)}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#82ca9d"
                    dataKey="value"
                    label
                  >
                    <Cell fill="#22C55E" /> {/* Present - Green */}
                    <Cell fill="#EF4444" /> {/* Absent - Red */}
                    <Cell fill="#3B82F6" /> {/* On Leave - Blue */}
                    <Cell fill="#A855F7" /> {/* Remote - Purple */}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-10">No attendance data available for analytics.</p>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-4 space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">
          Export Team Reports
        </h3>
        <p className="text-sm text-gray-500">
          Download team data in CSV format.
        </p>
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={handleDownloadAttendance}
            className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 shadow-sm"
          >
            📥 Download Attendance Report
          </button>
          <button
            type="button"
            onClick={handleDownloadLeaves}
            className="inline-flex items-center px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 shadow-sm"
          >
            📥 Download Leave Report
          </button>
          <button
            type="button"
            onClick={handleDownloadOvertime}
            className="inline-flex items-center px-4 py-2 rounded-md bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 shadow-sm"
          >
            📥 Download Overtime Report
          </button>
        </div>
      </div>
    </div>
  );

  const renderCalendar = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
        <h2 className="text-2xl font-bold text-gray-800">My Attendance & Calendar</h2>
        <div className="flex gap-2">
          {!attendanceMarked ? (
            <button
              onClick={handleMarkMyAttendance}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold"
            >
              Check In
            </button>
          ) : (
            <span className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-bold">✓ Checked In</span>
          )}

          {attendanceMarked && !checkoutMarked && (
            <button
              onClick={handleMyCheckout}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-bold"
            >
              Check Out
            </button>
          )}
          {checkoutMarked && (
            <span className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-bold">✓ Checked Out</span>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <p className="mb-4 text-sm text-gray-600">
          View-only for Holidays.
        </p>
        <CalendarView
          attendance={myAttendanceRecords} // Show MY attendance, not team's
          holidays={holidays}
          role="manager"
          onDateClick={() => { }} // Managers can't edit holidays
        />
      </div>
    </div>
  );



  // ---------- PASSWORD CHANGE HANDLERS ----------
  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordStatus({ loading: false, error: 'New passwords do not match', success: '' });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setPasswordStatus({ loading: false, error: 'Password must be at least 6 characters', success: '' });
      return;
    }

    setPasswordStatus({ loading: true, error: '', success: '' });

    try {
      await axios.put(
        `${API_BASE_URL}/employee/${user.id}/change-password`,
        {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        },
        { headers: getAuthHeader() }
      );
      setPasswordStatus({ loading: false, error: '', success: 'Password changed successfully!' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordStatus({ loading: false, error: '', success: '' });
      }, 1500);
    } catch (err) {
      setPasswordStatus({
        loading: false,
        error: err.response?.data?.error || 'Failed to change password',
        success: ''
      });
    }
  };

  const renderChangePasswordModal = () => {
    if (!showPasswordModal) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
            <button
              onClick={() => setShowPasswordModal(false)}
              className="text-gray-400 hover:text-gray-500 text-2xl"
            >
              &times;
            </button>
          </div>

          <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
            {passwordStatus.error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-200">
                {passwordStatus.error}
              </div>
            )}
            {passwordStatus.success && (
              <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm border border-green-200">
                {passwordStatus.success}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="pt-2 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={passwordStatus.loading}
                className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                  ${passwordStatus.loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {passwordStatus.loading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // PROFILE – Enhanced Manager Profile Section
  const renderProfile = () => {
    if (!managerUser) return <p>Loading profile...</p>;

    // Use fetched profile data if available, fallback to basic managerUser
    const user = managerProfile?.user || managerUser;
    const team = managerProfile?.team || { members: [], count: 0 };
    const stats = managerProfile?.stats || { leaves: {}, work: {} };

    return (
      <div className="space-y-8 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 border-b pb-4">My Profile & Dashboard</h2>

        {/* 1. Personal & Role Details */}
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="px-6 py-4 bg-indigo-600">
            <h3 className="text-lg font-semibold text-white">Personal & Role Information</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start space-x-4">
              <div className="h-24 w-24 bg-gray-200 rounded-full flex items-center justify-center text-3xl overflow-hidden border-4 border-white shadow-md">
                {user.photo_url ? (
                  <img src={user.photo_url} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span>👤</span>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xl font-bold text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-500">ID: {user.id}</p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {user.role?.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-gray-500 font-medium">Email:</span>
                <span className="col-span-2 text-gray-900">{user.email}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-gray-500 font-medium">Phone:</span>
                <span className="col-span-2 text-gray-900">{user.phone || 'Not set'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-gray-500 font-medium">Department:</span>
                <span className="col-span-2 text-gray-900">{user.department || 'General'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-gray-500 font-medium">Reporting To:</span>
                <span className="col-span-2 text-gray-900">{user.reporting_authority || 'HR Admin'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 3. Team Information */}
          <div className="bg-white shadow-lg rounded-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">My Team</h3>
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">{team.count} Members</span>
            </div>
            <div className="p-0 flex-1 overflow-y-auto max-h-64">
              {team.members.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {team.members.map((member) => (
                    <li key={member.id} className="px-6 py-3 hover:bg-gray-50 flex items-center space-x-3">
                      <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center text-xs">
                        {member.photo_url ? <img src={member.photo_url} alt="" className="h-full w-full rounded-full" /> : member.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{member.name}</p>
                        <p className="text-xs text-gray-500">
                          {member.role ? member.role.toUpperCase() : 'EMPLOYEE'}
                          {member.department && ` • ${member.department}`}
                        </p>
                        <p className="text-xs text-gray-400">{member.email}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-6 text-sm text-gray-500 text-center">No team members assigned.</p>
              )}
            </div>
          </div>

          {/* 4 & 5. Stats Overview */}
          <div className="space-y-6">
            {/* Leave Overview */}
            <div className="bg-white shadow-lg rounded-xl overflow-hidden p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave & Approval Overview</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{stats.leaves.pending || 0}</p>
                  <p className="text-xs text-yellow-700 font-medium uppercase mt-1">Pending</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{stats.leaves.approved || 0}</p>
                  <p className="text-xs text-green-700 font-medium uppercase mt-1">Approved</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{stats.leaves.rejected || 0}</p>
                  <p className="text-xs text-red-700 font-medium uppercase mt-1">Rejected</p>
                </div>
              </div>
            </div>

            {/* Attendance & Work Summary */}
            <div className="bg-white shadow-lg rounded-xl overflow-hidden p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">My Work Summary</h3>
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <span className="text-sm text-gray-500">Today's Status</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${stats.work.today_status === 'present' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {stats.work.today_status?.toUpperCase() || 'NOT MARKED'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Monthly Hours</span>
                <span className="text-xl font-bold text-indigo-600">{stats.work.month_hours || 0} hrs</span>
              </div>
            </div>
          </div>
        </div>

        {/* 6. Account Settings */}
        <div className="bg-white shadow-lg rounded-xl overflow-hidden p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Account Settings</h3>
              <p className="text-sm text-gray-500">Manage your password and session.</p>
            </div>
            <div className="space-x-4">
              <button
                onClick={() => setShowPasswordModal(true)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Change Password
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------- MAIN LAYOUT (same shell as Admin) ----------

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col shadow-xl">
        <div className="h-16 flex items-center justify-center border-b border-slate-800">
          <span className="text-lg font-semibold tracking-wide">
            HRMS Manager
          </span>
        </div>

        <nav className="flex-1 py-4 space-y-1">
          <button
            onClick={() => setActiveTab(TABS.DASHBOARD)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === TABS.DASHBOARD
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab(TABS.ATTENDANCE)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === TABS.ATTENDANCE
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            Team Attendance
          </button>
          <button
            onClick={() => setActiveTab(TABS.WORK_HOURS)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === TABS.WORK_HOURS
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            Work Hours
          </button>
          <button
            onClick={() => setActiveTab(TABS.LEAVES)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === TABS.LEAVES
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            Leave Requests
          </button>
          <button
            onClick={() => setActiveTab(TABS.CALENDAR)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === TABS.CALENDAR
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            Calendar & Attendance
          </button>
          <button
            onClick={() => setActiveTab(TABS.REPORTS)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === TABS.REPORTS
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            Team Reports
          </button>
          <button
            onClick={() => setActiveTab(TABS.PROFILE)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === TABS.PROFILE
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            Profile
          </button>
        </nav>

        <div className="border-t border-slate-800 p-4">
          <button
            onClick={handleLogout}
            className="w-full inline-flex justify-center items-center px-4 py-2 text-sm font-medium rounded-md bg-red-600 hover:bg-red-700 text-white transition"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {activeTab === TABS.DASHBOARD && 'Dashboard'}
              {activeTab === TABS.ATTENDANCE && 'Team Attendance'}
              {activeTab === TABS.WORK_HOURS && 'Work Hours'}
              {activeTab === TABS.LEAVES && 'Team Leave Requests'}
              {activeTab === TABS.REPORTS && 'Team Reports'}
              {activeTab === TABS.PROFILE && 'Profile'}
            </h1>
            <p className="text-xs text-gray-500">
              Signed in as {managerUser?.name || managerUser?.email} (
              {managerUser?.role})
            </p>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {activeTab === TABS.DASHBOARD && renderDashboard()}
          {activeTab === TABS.ATTENDANCE && renderAttendance()}
          {activeTab === TABS.WORK_HOURS && renderWorkHours()}
          {activeTab === TABS.LEAVES && renderLeaves()}
          {activeTab === TABS.CALENDAR && renderCalendar()}
          {activeTab === TABS.REPORTS && renderReports()}
          {activeTab === TABS.PROFILE && renderProfile()}
        </main>
        {renderChangePasswordModal()}
      </div>
    </div>
  );
}

export default ManagerDashboard;
