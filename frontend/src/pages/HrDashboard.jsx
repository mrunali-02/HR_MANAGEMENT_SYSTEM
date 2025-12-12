import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import './HrDashboard.css';
import CalendarView from '../components/CalendarView';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const TABS = {
  DASHBOARD: 'dashboard',
  EMPLOYEES: 'employees',
  LEAVE_APPLICATIONS: 'leaveApplications',
  CALENDAR: 'calendar',
  ANALYTICS: 'analytics',
  SETTINGS: 'settings',
};



function HrDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
  const [users, setUsers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [assigningManager, setAssigningManager] = useState({});
  const [dashboardSummary, setDashboardSummary] = useState(null);

  // Attendance & Calendar
  const [holidays, setHolidays] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [checkoutMarked, setCheckoutMarked] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'hr') {
      navigate('/login');
      return;
    }
    Promise.all([
      fetchUsers(),
      fetchManagers(),
      fetchLeaveApplications(),
      fetchHolidays(),

      fetchMyAttendance(),
      fetchDashboardSummary()
    ]).finally(() => {
      setLoading(false);
    });
  }, [user, navigate]);

  // ... (existing code) ...

  const fetchHolidays = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/holidays`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHolidays(response.data.holidays || []);
    } catch (err) {
      console.error('Error fetching holidays:', err);
    }
  };

  const fetchMyAttendance = async () => {
    if (!user?.id) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/employee/${user.id}/attendance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAttendanceRecords(res.data.records || []);
      setTodayAttendance(res.data.today || null);
      setAttendanceMarked(res.data.today?.status === 'present');
      setCheckoutMarked(!!res.data.today?.check_out);
    } catch (err) {
      console.error('Error fetching my attendance:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/hr/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUsers(response.data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.response?.data?.error || 'Failed to fetch users');
    }
  };

  const fetchManagers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/hr/managers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setManagers(response.data.managers || []);
    } catch (err) {
      console.error('Error fetching managers:', err);
      // Don't set error, just log it
    }
  };

  const fetchLeaveApplications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/hr/leave-requests`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setLeaveApplications(response.data.requests || response.data || []);
    } catch (err) {
      console.error('Error fetching leave requests:', err);
      setLeaveApplications([]);
    }
  };
  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/hr/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalytics(res.data);
    } catch (err) {
      console.error("Analytics fetch failed", err);
    }
  };

  const fetchDashboardSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/hr/dashboard/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboardSummary(response.data);
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
    }
  };



  const handleApproveLeave = async (leaveId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/hr/leave-requests/${leaveId}/approve`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccess('Leave request approved successfully!');
      fetchLeaveApplications();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve leave request');
    }
  };

  const handleRejectLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to reject this leave?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/hr/leave-requests/${leaveId}/reject`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccess('Leave request rejected successfully!');
      fetchLeaveApplications();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject leave request');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Confirm deletion?')) return;

    try {
      setError('');
      setSuccess('');
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/hr/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess('User deleted successfully!');
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleAssignManager = async (employeeId, managerId) => {
    try {
      setAssigningManager(prev => ({ ...prev, [employeeId]: true }));
      setError('');
      setSuccess('');
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/hr/employees/${employeeId}/assign-manager`,
        { managerId: managerId || null },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccess('Manager assigned successfully!');
      fetchUsers(); // Refresh the list
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign manager');
      // Clear error message after 5 seconds
      setTimeout(() => setError(''), 5000);
    } finally {
      setAssigningManager(prev => ({ ...prev, [employeeId]: false }));
    }
  };

  const handleMarkAttendance = async () => {
    if (attendanceMarked || todayAttendance?.status === 'present') {
      return;
    }

    setError('');
    setSuccess('');

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    const confirmCheckIn = window.confirm('This will capture your current location for attendance. Proceed?');
    if (!confirmCheckIn) return;

    setSuccess('Fetching location...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude, accuracy } = position.coords;
          const token = localStorage.getItem('token');
          await axios.post(
            `${API_BASE_URL}/employee/${user.id}/attendance/mark`,
            { latitude, longitude, accuracy },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          setSuccess('Attendance marked successfully!');
          setAttendanceMarked(true);
          fetchMyAttendance();
          setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
          console.error('Error marking attendance:', err);
          let errorMsg = err.response?.data?.error || 'Failed to mark attendance.';
          if (err.response?.data?.distance) {
            errorMsg += ` (Distance: ${err.response.data.distance}m, Max: ${err.response.data.max_distance}m)`;
          }
          setError(errorMsg);
          if (success === 'Fetching location...') setSuccess(''); // Clear loading text
        }
      },
      (geoError) => {
        console.error('Geolocation error:', geoError);
        let msg = 'Unable to retrieve location.';
        if (geoError.code === 1) msg = 'Location permission denied. Please enable GPS.';
        else if (geoError.code === 2) msg = 'Location unavailable.';
        else if (geoError.code === 3) msg = 'Location request timed out.';
        setError(msg);
        setSuccess('');
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
    );
  };

  const handleCheckout = async () => {
    if (!attendanceMarked || !todayAttendance?.check_in || checkoutMarked) return;

    setError('');
    setSuccess('');

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    const confirmCheckout = window.confirm('This will capture your current location for checkout. Proceed?');
    if (!confirmCheckout) return;

    setSuccess('Fetching location...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude, accuracy } = position.coords;
          const token = localStorage.getItem('token');
          const res = await axios.post(`${API_BASE_URL}/employee/${user.id}/attendance/checkout`,
            { latitude, longitude, accuracy },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const hours = res.data.total_hours || '0';
          setSuccess(`Checked out! Worked ${hours} hours.`);
          setCheckoutMarked(true); // Update local state immediately
          fetchMyAttendance();
          setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
          console.error('Error marking checkout:', err);
          let errorMsg = err.response?.data?.error || 'Checkout failed';
          if (err.response?.data?.distance) {
            errorMsg += ` (Distance: ${err.response.data.distance}m, Max: ${err.response.data.max_distance}m)`;
          }
          setError(errorMsg);
          if (success === 'Fetching location...') setSuccess('');
        }
      },
      (geoError) => {
        console.error('Geolocation error:', geoError);
        let msg = 'Unable to retrieve location.';
        if (geoError.code === 1) msg = 'Location permission denied. Please enable GPS.';
        else if (geoError.code === 2) msg = 'Location unavailable.';
        else if (geoError.code === 3) msg = 'Location request timed out.';
        setError(msg);
        setSuccess('');
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
    );
  };

  const handleToggleHoliday = async (dateStr, isHoliday) => {
    try {
      const token = localStorage.getItem('token');
      if (isHoliday) {
        // Find holiday with local date comparison
        const holiday = holidays.find(h => {
          let hDate = h.date;
          if (typeof h.date === 'string') {
            const d = new Date(h.date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            hDate = `${year}-${month}-${day}`;
          }
          return hDate === dateStr;
        });

        if (holiday && window.confirm(`Delete holiday "${holiday.name}"?`)) {
          await axios.delete(`${API_BASE_URL}/holidays/${holiday.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      } else {
        const name = prompt('Enter holiday name:');
        if (!name) return;
        await axios.post(`${API_BASE_URL}/holidays`, { date: dateStr, name }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      fetchHolidays();
    } catch (err) {
      alert('Failed to update holiday: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const totalEmployees = users.filter((u) => u.role === 'employee').length;
  const totalManagers = users.filter((u) => u.role === 'manager').length;
  const totalHr = users.filter((u) => u.role === 'hr').length;

  const renderDashboard = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">HR Dashboard Overview</h2>

      {/* Messages */}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* New Attendance Card */}
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl p-5 shadow-lg flex flex-col justify-between h-full">
          <div>
            <div className="text-sm uppercase tracking-wide opacity-80">Today's Status</div>
            <div className="mt-2 text-2xl font-bold">
              {todayAttendance?.status === 'present'
                ? 'Present'
                : todayAttendance?.status === 'absent'
                  ? 'Absent'
                  : 'Not Marked'}
            </div>
            {todayAttendance?.check_in && (
              <div className="mt-1 text-xs opacity-75">
                In: {todayAttendance.check_in}
              </div>
            )}
            {todayAttendance?.check_out && (
              <div className="mt-1 text-xs opacity-75">
                Out: {todayAttendance.check_out}
              </div>
            )}
            {todayAttendance?.total_hours && (
              <div className="mt-1 text-xs opacity-75 font-semibold">
                Hours: {todayAttendance.total_hours}
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            <button
              onClick={handleMarkAttendance}
              disabled={attendanceMarked || todayAttendance?.status === 'present'}
              className={`w-full text-xs font-bold px-3 py-2 rounded-lg transition ${attendanceMarked || todayAttendance?.status === 'present'
                ? 'bg-green-500 text-white cursor-not-allowed opacity-90'
                : 'bg-white text-indigo-600 hover:bg-indigo-50 shadow-md'
                }`}
            >
              {attendanceMarked || todayAttendance?.status === 'present' ? '✓ Checked In' : 'Check In Now'}
            </button>
            {attendanceMarked && !checkoutMarked && todayAttendance?.check_in && (
              <button
                onClick={handleCheckout}
                className="w-full text-xs font-bold px-3 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 shadow-md transition"
              >
                Check Out
              </button>
            )}
            {checkoutMarked && todayAttendance?.check_out && (
              <button
                disabled
                className="w-full text-xs font-bold px-3 py-2 rounded-lg bg-green-600 text-white cursor-not-allowed opacity-90"
              >
                ✓ Checked Out
              </button>
            )}
          </div>
        </div>

        {/* Existing Stat Cards & New Widgets */}
        <div className="bg-white p-6 rounded-lg shadow border border-indigo-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-100 rounded-bl-full -mr-10 -mt-10 transition-all group-hover:bg-indigo-200"></div>
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider relative z-10">Total Employees</div>
          <div className="text-4xl font-extrabold text-indigo-600 mt-2 relative z-10">{dashboardSummary?.totals?.totalEmployees || totalEmployees}</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-green-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-green-100 rounded-bl-full -mr-10 -mt-10 transition-all group-hover:bg-green-200"></div>
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider relative z-10">Present Today</div>
          <div className="text-4xl font-extrabold text-green-600 mt-2 relative z-10">{dashboardSummary?.totals?.presentToday || 0}</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-red-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-red-100 rounded-bl-full -mr-10 -mt-10 transition-all group-hover:bg-red-200"></div>
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider relative z-10">Absent Today</div>
          <div className="text-4xl font-extrabold text-red-600 mt-2 relative z-10">{dashboardSummary?.totals?.absentToday || 0}</div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-6 rounded-lg shadow relative overflow-hidden">
          <div className="text-sm font-medium opacity-90 uppercase tracking-wider">Pending Leaves</div>
          <div className="text-4xl font-extrabold mt-2">{dashboardSummary?.totals?.pendingLeaveRequests || 0}</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-orange-100 relative overflow-hidden">
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Pending Corrections</div>
          <div className="text-3xl font-bold text-orange-600 mt-2">{dashboardSummary?.totals?.pendingAttendanceCorrections || 0}</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-purple-100 relative overflow-hidden">
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Pending Overtime</div>
          <div className="text-3xl font-bold text-purple-600 mt-2">{dashboardSummary?.totals?.pendingOvertimeRequests || 0}</div>
        </div>
      </div>

      {/* Row 2: Notifications & Birthdays */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Notifications Panel */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            🔔 Action Items
          </h3>
          <div className="space-y-3">
            {dashboardSummary?.notifications?.length > 0 ? (
              dashboardSummary.notifications.map((note, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-800 border border-blue-100">
                  <span className="mt-1 h-2 w-2 rounded-full bg-blue-500 shrink-0"></span>
                  <span>{note}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 italic text-sm">No pending actions.</p>
            )}
          </div>
        </div>

        {/* Birthdays Panel */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            🎂 Upcoming Birthdays
          </h3>
          <div className="space-y-4">
            {dashboardSummary?.birthdays?.length > 0 ? (
              dashboardSummary.birthdays.map((b) => (
                <div key={b.id} className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold text-sm">
                    {b.photo_url ? <img src={b.photo_url} className="h-full w-full rounded-full object-cover" /> : (b.name ? b.name.charAt(0) : 'U')}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{b.name}</p>
                    <p className="text-xs text-gray-500">{new Date(b.dob).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 italic text-sm">No birthdays in the next 7 days.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderEmployeeList = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Employee List</h2>
      {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded">{error}</div>}
      {success && <div className="bg-green-100 text-green-700 px-4 py-2 rounded">{success}</div>}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Manager</th>
              <th className="px-4 py-2 text-left">Assign Manager</th>
              <th className="px-4 py-2 text-left">Joined</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">{u.name || u.email}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2 capitalize">{u.role}</td>
                <td className="px-4 py-2">
                  {u.manager_name ? (
                    <span className="text-sm text-gray-700">{u.manager_name}</span>
                  ) : (
                    <span className="text-sm text-gray-400 italic">No manager</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {u.role === 'employee' && (
                    <select
                      value={u.manager_id || ''}
                      onChange={(e) => handleAssignManager(u.id, e.target.value || null)}
                      disabled={assigningManager[u.id]}
                      className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">-- No Manager --</option>
                      {managers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name || manager.email}
                        </option>
                      ))}
                    </select>
                  )}
                  {u.role !== 'employee' && (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {u.joined_on ? new Date(u.joined_on).toLocaleDateString() : '-'}
                </td>
                <td className="px-4 py-2 text-right">
                  {u.role !== 'admin' && (
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-center" colSpan={7}>
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderLeaveApplications = () => {
    const calculateDays = (start, end) => {
      if (!start || !end) return 0;
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (endDate < startDate) return 0;
      const diffTime = Math.abs(endDate - startDate);
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Leave Applications</h2>

        {leaveApplications.length === 0 && <p className="text-gray-500">No leave applications found.</p>}

        {leaveApplications.map((la) => (
          <div key={la.id} className="border bg-white shadow p-4 rounded flex flex-col md:flex-row justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-lg">{la.employee_name}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full border ${la.type === 'sick' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                  la.type === 'casual' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                    'bg-gray-50 border-gray-200 text-gray-700'
                  }`}>
                  {la.type}
                </span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${la.status === 'approved' ? 'bg-green-100 text-green-800' :
                  la.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    la.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                      'bg-yellow-100 text-yellow-800'
                  }`}>
                  {la.status}
                </span>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <span className="font-medium">Period:</span> {la.start_date} to {la.end_date}
                  <span className="font-bold ml-2">({la.days || calculateDays(la.start_date, la.end_date)} Days)</span>
                </p>
                <p><span className="font-medium">Reason:</span> {la.reason || 'No reason provided'}</p>
                {la.document_url && (
                  <p>
                    <span className="font-medium">Document:</span>
                    <a
                      href={`${API_BASE_URL.replace('/api', '')}/${la.document_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-indigo-600 hover:text-indigo-800 underline"
                    >
                      View Attachment
                    </a>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 min-w-[150px] justify-end">
              {la.status === 'pending' ? (
                <>
                  <button onClick={() => handleApproveLeave(la.id)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium transition">
                    Approve
                  </button>
                  <button onClick={() => handleRejectLeave(la.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm font-medium transition">
                    Reject
                  </button>
                </>
              ) : (
                <span className="text-xs text-gray-400 italic mt-1">Processed</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const CARD_COLORS = {
    indigo: 'bg-indigo-600',
    emerald: 'bg-emerald-600',
    blue: 'bg-blue-600',
    amber: 'bg-amber-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-600',
    red: 'bg-red-600',
  };

  const Card = ({ label, value, color }) => (
    <div className={`${CARD_COLORS[color]} text-white p-6 rounded-xl shadow`}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="text-3xl font-bold">{value ?? 0}</p>
    </div>
  );
  const renderAnalytics = () => {
    if (!analytics) {
      return <div className="text-gray-600">Loading analytics...</div>;
    }

    const deptData = analytics.departmentDistribution || [];
    const leaveDeptData = analytics.departmentLeaveDistribution || [];

    const leaveStatusData = [
      { name: 'Approved', value: analytics.summary?.approvedLeaves || 0 },
      { name: 'Pending', value: analytics.summary?.pendingLeaves || 0 },
      { name: 'Rejected', value: analytics.summary?.rejectedLeaves || 0 },
    ];

    const PIE_COLORS = ['#22c55e', '#eab308', '#ef4444']; // green, yellow, red
    const BAR_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f97316'];

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">HR Analytics Overview</h2>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card label="Total Employees" value={analytics.summary?.totalEmployees} color="indigo" />
          <Card label="Managers" value={analytics.summary?.totalManagers} color="emerald" />
          <Card label="HR" value={analytics.summary?.totalHr} color="blue" />
          <Card label="Regular Staff" value={analytics.summary?.totalRegulars} color="amber" />
          <Card label="Pending Leaves" value={analytics.summary?.pendingLeaves} color="yellow" />
          <Card label="Approved Leaves" value={analytics.summary?.approvedLeaves} color="green" />
          <Card label="Rejected Leaves" value={analytics.summary?.rejectedLeaves} color="red" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart - Leave Status */}
          <div className="bg-white p-6 rounded-xl shadow flex flex-col">
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Leave Status Overview</h3>
            <p className="text-xs text-gray-500 mb-4">
              Distribution of leave requests by status.
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leaveStatusData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    label
                  >
                    {leaveStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart - Employees by Department */}
          <div className="bg-white p-6 rounded-xl shadow flex flex-col">
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Employees by Department</h3>
            <p className="text-xs text-gray-500 mb-4">
              Headcount distribution across departments.
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="department" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count">
                    {deptData.map((entry, index) => (
                      <Cell
                        key={`bar-cell-${index}`}
                        fill={BAR_COLORS[index % BAR_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bar Chart - Leaves by Department */}
        <div className="bg-white p-6 rounded-xl shadow flex flex-col">
          <h3 className="text-lg font-semibold mb-2 text-gray-900">Leaves by Department</h3>
          <p className="text-xs text-gray-500 mb-4">
            Number of leave requests raised from each department.
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leaveDeptData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="leaveCount">
                  {leaveDeptData.map((entry, index) => (
                    <Cell
                      key={`leave-bar-${index}`}
                      fill={BAR_COLORS[index % BAR_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  const renderCalendar = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
        <h2 className="text-2xl font-bold text-gray-800">My Attendance & Holidays</h2>
        <div className="flex gap-2">
          {!attendanceMarked ? (
            <button
              onClick={handleMarkAttendance}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold"
            >
              Check In
            </button>
          ) : (
            <span className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-bold">✓ Checked In</span>
          )}

          {attendanceMarked && !checkoutMarked && (
            <button
              onClick={handleCheckout}
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
          Click on a date to manage holidays (HR Privilege).
        </p>
        <CalendarView
          attendance={attendanceRecords}
          holidays={holidays}
          role="hr"
          onDateClick={handleToggleHoliday}
        />
      </div>
    </div>
  );

  const renderSettings = () => (
    <div>
      <h2 className="text-2xl font-bold">Profile</h2>
      <p>Name: {user.name}</p>
      <p>Email: {user.email}</p>
      <p>Role: {user.role}</p>
    </div>
  );

  if (loading)
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="h-16 flex items-center justify-center border-b border-gray-700 text-lg font-semibold">
          HRMS HR Panel
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {Object.values(TABS).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-4 py-2 rounded ${activeTab === tab ? 'bg-slate-800' : 'hover:bg-slate-700'
                }`}
            >
              {tab.replace(/([A-Z])/g, ' $1').trim()}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 w-full py-2 rounded text-sm text-white"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-y-auto">
        {activeTab === TABS.DASHBOARD && renderDashboard()}
        {activeTab === TABS.EMPLOYEES && renderEmployeeList()}
        {activeTab === TABS.LEAVE_APPLICATIONS && renderLeaveApplications()}
        {activeTab === TABS.CALENDAR && renderCalendar()}
        {activeTab === TABS.ANALYTICS && renderAnalytics()}
        {activeTab === TABS.SETTINGS && renderSettings()}
      </main>
    </div>
  );
}

export default HrDashboard;
