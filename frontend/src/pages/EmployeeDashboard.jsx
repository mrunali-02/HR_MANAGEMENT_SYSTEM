import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './EmployeeDashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

function EmployeeDashboard() {
  const { id } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | attendance | leaves | settings
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Attendance state
  const [todayAttendance, setTodayAttendance] = useState(null); // { status: 'present' | 'absent', date, check_in, check_out }
  const [attendanceRecords, setAttendanceRecords] = useState([]); // last 30 days

  // Leaves state
  const [leaveBalance, setLeaveBalance] = useState({
    total: 5,
    used: 0,
    sick: 0,
    casual: 0,
    paid: 0,
    emergency: 0
  });
  const [leaveHistory, setLeaveHistory] = useState([]); // past leave requests
  const [leaveForm, setLeaveForm] = useState({
    type: 'sick',
    startDate: '',
    endDate: '',
    reason: ''
  });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState([]);

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    display_name: '',
    bio: ''
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.id !== parseInt(id, 10) && user.role !== 'admin') {
      navigate('/login');
      return;
    }
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, navigate]);

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    const token = localStorage.getItem('token');

    if (!token) {
      navigate('/login');
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    try {
      // 1) Profile
      const profileRes = await axios.get(`${API_BASE_URL}/employee/${id}`, { headers });
      setProfile(profileRes.data);
      setSettingsForm({
        name: profileRes.data?.user?.name || '',
        display_name: profileRes.data?.profile?.display_name || '',
        bio: profileRes.data?.profile?.bio || ''
      });

      // 2) Attendance
      try {
        const attRes = await axios.get(`${API_BASE_URL}/employee/${id}/attendance`, { headers });
        setAttendanceRecords(attRes.data.records || []);
        setTodayAttendance(attRes.data.today || null);
      } catch (err) {
        console.error('Error fetching attendance:', err);
        // not fatal; just show empty
      }

      // 3) Leave balance & history
      try {
        const balanceRes = await axios.get(`${API_BASE_URL}/employee/${id}/leave-balance`, { headers });
        setLeaveBalance((prev) => ({
          ...prev,
          ...(balanceRes.data || {})
        }));
      } catch (err) {
        console.error('Error fetching leave balance:', err);
      }

      try {
        const leavesRes = await axios.get(`${API_BASE_URL}/employee/${id}/leaves`, { headers });
        setLeaveHistory(leavesRes.data.leaves || leavesRes.data || []);
      } catch (err) {
        console.error('Error fetching leave history:', err);
      }

      // 4) Notifications
      try {
        const notifRes = await axios.get(`${API_BASE_URL}/employee/${id}/notifications`, { headers });
        setNotifications(notifRes.data.notifications || notifRes.data || []);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      setError(error.response?.data?.error || 'Failed to load dashboard');
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
      await axios.post(
        `${API_BASE_URL}/logout`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      }
    } catch (err) {
      console.error('Error during logout:', err);
    } finally {
      await logout();
      navigate('/login');
    }
  };

  const handleMarkAttendance = async () => {
    setError('');
    setSuccess('');
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/employee/${id}/attendance/mark`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Attendance marked successfully!');
      // refresh attendance
      const token2 = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token2}` };
      const attRes = await axios.get(`${API_BASE_URL}/employee/${id}/attendance`, { headers });
      setAttendanceRecords(attRes.data.records || []);
      setTodayAttendance(attRes.data.today || null);
    } catch (err) {
      console.error('Error marking attendance:', err);
      setError(err.response?.data?.error || 'Failed to mark attendance');
    }
  };

  const handleLeaveFormChange = (field, value) => {
    setLeaveForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) {
      setError('Please fill all leave fields.');
      return;
    }

    const start = new Date(leaveForm.startDate);
    const end = new Date(leaveForm.endDate);
    if (end < start) {
      setError('End date cannot be before start date.');
      return;
    }

    setLeaveSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/employee/${id}/leaves`,
        {
          type: leaveForm.type,
          start_date: leaveForm.startDate,
          end_date: leaveForm.endDate,
          reason: leaveForm.reason
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Leave applied successfully!');
      setLeaveForm({ type: 'sick', startDate: '', endDate: '', reason: '' });

      // refresh leave history + balance
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const leavesRes = await axios.get(`${API_BASE_URL}/employee/${id}/leaves`, { headers });
        setLeaveHistory(leavesRes.data.leaves || leavesRes.data || []);
      } catch (err) {
        console.error('Error refresh leave history:', err);
      }
      try {
        const balanceRes = await axios.get(`${API_BASE_URL}/employee/${id}/leave-balance`, { headers });
        setLeaveBalance((prev) => ({ ...prev, ...(balanceRes.data || {}) }));
      } catch (err) {
        console.error('Error refresh leave balance:', err);
      }
    } catch (err) {
      console.error('Error applying leave:', err);
      setError(err.response?.data?.error || 'Failed to apply leave');
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleEmergencyLeave = () => {
    setLeaveForm((prev) => ({
      ...prev,
      type: 'emergency'
    }));
    setActiveTab('leaves');
  };

  const handleSettingsChange = (field, value) => {
    setSettingsForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSettingsSaving(true);

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/employee/${id}/profile`,
        {
          name: settingsForm.name,
          display_name: settingsForm.display_name,
          bio: settingsForm.bio
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Settings saved successfully!');
      // Update local profile state
      setProfile((prev) => ({
        ...prev,
        user: { ...prev.user, name: settingsForm.name },
        profile: {
          ...(prev.profile || {}),
          display_name: settingsForm.display_name,
          bio: settingsForm.bio
        }
      }));
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="col-span-12 md:col-span-3 lg:col-span-2 bg-white shadow rounded-2xl p-4 h-fit sticky top-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-bold">
              {profile?.user?.name ? profile.user.name[0].toUpperCase() : 'E'}
            </div>
            <div>
              <div className="text-sm font-semibold">
                {profile?.user?.name || 'Employee'}
              </div>
              <div className="text-xs text-gray-500">
                {profile?.user?.role ? profile.user.role.toUpperCase() : ''}
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                  : 'hover:bg-slate-50'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                activeTab === 'attendance'
                  ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                  : 'hover:bg-slate-50'
              }`}
            >
              Attendance
            </button>
            <button
              onClick={() => setActiveTab('leaves')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                activeTab === 'leaves'
                  ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                  : 'hover:bg-slate-50'
              }`}
            >
              Leaves
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                activeTab === 'settings'
                  ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                  : 'hover:bg-slate-50'
              }`}
            >
              Settings
            </button>

            <div className="pt-4 border-t mt-4">
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="col-span-12 md:col-span-9 lg:col-span-10">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold tracking-tight">
              {activeTab === 'dashboard'
                ? 'Dashboard'
                : activeTab === 'attendance'
                ? 'Attendance'
                : activeTab === 'leaves'
                ? 'Leaves'
                : 'Settings'}
            </h1>
            <div className="text-xs sm:text-sm text-gray-600">
              {profile?.user?.email}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4 text-sm">
              {success}
            </div>
          )}

          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <section className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Attendance card */}
                <div className="bg-white rounded-2xl shadow p-4 flex flex-col justify-between">
                  <div>
                    <div className="text-xs text-gray-500">Today&apos;s Attendance</div>
                    <div className="mt-2 text-xl font-semibold">
                      {todayAttendance?.status === 'present'
                        ? 'Present'
                        : todayAttendance?.status === 'absent'
                        ? 'Absent'
                        : 'Not marked yet'}
                    </div>
                    {todayAttendance?.check_in && (
                      <div className="mt-1 text-xs text-gray-500">
                        In: {todayAttendance.check_in} Out:{' '}
                        {todayAttendance.check_out || '--'}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleMarkAttendance}
                    disabled={todayAttendance?.status === 'present'}
                    className={`mt-3 w-full text-sm px-3 py-2 rounded-md ${
                      todayAttendance?.status === 'present'
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {todayAttendance?.status === 'present'
                      ? 'Attendance Marked'
                      : 'Mark Attendance'}
                  </button>
                </div>

                {/* Leave balance */}
                <div className="bg-white rounded-2xl shadow p-4">
                  <div className="text-xs text-gray-500">Leave Balance</div>
                  <div className="mt-2 text-2xl font-semibold">
                    {leaveBalance.total - leaveBalance.used}/{leaveBalance.total} days
                  </div>
                  <div className="mt-2 text-xs text-gray-500 space-y-1">
                    <div>Sick: {leaveBalance.sick}</div>
                    <div>Casual: {leaveBalance.casual}</div>
                    <div>Paid: {leaveBalance.paid}</div>
                    <div>Emergency: {leaveBalance.emergency}</div>
                  </div>
                </div>

                {/* Last leave status */}
                <div className="bg-white rounded-2xl shadow p-4">
                  <div className="text-xs text-gray-500">Last Leave Request</div>
                  {leaveHistory.length > 0 ? (
                    <div className="mt-2 text-sm">
                      <div className="font-semibold capitalize">
                        {leaveHistory[0].type} leave
                      </div>
                      <div className="text-xs text-gray-500">
                        {leaveHistory[0].start_date} → {leaveHistory[0].end_date}
                      </div>
                      <div className="mt-1 text-xs">
                        Status:{' '}
                        <span
                          className={`font-semibold ${
                            leaveHistory[0].status === 'approved'
                              ? 'text-green-600'
                              : leaveHistory[0].status === 'rejected'
                              ? 'text-red-600'
                              : 'text-yellow-600'
                          }`}
                        >
                          {leaveHistory[0].status}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-gray-500">
                      No leave requests yet.
                    </div>
                  )}
                </div>

                {/* Notifications count */}
                <div className="bg-white rounded-2xl shadow p-4">
                  <div className="text-xs text-gray-500">Notifications</div>
                  <div className="mt-2 text-2xl font-semibold">
                    {notifications.length}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Latest:
                    <div className="mt-1 line-clamp-2">
                      {notifications[0]?.message || 'No new notifications'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notification list */}
              <div className="bg-white rounded-2xl shadow p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold">Recent Notifications</h2>
                </div>
                {notifications.length === 0 ? (
                  <div className="text-sm text-gray-500">You&apos;re all caught up!</div>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {notifications.map((n) => (
                      <li
                        key={n.id || `${n.message}-${n.created_at}`}
                        className="flex items-start justify-between border-b last:border-b-0 pb-2"
                      >
                        <div>
                          <div>{n.message}</div>
                          <div className="text-xs text-gray-400">
                            {n.created_at &&
                              new Date(n.created_at).toLocaleString()}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {/* ATTENDANCE TAB */}
          {activeTab === 'attendance' && (
            <section>
              <div className="bg-white rounded-2xl shadow p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Attendance (Last 30 Days)</h2>
                </div>
                <div className="overflow-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                          Check In
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                          Check Out
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {attendanceRecords.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-4 text-center text-gray-500"
                          >
                            No attendance records found for this month.
                          </td>
                        </tr>
                      )}
                      {attendanceRecords.map((rec) => (
                        <tr key={rec.date}>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {new Date(rec.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap capitalize">
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs ${
                                rec.status === 'present'
                                  ? 'bg-green-50 text-green-700'
                                  : rec.status === 'absent'
                                  ? 'bg-red-50 text-red-700'
                                  : 'bg-yellow-50 text-yellow-700'
                              }`}
                            >
                              {rec.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {rec.check_in || '--'}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {rec.check_out || '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* LEAVES TAB */}
          {activeTab === 'leaves' && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Leaves</h2>
                <button
                  onClick={handleEmergencyLeave}
                  className="px-4 py-2 rounded-md text-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                >
                  Emergency Leave
                </button>
              </div>

              {/* Leave summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl shadow p-4">
                  <div className="text-xs text-gray-500">Total Balance</div>
                  <div className="mt-2 text-2xl font-semibold">
                    {leaveBalance.total - leaveBalance.used}/{leaveBalance.total} days
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow p-4">
                  <div className="text-xs text-gray-500">Sick Leaves</div>
                  <div className="mt-2 text-xl font-semibold">
                    {leaveBalance.sick} days
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow p-4">
                  <div className="text-xs text-gray-500">Casual Leaves</div>
                  <div className="mt-2 text-xl font-semibold">
                    {leaveBalance.casual} days
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow p-4">
                  <div className="text-xs text-gray-500">Paid / Emergency</div>
                  <div className="mt-2 text-sm">
                    Paid: <span className="font-semibold">{leaveBalance.paid}</span> days
                    <br />
                    Emergency:{' '}
                    <span className="font-semibold">{leaveBalance.emergency}</span> days
                  </div>
                </div>
              </div>

              {/* Apply leave form */}
              <div className="bg-white rounded-2xl shadow p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-semibold">Apply for Leave</h3>
                  <span className="text-xs text-gray-500">
                    Max continuous days may be limited by policy
                  </span>
                </div>
                <form
                  onSubmit={handleApplyLeave}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Leave Type
                    </label>
                    <select
                      value={leaveForm.type}
                      onChange={(e) =>
                        handleLeaveFormChange('type', e.target.value)
                      }
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="sick">Sick Leave</option>
                      <option value="casual">Casual Leave</option>
                      <option value="paid">Paid Leave</option>
                      <option value="emergency">Emergency Leave</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={leaveForm.startDate}
                        onChange={(e) =>
                          handleLeaveFormChange('startDate', e.target.value)
                        }
                        className="w-full border rounded-md px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={leaveForm.endDate}
                        onChange={(e) =>
                          handleLeaveFormChange('endDate', e.target.value)
                        }
                        className="w-full border rounded-md px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Reason
                    </label>
                    <textarea
                      rows="3"
                      value={leaveForm.reason}
                      onChange={(e) =>
                        handleLeaveFormChange('reason', e.target.value)
                      }
                      className="w-full border rounded-md px-3 py-2 text-sm resize-y"
                      placeholder="Explain why you need the leave..."
                    />
                  </div>

                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={leaveSubmitting}
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        leaveSubmitting
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {leaveSubmitting ? 'Submitting...' : 'Submit Leave Request'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Leave history */}
              <div className="bg-white rounded-2xl shadow p-4">
                <h3 className="text-md font-semibold mb-3">Leave History</h3>
                <div className="overflow-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                          From
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                          To
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                          Reason
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {leaveHistory.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-4 text-center text-gray-500"
                          >
                            No leave history available.
                          </td>
                        </tr>
                      )}
                      {leaveHistory.map((l) => (
                        <tr key={l.id}>
                          <td className="px-4 py-2 whitespace-nowrap capitalize">
                            {l.type}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {l.start_date ||
                              (l.start && new Date(l.start).toLocaleDateString())}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {l.end_date ||
                              (l.end && new Date(l.end).toLocaleDateString())}
                          </td>
                          <td className="px-4 py-2">
                            <span className="line-clamp-2">{l.reason}</span>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs capitalize ${
                                l.status === 'approved'
                                  ? 'bg-green-50 text-green-700'
                                  : l.status === 'rejected'
                                  ? 'bg-red-50 text-red-700'
                                  : 'bg-yellow-50 text-yellow-700'
                              }`}
                            >
                              {l.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <section>
              <div className="bg-white rounded-2xl shadow p-4">
                <h2 className="text-lg font-semibold mb-4">Profile Settings</h2>
                <form
                  onSubmit={handleSaveSettings}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Email (read-only)
                    </label>
                    <input
                      type="email"
                      value={profile?.user?.email || ''}
                      disabled
                      className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={settingsForm.name}
                      onChange={(e) =>
                        handleSettingsChange('name', e.target.value)
                      }
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={settingsForm.display_name}
                      onChange={(e) =>
                        handleSettingsChange('display_name', e.target.value)
                      }
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      placeholder="How your name appears in app"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Bio
                    </label>
                    <textarea
                      rows="3"
                      value={settingsForm.bio}
                      onChange={(e) =>
                        handleSettingsChange('bio', e.target.value)
                      }
                      className="w-full border rounded-md px-3 py-2 text-sm resize-y"
                      placeholder="Tell something about yourself..."
                    />
                  </div>

                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={settingsSaving}
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        settingsSaving
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {settingsSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default EmployeeDashboard;
