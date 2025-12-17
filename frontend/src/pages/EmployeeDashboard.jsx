
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './EmployeeDashboard.css';
import CalendarView from '../components/CalendarView';
import EmployeeReports from '../components/EmployeeReports';
import { formatDate } from '../utils/dateUtils';

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
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [checkoutMarked, setCheckoutMarked] = useState(false);

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
  });
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [leaveForm, setLeaveForm] = useState({
    type: 'sick',
    startDate: '',
    endDate: '',
    reason: '',
    document: null
  });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [holidays, setHolidays] = useState([]); // [NEW]

  // Notifications
  const [notifications, setNotifications] = useState([]);

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    email: '',
    role: '',
    department: '',
    joined_on: '',
    dob: '',
    gender: '',
    blood_group: '',
    display_name: '',
    phone: '',
    address: '',
    emergency_contact: ''
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

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

  // Clear messages when switching tabs
  useEffect(() => {
    setError('');
    setSuccess('');
  }, [activeTab]);

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
      const u = profileRes.data?.user || {};
      const p = profileRes.data?.profile || {};

      setSettingsForm({
        name: u.name || '',
        email: u.email || '',
        role: u.role || '',
        department: u.department || '',
        joined_on: u.created_at ? u.created_at.split('T')[0] : '',
        dob: u.dob ? u.dob.split('T')[0] : '',
        gender: u.gender || '',
        blood_group: u.blood_group || '',
        display_name: p.display_name || u.name || '',
        phone: u.phone || '',
        address: u.address || '',
        emergency_contact: u.emergency_contact || ''
      });

      // 2) Attendance
      try {
        const attRes = await axios.get(`${API_BASE_URL}/employee/${id}/attendance`, { headers });
        setAttendanceRecords(attRes.data.records || []);
        setTodayAttendance(attRes.data.today || null);
        // Set attendance marked state if today's attendance exists
        setAttendanceMarked(attRes.data.today?.status === 'present');
        // Set checkout marked state if checkout time exists
        setCheckoutMarked(!!attRes.data.today?.check_out);
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

      // 5) Holidays [NEW]
      try {
        const holidayRes = await axios.get(`${API_BASE_URL}/holidays`, { headers });
        setHolidays(holidayRes.data.holidays || []);
      } catch (err) {
        console.error('Error fetching holidays', err);
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
    // Only allow if not already marked
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
            `${API_BASE_URL}/employee/${id}/attendance/mark`,
            { latitude, longitude, accuracy },
            { headers: { Authorization: `Bearer ${token}` } }
          );


          // Show message regardless of tab
          setSuccess('Attendance marked successfully!');
          setTimeout(() => setSuccess(''), 3000);

          setAttendanceMarked(true);
          // Refresh data
          const token2 = localStorage.getItem('token');
          const headers = { Authorization: `Bearer ${token2}` };
          const attRes = await axios.get(`${API_BASE_URL}/employee/${id}/attendance`, { headers });
          setAttendanceRecords(attRes.data.records || []);
          setTodayAttendance(attRes.data.today || null);
          setCheckoutMarked(!!attRes.data.today?.check_out);
        } catch (err) {
          console.error('Error marking attendance:', err);
          let errorMsg = err.response?.data?.error || 'Failed to mark attendance.';

          // Debug/Fix: If backend says "already marked", we might be out of sync. Refresh state.
          if (errorMsg.includes('Attendance already marked')) {
            try {
              const token2 = localStorage.getItem('token');
              const headers = { Authorization: `Bearer ${token2}` };
              const attRes = await axios.get(`${API_BASE_URL}/employee/${id}/attendance`, { headers });
              setAttendanceRecords(attRes.data.records || []);
              setTodayAttendance(attRes.data.today || null);
              setAttendanceMarked(attRes.data.today?.status === 'present');
              setCheckoutMarked(!!attRes.data.today?.check_out);
            } catch (refreshErr) {
              console.error('Failed to sync state after error:', refreshErr);
            }
          }

          if (err.response?.data?.distance) {
            errorMsg += ` (Distance: ${err.response.data.distance}m, Max: ${err.response.data.max_distance}m)`;
          }

          setError(errorMsg);
          // Clear location fetching message if error occurs
          if (success === 'Fetching location...') setSuccess('');
          window.scrollTo({ top: 0, behavior: 'smooth' });
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
    );
  };

  const handleCheckout = async () => {
    // Only allow if checked in but not checked out
    if (!attendanceMarked || !todayAttendance?.check_in || checkoutMarked) {
      return;
    }

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
          const response = await axios.post(
            `${API_BASE_URL}/employee/${id}/attendance/checkout`,
            { latitude, longitude, accuracy },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          // Only set success if we're on the attendance tab
          if (activeTab === 'attendance') {
            const hours = response.data.total_hours || '0';
            setSuccess(`Checkout marked successfully! Worked ${hours} hours`);
            setTimeout(() => setSuccess(''), 5000);
          }

          // Mark as checked out and refresh attendance
          setCheckoutMarked(true);
          const token2 = localStorage.getItem('token');
          const headers = { Authorization: `Bearer ${token2}` };
          const attRes = await axios.get(`${API_BASE_URL}/employee/${id}/attendance`, { headers });
          setAttendanceRecords(attRes.data.records || []);
          setTodayAttendance(attRes.data.today || null);
        } catch (err) {
          console.error('Error marking checkout:', err);
          let errorMsg = err.response?.data?.error || 'Failed to mark checkout';
          if (err.response?.data?.distance) {
            errorMsg += ` (Distance: ${err.response.data.distance}m, Max: ${err.response.data.max_distance}m)`;
          }

          if (activeTab === 'attendance') {
            setError(errorMsg);
            if (success === 'Fetching location...') setSuccess('');
            setTimeout(() => setError(''), 5000);
          }
        }
      },
      (geoError) => {
        console.error('Geolocation error:', geoError);
        let msg = 'Unable to retrieve location.';
        if (geoError.code === 1) msg = 'Location permission denied. Please enable GPS.';
        else if (geoError.code === 2) msg = 'Location unavailable.';
        else if (geoError.code === 3) msg = 'Location request timed out.';

        if (activeTab === 'attendance') {
          setError(msg);
          setSuccess('');
        }
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
    );
  };

  const handleCancelLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to cancel this leave request?')) return;

    setError('');
    setSuccess('');
    const token = localStorage.getItem('token');

    try {
      await axios.put(`${API_BASE_URL}/employee/${id}/leaves/${leaveId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess('Leave request cancelled.');
      // Refresh list
      const leavesRes = await axios.get(`${API_BASE_URL}/employee/${id}/leaves`, { headers: { Authorization: `Bearer ${token}` } });
      setLeaveHistory(leavesRes.data.leaves || leavesRes.data || []);

    } catch (err) {
      console.error('Error cancelling leave:', err);
      setError(err.response?.data?.error || 'Failed to cancel leave');
    }
  };

  const calculateLeaveDays = (start, end) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (endDate < startDate) return 0;

    let count = 0;
    let cur = new Date(startDate);
    while (cur <= endDate) {
      const year = cur.getFullYear();
      const month = String(cur.getMonth() + 1).padStart(2, '0');
      const day = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const isHoliday = holidays.some(h => {
        let hDate = h.date;
        if (typeof h.date === 'string') {
          const d = new Date(h.date);
          const hYear = d.getFullYear();
          const hMonth = String(d.getMonth() + 1).padStart(2, '0');
          const hDay = String(d.getDate()).padStart(2, '0');
          hDate = `${hYear}-${hMonth}-${hDay}`;
        }
        return hDate === dateStr;
      });

      if (!isHoliday) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const handleLeaveFormChange = (field, value) => {
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
        alert('Selected date is a holiday marked by HR/Admin.');
        return;
      }
    }
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
      const formData = new FormData();
      formData.append('type', leaveForm.type);
      formData.append('start_date', leaveForm.startDate);
      formData.append('end_date', leaveForm.endDate);
      formData.append('reason', leaveForm.reason);
      if (leaveForm.document) {
        formData.append('document', leaveForm.document);
      }

      await axios.post(
        `${API_BASE_URL}/employee/${id}/leaves`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      // Only set success if we're on the leaves tab
      if (activeTab === 'leaves') {
        setSuccess('Leave applied successfully!');
        setTimeout(() => setSuccess(''), 3000);
      }
      setLeaveForm({ type: 'sick', startDate: '', endDate: '', reason: '', document: null });

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
      if (activeTab === 'leaves') {
        setError(err.response?.data?.error || 'Failed to apply leave');
        setTimeout(() => setError(''), 5000);
      }
    } finally {
      setLeaveSubmitting(false);
    }
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
          phone: settingsForm.phone,
          address: settingsForm.address,
          emergency_contact: settingsForm.emergency_contact
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Settings saved successfully!');
      // Update local profile state
      setProfile((prev) => ({
        ...prev,
        user: {
          ...prev.user,
          name: settingsForm.name,
          phone: settingsForm.phone,
          address: settingsForm.address,
          emergency_contact: settingsForm.emergency_contact
        },
        profile: {
          ...(prev.profile || {}),
          display_name: settingsForm.display_name,
        }
      }));
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handlePasswordChange = (field, value) => {
    setPasswordForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (!passwordForm.currentPassword) {
      setError('Current password is required');
      return;
    }

    setPasswordSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/employee/${id}/change-password`,
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
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
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === 'dashboard'
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === 'attendance'
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            Attendance
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === 'calendar'
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setActiveTab('leaves')}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === 'leaves'
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            Leaves
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === 'reports'
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            Reports
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === 'settings'
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
            <h1 className="text-xl font-bold text-indigo-700 block mb-1">Vivekanand Technologies</h1>
            <h2 className="text-lg font-semibold text-gray-900">
              {activeTab === 'dashboard' ? 'Overview' :
                activeTab === 'attendance' ? 'Attendance History' :
                  activeTab === 'calendar' ? 'Calendar' :
                    activeTab === 'leaves' ? 'Leave Management' : 'My Profile'}
            </h2>
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
          {/* Show error/success only on relevant tabs */}
          {(activeTab === 'attendance' || activeTab === 'dashboard') && error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}
          {(activeTab === 'attendance' || activeTab === 'dashboard') && success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4 text-sm">
              {success}
            </div>
          )}
          {activeTab === 'leaves' && error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}
          {activeTab === 'leaves' && success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4 text-sm">
              {success}
            </div>
          )}

          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Dashboard Overview</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

                {/* 1. Attendance Card (Blue Gradient) */}
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
                        {todayAttendance.overtime_hours && parseFloat(todayAttendance.overtime_hours) > 0 && (
                          <span className="ml-1">(+{todayAttendance.overtime_hours} OT)</span>
                        )}
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

                    <button
                      onClick={handleCheckout}
                      disabled={!attendanceMarked || checkoutMarked}
                      className={`w-full text-xs font-bold px-3 py-2 rounded-lg transition ${!attendanceMarked || checkoutMarked
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md'
                        }`}
                    >
                      {checkoutMarked ? '✓ Checked Out' : 'Check Out'}
                    </button>
                  </div>
                </div>

                {/* 2. Leave Balance (Green Gradient) */}
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl p-5 shadow-lg h-full flex flex-col justify-between">
                  <div>
                    <div className="text-sm uppercase tracking-wide opacity-80">Leave Balance</div>
                    <div className="mt-2 text-3xl font-bold">
                      {(leaveBalance.sick || 0) + (leaveBalance.casual || 0) + (leaveBalance.paid || 0)}/24
                    </div>
                    <div className="mt-1 text-xs opacity-80">
                      Days Remaining
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-1 text-xs opacity-90 font-medium">
                    <div className="flex flex-col items-center">
                      <span className="opacity-75">Planned</span>
                      <span className="text-sm">{leaveBalance.paid}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="opacity-75">Casual</span>
                      <span className="text-sm">{leaveBalance.casual}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="opacity-75">Sick</span>
                      <span className="text-sm">{leaveBalance.sick}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Attendance Rate Card (White) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-4">
                      <h3 className="text-sm font-medium text-gray-500">Attendance Rate</h3>
                      <div className="p-2 bg-blue-50 rounded-full">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {attendanceRecords.length > 0
                        ? Math.round((attendanceRecords.filter(r => r.status === 'present').length / attendanceRecords.length) * 100)
                        : 0}%
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Based on last 30 days</p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-4">
                    <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${attendanceRecords.length > 0 ? Math.round((attendanceRecords.filter(r => r.status === 'present').length / attendanceRecords.length) * 100) : 0}%` }}></div>
                  </div>
                </div>

                {/* 4. Overtime Hours Card (White) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-4">
                      <h3 className="text-sm font-medium text-gray-500">Overtime Hours</h3>
                      <div className="p-2 bg-orange-50 rounded-full">
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {attendanceRecords.reduce((acc, curr) => acc + (parseFloat(curr.overtime_hours) || 0), 0).toFixed(1)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Total Overtime (30 Days)</p>
                  </div>
                  <div className="mt-4 text-xs text-gray-400">
                    Accumulated overtime.
                  </div>
                </div>
              </div>

              {/* Recent Notifications List - Full Width Below Grid */}
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
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Attendance Records</h2>
                <div className="flex gap-2">
                  {!(attendanceMarked || todayAttendance?.status === 'present') ? (
                    <button
                      onClick={handleMarkAttendance}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-indigo-700 text-sm font-bold transition"
                    >
                      Check In Now
                    </button>
                  ) : (
                    <button
                      disabled
                      className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-md cursor-not-allowed opacity-90 text-sm font-bold"
                    >
                      ✓ Checked In
                    </button>
                  )}
                  {attendanceMarked && !checkoutMarked && todayAttendance?.check_in && (
                    <button
                      onClick={handleCheckout}
                      className="bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-md hover:bg-emerald-600 text-sm font-bold transition"
                    >
                      Check Out
                    </button>
                  )}
                  {checkoutMarked && todayAttendance?.check_out && (
                    <button
                      disabled
                      className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-md cursor-not-allowed opacity-90 text-sm font-bold"
                    >
                      ✓ Checked Out
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Work Hours</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {attendanceRecords.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">
                            No records found for this month.
                          </td>
                        </tr>
                      )}
                      {attendanceRecords.map((rec) => (
                        <tr key={rec.date} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {formatDate(rec.date)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${rec.status === 'present'
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
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {rec.total_hours ? (
                              <span>
                                {rec.total_hours} hrs
                                {rec.overtime_hours && parseFloat(rec.overtime_hours) > 0 && (
                                  <span className="text-emerald-600 ml-1">
                                    (+{rec.overtime_hours} OT)
                                  </span>
                                )}
                              </span>
                            ) : (
                              '--'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* CALENDAR TAB [NEW] */}
          {activeTab === 'calendar' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Calendar</h2>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <CalendarView
                  attendance={attendanceRecords}
                  holidays={holidays}
                  role="employee"
                />
              </div>
            </div>
          )}

          {/* LEAVES TAB */}
          {activeTab === 'leaves' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Leave Management</h2>
              </div>

              {/* Apply Leave Form */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Apply for Leave</h3>
                <form onSubmit={handleApplyLeave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Leave Type</label>
                    <select
                      value={leaveForm.type}
                      onChange={(e) => {
                        const newType = e.target.value;
                        setLeaveForm(prev => ({
                          ...prev,
                          type: newType,
                          document: newType !== 'sick' ? null : prev.document
                        }));
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="sick">Sick Leave</option>
                      <option value="casual">Casual Leave</option>
                      <option value="paid">Planned Leave</option>
                      <option value="work_from_home">Work From Home</option>
                    </select>

                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={leaveForm.startDate}
                        onChange={(e) => handleLeaveFormChange('startDate', e.target.value)}
                        onKeyDown={(e) => e.preventDefault()}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                      <input
                        type="date"
                        min={leaveForm.startDate}
                        value={leaveForm.endDate}
                        onChange={(e) => handleLeaveFormChange('endDate', e.target.value)}
                        onKeyDown={(e) => e.preventDefault()}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {leaveForm.startDate && leaveForm.endDate && (
                    <div className="col-span-1 md:col-span-2 text-sm text-indigo-600 font-medium">
                      Total Leave Days: {calculateLeaveDays(leaveForm.startDate, leaveForm.endDate)}
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Upload Document {leaveForm.type !== 'sick' && '(Only for Sick Leave)'}
                    </label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      disabled={leaveForm.type !== 'sick'}
                      onChange={(e) => handleLeaveFormChange('document', e.target.files[0])}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
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
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{formatDate(l.start_date)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{formatDate(l.end_date)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-semibold">
                            {l.days || calculateLeaveDays(l.start_date, l.end_date)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            <div className="max-w-xs truncate" title={l.reason}>{l.reason}</div>
                            {l.document_url && (
                              <a
                                href={`${API_BASE_URL.replace('/api', '')}/${l.document_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block mt-1 text-xs text-indigo-600 hover:text-indigo-800 underline"
                              >
                                View Doc
                              </a>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${l.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : l.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : l.status === 'cancelled'
                                  ? 'bg-gray-100 text-gray-500'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                            {l.status === 'pending' && (
                              <button
                                onClick={() => handleCancelLeave(l.id)}
                                className="text-red-600 hover:text-red-900 border border-red-200 px-3 py-1 rounded hover:bg-red-50 bg-white"
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* REPORTS TAB */}
          {activeTab === 'reports' && (
            <div className="space-y-8 max-w-6xl mx-auto pb-10">
              <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
              <EmployeeReports attendanceData={attendanceRecords} leaveData={leaveHistory} />
            </div>
          )}

          {/* SETTINGS TAB */}
          {
            activeTab === 'settings' && (
              <div className="space-y-8 max-w-4xl mx-auto pb-10">
                <h2 className="text-2xl font-bold text-gray-900">Profile Settings</h2>

                {/* Section 1: Personal Details (Read Only) */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Personal Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { label: 'Full Name', value: settingsForm.name },
                      { label: 'Email', value: settingsForm.email },
                      { label: 'Role', value: settingsForm.role },
                      { label: 'Department', value: settingsForm.department },
                      { label: 'Date of Joining', value: settingsForm.joined_on, format: true },
                      { label: 'Date of Birth', value: settingsForm.dob, format: true },
                      { label: 'Gender', value: settingsForm.gender },
                      { label: 'Blood Group', value: settingsForm.blood_group }
                    ].map((field) => (
                      <div key={field.label}>
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">{field.label}</label>
                        <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700 font-medium">
                          {field.format && field.value ? formatDate(field.value) : field.value || '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 2: Contact & Preferences (Editable) */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Contact & Preferences</h3>
                  <form onSubmit={handleSaveSettings} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                        <input
                          type="text"
                          value={settingsForm.phone}
                          onChange={(e) => handleSettingsChange('phone', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                          placeholder="Enter phone number"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Emergency Contact</label>
                        <input
                          type="text"
                          value={settingsForm.emergency_contact}
                          onChange={(e) => handleSettingsChange('emergency_contact', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                          placeholder="Emergency contact info"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                      <textarea
                        rows="2"
                        value={settingsForm.address}
                        onChange={(e) => handleSettingsChange('address', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                        placeholder="Your residential address"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Display Name</label>
                        <input
                          type="text"
                          value={settingsForm.display_name}
                          onChange={(e) => handleSettingsChange('display_name', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                          placeholder="Preferred display name"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
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

                {/* Section 3: Security */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Security</h3>
                  <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Current Password</label>
                      <input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Enter current password"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Enter new password"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Confirm new password"
                      />
                    </div>
                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={passwordSaving}
                        className="bg-gray-800 text-white px-6 py-2 rounded-lg shadow-md hover:bg-gray-900 text-sm font-bold uppercase tracking-wider transition-transform transform hover:-translate-y-1"
                      >
                        {passwordSaving ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )
          }
        </main >
      </div >
    </div >
  );
}

export default EmployeeDashboard;