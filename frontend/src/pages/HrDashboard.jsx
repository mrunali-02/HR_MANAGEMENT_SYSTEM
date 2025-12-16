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
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import './HrDashboard.css';
import CalendarView from '../components/CalendarView';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const TABS = {
  DASHBOARD: 'dashboard',
  EMPLOYEES: 'employees',
  LEAVE_APPLICATIONS: 'leaveApplications',
  APPLY_LEAVE: 'applyLeave',
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
  const [workHoursStats, setWorkHoursStats] = useState(null);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [analyticsFilters, setAnalyticsFilters] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [leaveFilter, setLeaveFilter] = useState({
    search: '',
    type: 'all'
  });
  const [assigningManager, setAssigningManager] = useState({});

  // My Leave Application State (missing earlier)
  const [myLeaveHistory, setMyLeaveHistory] = useState([]);
  const [myLeaveForm, setMyLeaveForm] = useState({
    type: 'sick',
    startDate: '',
    endDate: '',
    reason: '',
    document: null
  });
  const [myLeaveSubmitting, setMyLeaveSubmitting] = useState(false);

  // Attendance & Calendar
  const [holidays, setHolidays] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [checkoutMarked, setCheckoutMarked] = useState(false);

  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    email: '',
    role: '',
    department: '',
    joined_on: '',
    dob: '',
    gender: '',
    blood_group: '',
    phone: '',
    emergency_contact: '',
    address: '',
    display_name: '',
    bio: '',
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'hr') {
      navigate('/login');
      return;
    }

    // load required data once
    Promise.all([
      fetchUsers(),
      fetchManagers(),
      fetchDashboardSummary(),
      fetchLeaveApplications(),
      fetchHolidays(),
      fetchMyAttendance(),
      fetchMyLeaves(),
      fetchAnalytics(),
      fetchSettings()
    ]).finally(() => {
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  /* ---------- Fetchers ---------- */

  const fetchHolidays = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/holidays`, {
        headers: { Authorization: `Bearer ${token}` },
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
        headers: { Authorization: `Bearer ${token}` },
      });
      setAttendanceRecords(res.data.records || []);
      setTodayAttendance(res.data.today || null);
      setAttendanceMarked(res.data.today?.status === 'present');
      setCheckoutMarked(!!res.data.today?.check_out);
    } catch (err) {
      console.error('Error fetching my attendance:', err);
    }
  };

  const fetchMyLeaves = async () => {
    if (!user?.id) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/employee/${user.id}/leaves`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyLeaveHistory(res.data.leaves || res.data || []);
    } catch (err) {
      console.error('Error fetching my leaves:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/hr/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.response?.data?.error || 'Failed to fetch users');
      setTimeout(() => setError(''), 5000);
    }
  };

  const fetchManagers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/hr/managers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setManagers(response.data.managers || []);
    } catch (err) {
      console.error('Error fetching managers:', err);
    }
  };

  const fetchDashboardSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/hr/dashboard/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDashboardSummary(response.data || {});
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
      // don't break rendering if endpoint missing; keep dashboardSummary null
    }
  };

  const fetchLeaveApplications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/hr/leave-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLeaveApplications(response.data.requests || response.data || []);
    } catch (err) {
      console.error('Error fetching leave requests:', err);
      setLeaveApplications([]);
    }
  };

  const fetchAnalytics = async (filters = analyticsFilters) => {
    try {
      const token = localStorage.getItem('token');
      const params = {
        startDate: filters.startDate,
        endDate: filters.endDate
      };
      const [res, workRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/hr/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
          params
        }),
        axios.get(`${API_BASE_URL}/hr/analytics/work-hours`, {
          headers: { Authorization: `Bearer ${token}` },
          params
        }),
      ]);
      setAnalytics(res.data || {});
      setWorkHoursStats(workRes.data || {});
    } catch (err) {
      console.error('Analytics fetch failed', err);
    }
  };

  const fetchSettings = async () => {
    if (!user?.id) return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/hr/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const u = response.data.user || {};
      const p = response.data.profile || {};
      setSettingsForm({
        name: u.name || '',
        email: u.email || '',
        role: u.role || '',
        department: u.department || '',
        joined_on: u.joined_on ? u.joined_on.substring(0, 10) : '',
        dob: u.dob ? u.dob.substring(0, 10) : '',
        gender: u.gender || '',
        blood_group: u.blood_group || '',
        phone: u.phone || '',
        emergency_contact: u.emergency_contact || '',
        address: u.address || '',
        display_name: p.display_name || '',
        bio: p.bio || '',
      });
    } catch (err) {
      console.error('Fetch settings failed', err);
    }
  };

  /* ---------- CSV helper + downloads ---------- */

  const downloadCSV = (data, filename) => {
    // guard if response isn't an array or is empty
    if (!Array.isArray(data) || data.length === 0) {
      alert('No data to export');
      return;
    }
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => JSON.stringify(row[header] ?? '')).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadReport = async (type) => {
    try {
      const token = localStorage.getItem('token');
      let endpoint = '';
      let filename = '';
      switch (type) {
        case 'attendance':
          endpoint = `${API_BASE_URL}/hr/export/attendance`;
          filename = 'attendance_report.csv';
          break;
        case 'leaves':
          endpoint = `${API_BASE_URL}/hr/export/leaves`;
          filename = 'leave_report.csv';
          break;
        case 'employees':
          endpoint = `${API_BASE_URL}/hr/export/employees`;
          filename = 'employee_report.csv';
          break;
        case 'work_hours':
          endpoint = `${API_BASE_URL}/hr/export/attendance`;
          filename = 'work_hours_report.csv';
          break;
        default:
          return;
      }
      const response = await axios.get(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      downloadCSV(response.data, filename);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download report');
    }
  };

  /* ---------- Leave approval/rejection ---------- */

  const handleApproveLeave = async (leaveId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/hr/leave-requests/${leaveId}/approve`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Leave request approved successfully!');
      fetchLeaveApplications();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve leave request');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleRejectLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to reject this leave?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/hr/leave-requests/${leaveId}/reject`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Leave request rejected successfully!');
      fetchLeaveApplications();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject leave request');
      setTimeout(() => setError(''), 5000);
    }
  };

  /* ---------- Users / managers ---------- */

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Confirm deletion?')) return;
    try {
      setError('');
      setSuccess('');
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/hr/users/${id}`, { headers: { Authorization: `Bearer ${token}` } });
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
      await axios.put(`${API_BASE_URL}/hr/employees/${employeeId}/assign-manager`, { managerId: managerId || null }, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Manager assigned successfully!');
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign manager');
      setTimeout(() => setError(''), 5000);
    } finally {
      setAssigningManager(prev => ({ ...prev, [employeeId]: false }));
    }
  };

  /* ---------- Attendance ---------- */

  const handleMarkAttendance = async () => {
    if (attendanceMarked || todayAttendance?.status === 'present') return;

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
          await axios.post(`${API_BASE_URL}/employee/${user.id}/attendance/mark`,
            { latitude, longitude, accuracy },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setSuccess('Checked in successfully!');
          fetchMyAttendance();
          setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
          console.error(err);
          let errorMsg = err.response?.data?.error || 'Check-in failed';

          if (errorMsg.includes('Attendance already marked')) {
            fetchMyAttendance(); // Sync state
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
        setError('Unable to retrieve location. Please enable GPS.');
        setSuccess('');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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

    setSuccess('Fetching location for checkout...');

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
          fetchMyAttendance();
          setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
          console.error(err);
          let errorMsg = err.response?.data?.error || 'Checkout failed';

          if (err.response?.data?.distance) {
            errorMsg += ` (Distance: ${err.response.data.distance}m, Max: ${err.response.data.max_distance}m)`;
          }
          setError(errorMsg);
          if (success === 'Fetching location for checkout...') setSuccess('');
        }
      },
      (geoError) => {
        console.error('Geolocation error:', geoError);
        setError('Unable to retrieve location. Please enable GPS.');
        setSuccess('');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleToggleHoliday = async (dateStr, isHoliday) => {
    try {
      const token = localStorage.getItem('token');
      if (isHoliday) {
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
          await axios.delete(`${API_BASE_URL}/holidays/${holiday.id}`, { headers: { Authorization: `Bearer ${token}` } });
        }
      } else {
        const name = prompt('Enter holiday name:');
        if (!name) return;
        await axios.post(`${API_BASE_URL}/holidays`, { date: dateStr, name }, { headers: { Authorization: `Bearer ${token}` } });
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

  /* ---------- My leave form handlers ---------- */

  const handleMyLeaveFormChange = (field, value) => {
    if (field === 'startDate' || field === 'endDate') {
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
    if (!user?.id) return;
    setError('');
    setSuccess('');
    if (!myLeaveForm.startDate || !myLeaveForm.endDate || !myLeaveForm.reason) {
      setError('Please fill all leave fields.');
      return;
    }
    setMyLeaveSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('type', myLeaveForm.type);
      formData.append('start_date', myLeaveForm.startDate);
      formData.append('end_date', myLeaveForm.endDate);
      formData.append('reason', myLeaveForm.reason);
      if (myLeaveForm.document) formData.append('document', myLeaveForm.document);
      await axios.post(`${API_BASE_URL}/employee/${user.id}/leaves`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
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
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/employee/${user.id}/leaves/${leaveId}/cancel`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Cancelled successfully!');
      fetchMyLeaves();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel');
      setTimeout(() => setError(''), 3000);
    }
  };

  /* ---------- Settings / password ---------- */

  const handleSettingsChange = (field, value) => setSettingsForm(prev => ({ ...prev, [field]: value }));

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/employee/${user.id}/profile`, settingsForm, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Profile updated successfully!');
      fetchSettings();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      alert('Failed to update profile');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handlePasswordChange = (field, value) => setPasswordForm(prev => ({ ...prev, [field]: value }));

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("New passwords don't match");
      return;
    }
    setPasswordSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/employee/${user.id}/change-password`, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Password changed successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  /* ---------- Derived counts ---------- */
  const totalEmployees = users.filter(u => u.role === 'employee').length;
  const totalManagers = users.filter(u => u.role === 'manager').length;
  const totalHr = users.filter(u => u.role === 'hr').length;

  /* ---------- Render helpers inside component ---------- */

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

  const renderEmployeeList = () => {
    const filteredUsers = users.filter(u => {
      const term = employeeSearch.toLowerCase();
      return (
        (u.name && u.name.toLowerCase().includes(term)) ||
        (u.email && u.email.toLowerCase().includes(term)) ||
        (u.phone && u.phone.includes(term)) ||
        (u.role && u.role.toLowerCase().includes(term))
      );
    });

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Employee List</h2>
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
          />
        </div>

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
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{u.name || u.email}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2 capitalize">{u.role}</td>
                  <td className="px-4 py-2">{u.manager_name ? <span className="text-sm text-gray-700">{u.manager_name}</span> : <span className="text-sm text-gray-400 italic">No manager</span>}</td>
                  <td className="px-4 py-2">
                    {u.role === 'employee' ? (
                      <select
                        value={u.manager_id || ''}
                        onChange={e => handleAssignManager(u.id, e.target.value || null)}
                        disabled={assigningManager[u.id]}
                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">-- No Manager --</option>
                        {managers.map(m => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
                      </select>
                    ) : <span className="text-sm text-gray-400">-</span>}
                  </td>
                  <td className="px-4 py-2">{u.joined_on ? new Date(u.joined_on).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-2 text-right">
                    {u.role !== 'admin' && <button onClick={() => handleDeleteUser(u.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>}
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-center" colSpan={7}>No employees found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderLeaveApplications = () => {
    const calculateDays = (start, end) => {
      if (!start || !end) return 0;
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (endDate < startDate) return 0;
      const diffTime = Math.abs(endDate - startDate);
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    };

    const filteredLeaves = leaveApplications.filter(la => {
      const term = leaveFilter.search.toLowerCase();
      const matchSearch = (la.employee_name && la.employee_name.toLowerCase().includes(term)) ||
        (la.reason && la.reason.toLowerCase().includes(term));
      const matchType = leaveFilter.type === 'all' || la.type === leaveFilter.type;
      // Exclude HR and Admin leaves from this view (HR can only approve employees)
      const isManageable = la.role !== 'hr' && la.role !== 'admin';
      return matchSearch && matchType && isManageable;
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-2xl font-bold">Leave Applications</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search employee or reason..."
              value={leaveFilter.search}
              onChange={(e) => setLeaveFilter(prev => ({ ...prev, search: e.target.value }))}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
            <select
              value={leaveFilter.type}
              onChange={(e) => setLeaveFilter(prev => ({ ...prev, type: e.target.value }))}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Types</option>
              <option value="sick">Sick</option>
              <option value="casual">Casual</option>
              <option value="paid">Planned</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {filteredLeaves.length === 0 && <p className="text-gray-500">No leave applications found.</p>}

        {filteredLeaves.map(la => (
          <div key={la.id} className="border bg-white shadow p-4 rounded flex flex-col md:flex-row justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-lg">{la.employee_name}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full border ${la.type === 'sick' ? 'bg-orange-50 border-orange-200 text-orange-700' : la.type === 'casual' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>{la.type}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${la.status === 'approved' ? 'bg-green-100 text-green-800' : la.status === 'rejected' ? 'bg-red-100 text-red-800' : la.status === 'cancelled' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-800'}`}>{la.status}</span>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="font-medium">Period:</span> {la.start_date} to {la.end_date} <span className="font-bold ml-2">({la.days || calculateDays(la.start_date, la.end_date)} Days)</span></p>
                <p><span className="font-medium">Reason:</span> {la.reason || 'No reason provided'}</p>
                {la.document_url && (
                  <p>
                    <span className="font-medium">Document:</span>
                    <a href={`${API_BASE_URL.replace('/api', '')}/${la.document_url}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-600 hover:text-indigo-800 underline">View Attachment</a>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 min-w-[150px] justify-end">
              {la.status === 'pending' ? (
                <>
                  {la.role !== 'hr' && la.role !== 'admin' ? (
                    <>
                      <button onClick={() => handleApproveLeave(la.id)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium transition">Approve</button>
                      <button onClick={() => handleRejectLeave(la.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm font-medium transition">Reject</button>
                    </>
                  ) : (
                    <span className="text-xs text-amber-600 italic mt-1 font-medium bg-amber-50 px-2 py-1 rounded border border-amber-200">Requires Admin Approval</span>
                  )}
                </>
              ) : <span className="text-xs text-gray-400 italic mt-1">Processed</span>}
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
    const deptData = analytics?.departmentDistribution || [];
    const leaveDeptData = analytics?.departmentLeaveDistribution || [];
    const leaveStatusData = [
      { name: 'Approved', value: analytics?.summary?.approvedLeaves || 0 },
      { name: 'Pending', value: analytics?.summary?.pendingLeaves || 0 },
      { name: 'Rejected', value: analytics?.summary?.rejectedLeaves || 0 },
    ];
    const PIE_COLORS = ['#22c55e', '#eab308', '#ef4444'];

    if (!analytics) return <div className="text-gray-600">Loading analytics...</div>;

    return (
      <div className="space-y-8 pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">HR Analytics</h2>
            <p className="text-sm text-gray-500">
              Showing data from <span className="font-semibold">{analyticsFilters.startDate}</span> to <span className="font-semibold">{analyticsFilters.endDate}</span>
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 items-end">
            <div className="flex gap-2 items-center">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={analyticsFilters.startDate}
                  onChange={(e) => setAnalyticsFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="border rounded px-2 py-1 text-sm bg-gray-50"
                  max={analyticsFilters.endDate}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                <input
                  type="date"
                  value={analyticsFilters.endDate}
                  onChange={(e) => setAnalyticsFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="border rounded px-2 py-1 text-sm bg-gray-50"
                  min={analyticsFilters.startDate}
                />
              </div>
              <button
                onClick={() => fetchAnalytics()}
                className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700 h-[30px] self-end mb-[1px]"
              >
                Apply
              </button>
            </div>

            <div className="flex gap-2">
              <button onClick={() => handleDownloadReport('employees')} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50">
                Staffing CSV
              </button>
              <button onClick={() => handleDownloadReport('leaves')} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50">
                Leaves CSV
              </button>
              <button onClick={() => handleDownloadReport('attendance')} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50">
                Attendance CSV
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card label="Total Employees" value={analytics.summary?.totalEmployees} color="indigo" />
          <Card label="Managers" value={analytics.summary?.totalManagers} color="emerald" />
          <Card label="HR Staff" value={analytics.summary?.totalHr} color="blue" />
          <Card label="Pending Leaves" value={analytics.summary?.pendingLeaves} color="yellow" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow flex flex-col">
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Avg Work Hours by Department (30 Days)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workHoursStats?.departmentHours || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="department" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avg_hours" name="Avg Hours" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow flex flex-col">
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Daily Work Hours Trend (7 Days)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={workHoursStats?.dailyTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="avg_hours" name="Avg Hours" stroke="#82ca9d" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow flex flex-col">
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Staffing: Employees by Department</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="department" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Employees" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow flex flex-col">
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Leave Distribution (Status)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={leaveStatusData} dataKey="value" nameKey="name" outerRadius={80} label>
                    {leaveStatusData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow flex flex-col">
          <h3 className="text-lg font-semibold mb-2 text-gray-900">Leaves by Department</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leaveDeptData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="leaveCount" name="Leaves" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  const renderApplyLeave = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Apply for Leave (HR)</h2>

      {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 text-green-700 px-4 py-2 rounded mb-4">{success}</div>}

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

  const renderCalendar = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
        <h2 className="text-2xl font-bold text-gray-800">My Attendance & Holidays</h2>
        <div className="flex gap-2">
          {!attendanceMarked ? <button onClick={handleMarkAttendance} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold">Check In</button> : <span className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-bold">✓ Checked In</span>}
          {attendanceMarked && !checkoutMarked && <button onClick={handleCheckout} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-bold">Check Out</button>}
          {checkoutMarked && <span className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-bold">✓ Checked Out</span>}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <p className="mb-4 text-sm text-gray-600">Click on a date to manage holidays (HR Privilege).</p>
        <CalendarView attendance={attendanceRecords} holidays={holidays} role="hr" onDateClick={handleToggleHoliday} />
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-8 max-w-4xl mx-auto pb-10">
      <h2 className="text-2xl font-bold text-gray-900">Profile Settings</h2>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Personal Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: 'Full Name', value: settingsForm.name },
            { label: 'Email', value: settingsForm.email },
            { label: 'Role', value: settingsForm.role },
            { label: 'Department', value: settingsForm.department },
            { label: 'Date of Joining', value: settingsForm.joined_on },
            { label: 'Date of Birth', value: settingsForm.dob },
            { label: 'Gender', value: settingsForm.gender },
            { label: 'Blood Group', value: settingsForm.blood_group },
          ].map(field => (
            <div key={field.label}>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">{field.label}</label>
              <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700 font-medium">{field.value || '-'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Contact & Preferences</h3>
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
              <input type="text" value={settingsForm.phone} onChange={e => handleSettingsChange('phone', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" placeholder="Enter phone number" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Emergency Contact</label>
              <input type="text" value={settingsForm.emergency_contact} onChange={e => handleSettingsChange('emergency_contact', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" placeholder="Emergency contact info" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
            <textarea rows="2" value={settingsForm.address} onChange={e => handleSettingsChange('address', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" placeholder="Your residential address" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Display Name</label>
              <input type="text" value={settingsForm.display_name} onChange={e => handleSettingsChange('display_name', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" placeholder="Preferred display name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Bio</label>
              <textarea rows="1" value={settingsForm.bio} onChange={e => handleSettingsChange('bio', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" placeholder="Brief bio" />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={settingsSaving} className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow-md hover:bg-indigo-700 text-sm font-bold uppercase tracking-wider transition-transform transform hover:-translate-y-1">
              {settingsSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Security</h3>
        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Current Password</label>
            <input type="password" value={passwordForm.currentPassword} onChange={e => handlePasswordChange('currentPassword', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Enter current password" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" value={passwordForm.newPassword} onChange={e => handlePasswordChange('newPassword', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Enter new password" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input type="password" value={passwordForm.confirmPassword} onChange={e => handlePasswordChange('confirmPassword', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Confirm new password" />
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={passwordSaving} className="bg-gray-800 text-white px-6 py-2 rounded-lg shadow-md hover:bg-gray-900 text-sm font-bold uppercase tracking-wider transition-transform transform hover:-translate-y-1">
              {passwordSaving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  /* ---------- Main render ---------- */

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="h-16 flex items-center justify-center border-b border-gray-700 text-lg font-semibold">HRMS HR Panel</div>
        <nav className="flex-1 p-4 space-y-1">
          {Object.values(TABS).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full text-left px-4 py-2 rounded ${activeTab === tab ? 'bg-slate-800' : 'hover:bg-slate-700'}`}>
              {tab.replace(/([A-Z])/g, ' $1').trim()}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 w-full py-2 rounded text-sm text-white">Logout</button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-y-auto">
        {activeTab === TABS.DASHBOARD && renderDashboard()}
        {activeTab === TABS.EMPLOYEES && renderEmployeeList()}
        {activeTab === TABS.LEAVE_APPLICATIONS && renderLeaveApplications()}
        {activeTab === TABS.APPLY_LEAVE && renderApplyLeave()}
        {activeTab === TABS.CALENDAR && renderCalendar()}
        {activeTab === TABS.ANALYTICS && renderAnalytics()}
        {activeTab === TABS.SETTINGS && renderSettings()}
      </main>
    </div>
  );
}

export default HrDashboard;
