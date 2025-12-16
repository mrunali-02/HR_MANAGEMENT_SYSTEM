// src/components/ManagerDashboard.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Bell } from 'lucide-react';
import CalendarView from '../components/CalendarView';
import './AdminDashboard.css'; // reuse admin styling

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const TABS = {
  DASHBOARD: 'dashboard',
  ATTENDANCE: 'attendance',
  WORK_HOURS: 'workHours',
  LEAVES: 'leaves',
  APPLY_LEAVE: 'applyLeave',
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
  const [success, setSuccess] = useState('');

  // My Leave Application State
  const [myLeaveHistory, setMyLeaveHistory] = useState([]);
  const [myLeaveForm, setMyLeaveForm] = useState({
    type: 'sick',
    startDate: '',
    endDate: '',
    reason: '',
    document: null
  });
  const [myLeaveSubmitting, setMyLeaveSubmitting] = useState(false);

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

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Phone editing state
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [tempPhone, setTempPhone] = useState('');

  // Address editing state
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [tempAddress, setTempAddress] = useState('');

  // Emergency Contact editing state
  const [isEditingEmergency, setIsEditingEmergency] = useState(false);
  const [tempEmergency, setTempEmergency] = useState('');

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
      // 3) Holidays & My Attendance & My Leaves [NEW]
      try {
        fetchNotifications();
        const [holidayRes, myAttRes, myLeavesRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/holidays`, { headers: getAuthHeader() }),
          axios.get(`${API_BASE_URL}/employee/${id}/attendance`, { headers: getAuthHeader() }),
          axios.get(`${API_BASE_URL}/employee/${id}/leaves`, { headers: getAuthHeader() })
        ]);
        setHolidays(holidayRes.data.holidays || []);

        setMyAttendanceRecords(myAttRes.data.records || []);
        setMyTodayAttendance(myAttRes.data.today || null);
        setAttendanceMarked(myAttRes.data.today?.status === 'present');
        setCheckoutMarked(!!myAttRes.data.today?.check_out);

        setMyLeaveHistory(myLeavesRes.data.leaves || myLeavesRes.data || []);

      } catch (err) {
        console.error('Error fetching calendar/leave data:', err);
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

  const fetchMyLeaves = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/employee/${id}/leaves`, { headers: getAuthHeader() });
      setMyLeaveHistory(response.data.leaves || response.data || []);
    } catch (err) {
      console.error('Error fetching my leaves:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/employee/${id}/notifications`, { headers: getAuthHeader() });
      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
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
          await axios.post(`${API_BASE_URL}/employee/${id}/attendance/mark`,
            { latitude, longitude, accuracy },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setSuccess('Checked in successfully!');
          // Refresh
          const attRes = await axios.get(`${API_BASE_URL}/employee/${id}/attendance`, { headers: { Authorization: `Bearer ${token}` } });
          setMyAttendanceRecords(attRes.data.records || []);
          setMyTodayAttendance(attRes.data.today || null);
          setAttendanceMarked(attRes.data.today?.status === 'present');
          setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
          console.error(err);
          let errorMsg = err.response?.data?.error || 'Check-in failed';

          // Debug/Fix: If backend says "already marked", we might be out of sync. Refresh state.
          if (errorMsg.includes('Attendance already marked')) {
            try {
              const token = localStorage.getItem('token');
              const attRes = await axios.get(`${API_BASE_URL}/employee/${id}/attendance`, { headers: { Authorization: `Bearer ${token}` } });
              setMyAttendanceRecords(attRes.data.records || []);
              setMyTodayAttendance(attRes.data.today || null);
              setAttendanceMarked(attRes.data.today?.status === 'present');
            } catch (refreshErr) {
              console.error('Failed to sync state after error:', refreshErr);
            }
          }

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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleMyCheckout = async () => {
    if (!attendanceMarked || !myTodayAttendance?.check_in || checkoutMarked) return;

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
          const res = await axios.post(`${API_BASE_URL}/employee/${id}/attendance/checkout`,
            { latitude, longitude, accuracy },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const hours = res.data.total_hours || '0';
          setSuccess(`Checked out! Work hours: ${hours}`);

          // Refresh
          const attRes = await axios.get(`${API_BASE_URL}/employee/${id}/attendance`, { headers: { Authorization: `Bearer ${token}` } });
          setMyAttendanceRecords(attRes.data.records || []);
          setMyTodayAttendance(attRes.data.today || null);
          setCheckoutMarked(!!attRes.data.today?.check_out);
          setTimeout(() => setSuccess(''), 5000);
        } catch (err) {
          console.error(err);
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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
          {/* My Attendance Card */}
          <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg p-4 shadow flex flex-col justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide opacity-80 mb-1">My Status</p>
              <div className="text-xl font-bold">
                {myTodayAttendance?.status === 'present' ? 'Present' : 'Not Marked'}
              </div>
              {myTodayAttendance?.check_in && (
                <div className="mt-1 text-xs opacity-90">In: {myTodayAttendance.check_in}</div>
              )}
              {myTodayAttendance?.check_out && (
                <div className="mt-1 text-xs opacity-90">Out: {myTodayAttendance.check_out}</div>
              )}
            </div>
            <div className="mt-3 space-y-2">
              <button
                onClick={handleMarkMyAttendance}
                className={`w-full text-xs font-bold px-3 py-1.5 rounded shadow-sm ${attendanceMarked
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-white text-indigo-600 hover:bg-indigo-50'
                  }`}
                disabled={attendanceMarked}
              >
                {attendanceMarked ? 'Checked In' : 'Check In'}
              </button>

              <button
                onClick={handleMyCheckout}
                className={`w-full text-xs font-bold px-3 py-1.5 rounded shadow-sm ${!attendanceMarked || checkoutMarked
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600'
                  }`}
                disabled={!attendanceMarked || checkoutMarked}
              >
                {checkoutMarked ? 'Checked Out' : 'Check Out'}
              </button>
            </div>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase">Team Size</p>
            <p className="text-2xl font-semibold text-gray-900">{teamSize}</p>
          </div>

        </div>

        {/* Notifications Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
              {notifications.length} New
            </span>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {notifications.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {notifications.map((n) => (
                  <li key={n.id} className={`py-3 flex items-start space-x-3 ${!n.is_read ? 'bg-blue-50/30' : ''}`}>
                    <span className="text-xl">📢</span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No new notifications</p>
            )}
          </div>
        </div>



        {/* My Leave & Approval Overview (Moved from Profile) */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave & Approval Overview</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{managerProfile?.stats?.leaves?.pending || 0}</p>
              <p className="text-xs text-yellow-700 font-medium uppercase mt-1">Pending</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{managerProfile?.stats?.leaves?.approved || 0}</p>
              <p className="text-xs text-green-700 font-medium uppercase mt-1">Approved</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{managerProfile?.stats?.leaves?.rejected || 0}</p>
              <p className="text-xs text-red-700 font-medium uppercase mt-1">Rejected</p>
            </div>
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
      </div >
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

  // ---------- MY LEAVE HANDLERS (Same as HR/Employee) ----------

  const handleMyLeaveFormChange = (field, value) => {
    if (field === 'startDate' || field === 'endDate') {
      const dateObj = new Date(value);
      const day = dateObj.getDay();
      if (day === 0 || day === 6) {
        alert('Weekends (Saturday/Sunday) cannot be selected for leave.');
        return;
      }

      const isHoliday = holidays.some(h => {
        let hDate = h.date;
        if (typeof h.date === 'string') {
          const d = new Date(h.date);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          hDate = `${year}-${month}-${day}`;
        }
        return hDate === value;
      });
      if (isHoliday) {
        alert('Selected date is a holiday.');
        return;
      }
    }
    if (field === 'type' && ['casual', 'paid'].includes(value)) {
      setMyLeaveForm(prev => ({ ...prev, [field]: value, document: null }));
      return;
    }
    setMyLeaveForm(prev => ({ ...prev, [field]: value }));
  };

  const handleApplyMyLeave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!myLeaveForm.startDate || !myLeaveForm.endDate || !myLeaveForm.reason) {
      setError('Please fill all leave fields.');
      return;
    }
    setMyLeaveSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('type', myLeaveForm.type);
      formData.append('start_date', myLeaveForm.startDate);
      formData.append('end_date', myLeaveForm.endDate);
      formData.append('reason', myLeaveForm.reason);
      if (myLeaveForm.document) formData.append('document', myLeaveForm.document);

      await axios.post(`${API_BASE_URL}/employee/${id}/leaves`, formData, {
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'multipart/form-data'
        },
      });
      setSuccess('Leave request submitted successfully!');
      setMyLeaveForm({ type: 'sick', startDate: '', endDate: '', reason: '', document: null });
      fetchMyLeaves();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to apply leave');
      setTimeout(() => setError(''), 5000);
    } finally {
      setMyLeaveSubmitting(false);
    }
  };

  const handleCancelMyLeave = async (leaveId) => {
    if (!window.confirm('Cancel this leave request?')) return;
    try {
      await axios.put(`${API_BASE_URL}/employee/${id}/leaves/${leaveId}/cancel`, {}, { headers: getAuthHeader() });
      setSuccess('Cancelled successfully!');
      fetchMyLeaves();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel');
      setTimeout(() => setError(''), 3000);
    }
  };

  const renderApplyLeave = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Apply for Compenstation/Leave</h2>
      <p className="text-sm text-gray-500">
        Applications here are visible to HR/Admin. You can view status below.
        (For <span className="font-bold">Team Leaves</span>, check the "Leave Requests" tab).
      </p>

      {/* Re-using dashboard error/success if visible there, but here we likely need local ones or ensure global are displayed */}
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 px-4 py-3 rounded">{success}</div>}

      <div className="bg-white p-6 rounded-xl shadow-sm">
        <form onSubmit={handleApplyMyLeave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Leave Type</label>
            <select value={myLeaveForm.type} onChange={e => handleMyLeaveFormChange('type', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2">
              <option value="sick">Sick Leave</option>
              <option value="casual">Casual Leave</option>
              <option value="paid">Planned Leave</option>
            </select>
          </div>

          <div />

          <div>
            <label className="block text-sm font-medium text-gray-700">Start Date</label>
            <input type="date" value={myLeaveForm.startDate} onChange={e => handleMyLeaveFormChange('startDate', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">End Date</label>
            <input type="date" min={myLeaveForm.startDate} value={myLeaveForm.endDate} onChange={e => handleMyLeaveFormChange('endDate', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2" />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Reason</label>
            <textarea rows="2" value={myLeaveForm.reason} onChange={e => handleMyLeaveFormChange('reason', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2" placeholder="Reason for leave..." />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Document {['casual', 'paid'].includes(myLeaveForm.type) ? '(Not Required)' : '(Optional)'}
            </label>
            <input
              type="file"
              disabled={['casual', 'paid'].includes(myLeaveForm.type)}
              onChange={e => handleMyLeaveFormChange('document', e.target.files[0])}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="md:col-span-2">
            <button type="submit" disabled={myLeaveSubmitting} className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
              {myLeaveSubmitting ? 'Submitting...' : 'Submit Leave Request'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm">
        <h3 className="text-lg font-bold mb-4">My Leave History</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {myLeaveHistory.length === 0 && <tr><td colSpan="4" className="px-4 py-4 text-center text-gray-500">No leaves found.</td></tr>}
              {myLeaveHistory.map(l => (
                <tr key={l.id}>
                  <td className="px-4 py-2 capitalize">{l.type}</td>
                  <td className="px-4 py-2">{l.start_date} to {l.end_date} <span className="text-gray-400 text-xs ml-1">({l.days} days)</span></td>
                  <td className="px-4 py-2"><span className={`px-2 py-1 rounded-full text-xs font-bold ${l.status === 'approved' ? 'bg-green-100 text-green-800' : l.status === 'rejected' ? 'bg-red-100 text-red-800' : l.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100'}`}>{l.status}</span></td>
                  <td className="px-4 py-2">{l.status === 'pending' && <button onClick={() => handleCancelMyLeave(l.id)} className="text-red-600 text-sm hover:underline">Cancel</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

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

        </div>
      </div>
    </div>
  );

  const renderCalendar = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
        <h2 className="text-2xl font-bold text-gray-800">My Attendance & Calendar</h2>

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

  // Handlers for Phone Editing
  const handleEditPhoneClick = () => {
    const currentPhone = managerProfile?.user?.phone || profile?.user?.phone || '';
    setTempPhone(currentPhone);
    setIsEditingPhone(true);
  };

  const handleCancelEditPhone = () => {
    setIsEditingPhone(false);
    setTempPhone('');
  };

  const handleSavePhone = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/employee/${id}/profile`,
        { phone: tempPhone },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local state to reflect change immediately without full reload if possible, 
      // or just reload profile.
      alert('Phone number updated successfully');
      setIsEditingPhone(false);

      // Refresh key data
      loadManagerData();
    } catch (err) {
      console.error('Failed to update phone:', err);
      alert('Failed to update phone number');
    }
  };

  // Handlers for Address Editing
  const handleEditAddressClick = () => {
    const currentAddress = managerProfile?.user?.address || profile?.user?.address || '';
    setTempAddress(currentAddress);
    setIsEditingAddress(true);
  };

  const handleCancelEditAddress = () => {
    setIsEditingAddress(false);
    setTempAddress('');
  };

  const handleSaveAddress = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/employee/${id}/profile`,
        { address: tempAddress },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Address updated successfully');
      setIsEditingAddress(false);
      loadManagerData();
    } catch (err) {
      console.error('Failed to update address:', err);
      alert('Failed to update address');
    }
  };

  // Handlers for Emergency Contact Editing
  const handleEditEmergencyClick = () => {
    const currentEmergency = managerProfile?.user?.emergency_contact || profile?.user?.emergency_contact || '';
    setTempEmergency(currentEmergency);
    setIsEditingEmergency(true);
  };

  const handleCancelEditEmergency = () => {
    setIsEditingEmergency(false);
    setTempEmergency('');
  };

  const handleSaveEmergency = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/employee/${id}/profile`,
        { emergency_contact: tempEmergency },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Emergency contact updated successfully');
      setIsEditingEmergency(false);
      loadManagerData();
    } catch (err) {
      console.error('Failed to update emergency contact:', err);
      alert('Failed to update emergency contact');
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
              <div className="grid grid-cols-3 gap-2 items-center">
                <span className="text-gray-500 font-medium">Phone:</span>
                <span className="col-span-2 text-gray-900 flex items-center justify-between">
                  {isEditingPhone ? (
                    <div className="flex items-center space-x-2 w-full">
                      <input
                        type="text"
                        value={tempPhone}
                        onChange={(e) => setTempPhone(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter phone number"
                      />
                      <button
                        onClick={handleSavePhone}
                        className="p-1 text-green-600 hover:text-green-800"
                        title="Save"
                      >
                        ✅
                      </button>
                      <button
                        onClick={handleCancelEditPhone}
                        className="p-1 text-red-600 hover:text-red-800"
                        title="Cancel"
                      >
                        ❌
                      </button>
                    </div>
                  ) : (
                    <>
                      <span>{user.phone || 'Not set'}</span>
                      <button
                        onClick={handleEditPhoneClick}
                        className="ml-2 text-xs text-indigo-600 hover:underline hover:text-indigo-800 focus:outline-none"
                      >
                        Edit
                      </button>
                    </>
                  )}
                </span>
              </div>

              {/* Address */}
              <div className="grid grid-cols-3 gap-2 items-center">
                <span className="text-gray-500 font-medium">Address:</span>
                <span className="col-span-2 text-gray-900 flex items-center justify-between">
                  {isEditingAddress ? (
                    <div className="flex items-center space-x-2 w-full">
                      <input
                        type="text"
                        value={tempAddress}
                        onChange={(e) => setTempAddress(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter address"
                      />
                      <button
                        onClick={handleSaveAddress}
                        className="p-1 text-green-600 hover:text-green-800"
                        title="Save"
                      >
                        ✅
                      </button>
                      <button
                        onClick={handleCancelEditAddress}
                        className="p-1 text-red-600 hover:text-red-800"
                        title="Cancel"
                      >
                        ❌
                      </button>
                    </div>
                  ) : (
                    <>
                      <span>{user.address || 'Not set'}</span>
                      <button
                        onClick={handleEditAddressClick}
                        className="ml-2 text-xs text-indigo-600 hover:underline hover:text-indigo-800 focus:outline-none"
                      >
                        Edit
                      </button>
                    </>
                  )}
                </span>
              </div>

              {/* Emergency Contact */}
              <div className="grid grid-cols-3 gap-2 items-center">
                <span className="text-gray-500 font-medium">Emergency Contact:</span>
                <span className="col-span-2 text-gray-900 flex items-center justify-between">
                  {isEditingEmergency ? (
                    <div className="flex items-center space-x-2 w-full">
                      <input
                        type="text"
                        value={tempEmergency}
                        onChange={(e) => setTempEmergency(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Enter emergency contact"
                      />
                      <button
                        onClick={handleSaveEmergency}
                        className="p-1 text-green-600 hover:text-green-800"
                        title="Save"
                      >
                        ✅
                      </button>
                      <button
                        onClick={handleCancelEditEmergency}
                        className="p-1 text-red-600 hover:text-red-800"
                        title="Cancel"
                      >
                        ❌
                      </button>
                    </div>
                  ) : (
                    <>
                      <span>{user.emergency_contact || 'Not set'}</span>
                      <button
                        onClick={handleEditEmergencyClick}
                        className="ml-2 text-xs text-indigo-600 hover:underline hover:text-indigo-800 focus:outline-none"
                      >
                        Edit
                      </button>
                    </>
                  )}
                </span>
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

          {/* 4. Work & Attendance Summary */}
          <div className="bg-white shadow-lg rounded-xl overflow-hidden p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Work & Attendance Summary</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm text-gray-500">Today's Status</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${stats?.work?.today_status === 'present' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {stats?.work?.today_status?.toUpperCase() || 'NOT MARKED'}
                </span>
              </div>

              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm text-gray-500">Monthly Hours</span>
                <span className="text-lg font-bold text-indigo-600">{stats?.work?.month_hours || 0} hrs</span>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">Monthly Attendance Summary</p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-green-50 p-2 rounded">
                    <div className="font-bold text-green-700">
                      {myAttendanceRecords.filter(r => r.status === 'present').length}
                    </div>
                    <div className="text-green-600">Present</div>
                  </div>
                  <div className="bg-red-50 p-2 rounded">
                    <div className="font-bold text-red-700">
                      {myAttendanceRecords.filter(r => r.status === 'absent').length}
                    </div>
                    <div className="text-red-600">Absent</div>
                  </div>
                  <div className="bg-yellow-50 p-2 rounded">
                    <div className="font-bold text-yellow-700">
                      {myAttendanceRecords.filter(r => r.status === 'late').length}
                    </div>
                    <div className="text-yellow-600">Late</div>
                  </div>
                </div>
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
            onClick={() => setActiveTab(TABS.APPLY_LEAVE)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === TABS.APPLY_LEAVE
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            Apply Leave
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
              {activeTab === TABS.APPLY_LEAVE && 'Apply Leave'}
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
          {activeTab === TABS.APPLY_LEAVE && renderApplyLeave()}
          {activeTab === TABS.CALENDAR && renderCalendar()}
          {activeTab === TABS.REPORTS && renderReports()}
          {activeTab === TABS.PROFILE && renderProfile()}
        </main>
        {renderChangePasswordModal()}
      </div >
    </div >
  );
}

export default ManagerDashboard;
