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
  const [todayAttendance, setTodayAttendance] = useState(null); 
  const [attendanceRecords, setAttendanceRecords] = useState([]); 

  // Leaves state
  const [leaveBalance, setLeaveBalance] = useState({
    total: 5,
    used: 0,
    sick: 0,
    casual: 0,
    paid: 0,
    emergency: 0
  });
  const [leaveHistory, setLeaveHistory] = useState([]); 
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
        <div className="text-lg">Loading Dashboard...</div>
      </div>
    );
  }

  // --- Render Sections (Updated with New CSS Classes) ---

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col shadow-xl">
        <div className="h-16 flex items-center justify-center border-b border-slate-800">
           <span className="text-lg font-semibold tracking-wide">Employee Panel</span>
        </div>
        
        <nav className="flex-1 py-4 space-y-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${
              activeTab === 'dashboard'
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${
              activeTab === 'attendance'
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Attendance
          </button>
          <button
            onClick={() => setActiveTab('leaves')}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${
              activeTab === 'leaves'
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Leaves
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${
              activeTab === 'settings'
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Settings
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6">
          <div>
             <h1 className="text-xl font-semibold text-gray-900">
               {activeTab === 'dashboard' ? 'Overview' :
                activeTab === 'attendance' ? 'Attendance History' :
                activeTab === 'leaves' ? 'Leave Management' : 'My Profile'}
             </h1>
             <p className="text-xs text-gray-500">
               Welcome back, {profile?.user?.name || 'Employee'}
             </p>
          </div>
          <div className="text-sm font-medium text-gray-600">
            {profile?.user?.email}
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 p-6 overflow-y-auto">
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
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Dashboard Overview</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* 1. Attendance Card (Blue Gradient) */}
                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl p-5 shadow-lg flex flex-col justify-between">
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
                  </div>
                  <button
                    onClick={handleMarkAttendance}
                    disabled={todayAttendance?.status === 'present'}
                    className={`mt-4 w-full text-xs font-bold px-3 py-2 rounded-lg transition ${
                      todayAttendance?.status === 'present'
                        ? 'bg-white/20 text-white cursor-not-allowed'
                        : 'bg-white text-indigo-600 hover:bg-indigo-50 shadow-md'
                    }`}
                  >
                    {todayAttendance?.status === 'present' ? 'Marked' : 'Check In Now'}
                  </button>
                </div>

                {/* 2. Leave Balance (Green Gradient) */}
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl p-5 shadow-lg">
                  <div className="text-sm uppercase tracking-wide opacity-80">Leave Balance</div>
                  <div className="mt-2 text-3xl font-bold">
                    {leaveBalance.total - leaveBalance.used}/{leaveBalance.total}
                  </div>
                  <div className="mt-1 text-xs opacity-80">
                     Days Remaining
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs opacity-80">
                    <span>Sick: {leaveBalance.sick}</span>
                    <span>Casual: {leaveBalance.casual}</span>
                  </div>
                </div>

                {/* 3. Last Leave Status (Sky Gradient) */}
                <div className="bg-gradient-to-r from-sky-500 to-sky-600 text-white rounded-xl p-5 shadow-lg">
                  <div className="text-sm uppercase tracking-wide opacity-80">Last Request</div>
                  {leaveHistory.length > 0 ? (
                    <>
                      <div className="mt-2 text-xl font-bold capitalize">
                        {leaveHistory[0].type}
                      </div>
                      <div className="mt-1 text-xs opacity-80">
                         {leaveHistory[0].start_date}
                      </div>
                      <div className="mt-3 inline-block px-2 py-1 bg-white/20 rounded text-xs font-bold uppercase">
                        {leaveHistory[0].status}
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-lg font-medium opacity-80">None yet</div>
                  )}
                </div>

                {/* 4. Notifications (Amber Gradient) */}
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl p-5 shadow-lg">
                  <div className="text-sm uppercase tracking-wide opacity-80">Notifications</div>
                  <div className="mt-2 text-3xl font-bold">{notifications.length}</div>
                  <div className="mt-1 text-xs opacity-80">
                     New Updates
                  </div>
                  <div className="mt-2 text-xs truncate opacity-75">
                    {notifications[0]?.message || 'No new alerts'}
                  </div>
                </div>
              </div>

              {/* Recent Notifications List */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Recent Notifications</h3>
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-500">You're all caught up!</p>
                ) : (
                  <ul className="space-y-3">
                    {notifications.map((n) => (
                      <li key={n.id || `${n.message}-${n.created_at}`} className="border-b last:border-0 pb-2 border-gray-100">
                        <div className="text-sm text-gray-800">{n.message}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {n.created_at && new Date(n.created_at).toLocaleString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* ATTENDANCE TAB */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Attendance Records</h2>
              <div className="bg-white rounded-xl shadow-sm p-6 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {attendanceRecords.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 text-center text-sm text-gray-500">
                            No records found for this month.
                          </td>
                        </tr>
                      )}
                      {attendanceRecords.map((rec) => (
                        <tr key={rec.date} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {new Date(rec.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                rec.status === 'present'
                                  ? 'bg-green-100 text-green-800'
                                  : rec.status === 'absent'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                              {rec.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {rec.check_in || '--'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {rec.check_out || '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* LEAVES TAB */}
          {activeTab === 'leaves' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Leave Management</h2>
                <button
                  onClick={handleEmergencyLeave}
                  className="bg-red-600 text-white px-4 py-2 rounded shadow-sm hover:bg-red-700 text-sm font-bold uppercase tracking-wider"
                >
                  Emergency Leave
                </button>
              </div>

              {/* Apply Leave Form */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Apply for Leave</h3>
                <form onSubmit={handleApplyLeave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Leave Type</label>
                    <select
                      value={leaveForm.type}
                      onChange={(e) => handleLeaveFormChange('type', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="sick">Sick Leave</option>
                      <option value="casual">Casual Leave</option>
                      <option value="paid">Paid Leave</option>
                      <option value="emergency">Emergency Leave</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={leaveForm.startDate}
                        onChange={(e) => handleLeaveFormChange('startDate', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                      <input
                        type="date"
                        value={leaveForm.endDate}
                        onChange={(e) => handleLeaveFormChange('endDate', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
                    <textarea
                      rows="3"
                      value={leaveForm.reason}
                      onChange={(e) => handleLeaveFormChange('reason', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Please provide a valid reason..."
                    />
                  </div>

                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={leaveSubmitting}
                      className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow-md hover:bg-indigo-700 text-sm font-bold uppercase tracking-wider transition-transform transform hover:-translate-y-1"
                    >
                      {leaveSubmitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Leave History Table */}
              <div className="bg-white rounded-xl shadow-sm p-6 overflow-hidden">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Request History</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {leaveHistory.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 text-center text-sm text-gray-500">
                            No leave history available.
                          </td>
                        </tr>
                      )}
                      {leaveHistory.map((l) => (
                        <tr key={l.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 capitalize">{l.type}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {l.start_date} → {l.end_date}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-xs">{l.reason}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                l.status === 'approved'
                                  ? 'bg-green-100 text-green-800'
                                  : l.status === 'rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                              {l.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-2xl mx-auto">
               <h2 className="text-2xl font-bold text-gray-900">Profile Settings</h2>
               
               <div className="bg-white rounded-xl shadow-sm p-6">
                 <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={profile?.user?.email || ''}
                        disabled
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={settingsForm.name}
                        onChange={(e) => handleSettingsChange('name', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Your full name"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Display Name</label>
                      <input
                        type="text"
                        value={settingsForm.display_name}
                        onChange={(e) => handleSettingsChange('display_name', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Preferred display name"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Bio</label>
                      <textarea
                        rows="4"
                        value={settingsForm.bio}
                        onChange={(e) => handleSettingsChange('bio', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Tell us a bit about yourself..."
                      />
                    </div>

                    <div className="flex justify-end pt-4">
                      <button
                        type="submit"
                        disabled={settingsSaving}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow-md hover:bg-indigo-700 text-sm font-bold uppercase tracking-wider transition-transform transform hover:-translate-y-1"
                      >
                        {settingsSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                 </form>
               </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default EmployeeDashboard;