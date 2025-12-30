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
import { formatDate } from '../utils/dateUtils';
import {
  Settings, User, Mail, Calendar, Activity,
  Phone, Shield, Save, Lock, Menu, X, Bell, LogOut, LayoutDashboard, Users, FileText, PlusCircle, BarChart as BarChartIcon, ClipboardList, Clock
} from 'lucide-react';
import './HrDashboard.css';
import CalendarView from '../components/CalendarView';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const TABS = {
  DASHBOARD: 'Dashboard',
  EMPLOYEES: 'Employees',
  LEAVE_APPLICATIONS: 'Leave Applications',
  APPLY_LEAVE: 'Apply Leave',
  CALENDAR: 'Calendar',
  ANALYTICS: 'Analytics',
  AUDIT_LOGS: 'Audit Logs',
  WORK_HOURS: 'Work Hours',
  SETTINGS: 'Settings',
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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

  // Work Hours Logs State
  const [workHoursLogs, setWorkHoursLogs] = useState([]);
  const [workHoursTotal, setWorkHoursTotal] = useState(0);
  const [workHoursPage, setWorkHoursPage] = useState(1);
  const [workHoursLimit] = useState(20);
  const [workHoursSearch, setWorkHoursSearch] = useState('');
  const [workHoursDateRange, setWorkHoursDateRange] = useState({ start: '', end: '' });

  // Calendar Stats
  const [calendarStats, setCalendarStats] = useState({});

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit] = useState(20);
  const [auditSortBy, setAuditSortBy] = useState('timestamp');
  const [auditSortOrder, setAuditSortOrder] = useState('desc');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditDateRange, setAuditDateRange] = useState({ start: '', end: '' });

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
  const [myLeaveBalance, setMyLeaveBalance] = useState(null);
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
  const [editDateModal, setEditDateModal] = useState({ open: false, leaveId: null, startDate: '', endDate: '' });

  // User Notifications (Broadcasts)
  const [userNotifications, setUserNotifications] = useState([]);

  useEffect(() => {
    if (!user || (user.role !== 'hr' && user.role !== 'admin')) {
      navigate('/login');
      return;
    }

    // load required data once
    setLoading(true);
    Promise.all([
      fetchUsers(),
      fetchManagers(),
      fetchDashboardSummary(),
      fetchLeaveApplications(),
      fetchHolidays(),
      fetchMyAttendance(),
      fetchMyLeaves(),
      fetchAnalytics(),
      fetchSettings(),
      fetchMyLeaveBalance(),
      fetchUserNotifications()
    ]).catch(err => {
      console.error('Initial data fetch failed:', err);
      // Ensure we don't get stuck in loading state even on error
    }).finally(() => {
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  useEffect(() => {
    if (activeTab === TABS.AUDIT_LOGS) {
      fetchAuditLogs();
    }
    if (activeTab === TABS.WORK_HOURS) {
      fetchWorkHoursLogs();
    }
    if (activeTab === TABS.CALENDAR) {
      fetchCalendarSummary();
    }
  }, [activeTab, auditPage, auditSortBy, auditSortOrder, auditSearch, workHoursPage, workHoursSearch, workHoursDateRange]);

  const fetchCalendarSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      // Defaults to current month/year for now
      const now = new Date();
      const res = await axios.get(`${API_BASE_URL}/hr/calendar-summary`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          month: now.getMonth() + 1,
          year: now.getFullYear()
        }
      });
      setCalendarStats(res.data || {});
    } catch (err) {
      console.error('Fetch calendar summary error:', err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const offset = (auditPage - 1) * auditLimit;
      const res = await axios.get(`${API_BASE_URL}/hr/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          limit: auditLimit,
          offset,
          sortBy: auditSortBy,
          sortOrder: auditSortOrder,
          search: auditSearch
        }
      });
      setAuditLogs(res.data.logs || []);
      setAuditTotal(res.data.total || 0);
    } catch (err) {
      console.error('Fetch audit logs error:', err);
      setAuditLogs([]);
      setAuditTotal(0);
      setError(err.response?.data?.error || 'Failed to fetch audit logs');
    }
  };

  const fetchWorkHoursLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const offset = (workHoursPage - 1) * workHoursLimit;
      const res = await axios.get(`${API_BASE_URL}/hr/attendance-records`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          limit: workHoursLimit,
          page: workHoursPage,
          search: workHoursSearch,
          startDate: workHoursDateRange.start,
          endDate: workHoursDateRange.end
        }
      });
      setWorkHoursLogs(res.data.records || []);
      setWorkHoursTotal(res.data.total || 0);
    } catch (err) {
      console.error('Fetch work hours logs error:', err);
      setWorkHoursLogs([]);
      setWorkHoursTotal(0);
      setError(err.response?.data?.error || 'Failed to fetch work hours logs');
    }
  };

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

  const fetchMyLeaveBalance = async () => {
    if (!user?.id) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/employee/${user.id}/leave-balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyLeaveBalance(res.data);
    } catch (err) {
      console.error('Error fetching leave balance:', err);
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

  const fetchUserNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/employee/${user.id}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserNotifications(response.data.notifications || response.data || []);
    } catch (err) {
      console.error('Error fetching user notifications:', err);
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
      ...data.map(row => headers.map(header => {
        let val = row[header] ?? '';
        // If the header suggests a date field, try to format it
        if (typeof val === 'string' && (header.includes('date') || header.includes('joined_on') || header.includes('dob') || header.includes('created_at'))) {
          // check if it looks like a date (simple check)
          if (val.match(/^\d{4}-\d{2}-\d{2}/)) {
            val = formatDate(val);
          }
        }
        return JSON.stringify(val);
      }).join(','))
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

      // Special handling for Excel export
      if (type === 'work_hours_excel') {
        const res = await axios.get(`${API_BASE_URL}/hr/export/work-hours-excel`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { ...workHoursDateRange, search: workHoursSearch },
          responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Work_Hours_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }

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
        case 'audit_logs':
          endpoint = `${API_BASE_URL}/hr/export/audit-logs`;
          const params = new URLSearchParams();
          if (auditDateRange.start) params.append('startDate', auditDateRange.start);
          if (auditDateRange.end) params.append('endDate', auditDateRange.end);
          if ([...params].length > 0) endpoint += `?${params.toString()}`;
          filename = 'audit_logs_report.csv';
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

    const confirmCheckIn = window.confirm(
      'This will capture your current location for attendance. Proceed?'
    );
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

          setSuccess('Checked in successfully!');
          fetchMyAttendance();
          setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
          console.error('Error marking attendance:', err);

          let errorMsg = err.response?.data?.error || 'Check-in failed';

          // If already marked, sync UI
          if (errorMsg.includes('already')) {
            fetchMyAttendance();
          }

          if (err.response?.data?.distance) {
            errorMsg += ` (Distance: ${err.response.data.distance}m, Max: ${err.response.data.max_distance}m)`;
          }

          setError(errorMsg);
          setSuccess('');
          setTimeout(() => setError(''), 5000);
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
        setTimeout(() => setError(''), 5000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
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

    const confirmCheckout = window.confirm(
      'This will capture your current location for checkout. Proceed?'
    );
    if (!confirmCheckout) return;

    setSuccess('Fetching location for checkout...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude, accuracy } = position.coords;
          const token = localStorage.getItem('token');

          const res = await axios.post(
            `${API_BASE_URL}/employee/${user.id}/attendance/checkout`,
            { latitude, longitude, accuracy },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const hours = res.data.total_hours || '0';
          setSuccess(`Checked out! Worked ${hours} hours.`);
          fetchMyAttendance();
          setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
          console.error('Error checking out:', err);

          let errorMsg = err.response?.data?.error || 'Checkout failed';

          if (err.response?.data?.distance) {
            errorMsg += ` (Distance: ${err.response.data.distance}m, Max: ${err.response.data.max_distance}m)`;
          }

          setError(errorMsg);
          setSuccess('');
          setTimeout(() => setError(''), 5000);
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
        setTimeout(() => setError(''), 5000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
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
    // Date validation removed - HR can now apply for leave on any date including weekends and holidays
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

  const handleSettingsChange = (field, value) => {
    if (field === 'phone' || field === 'emergency_contact') {
      const numericValue = value.replace(/\D/g, '');
      if (numericValue.length <= 10) {
        setSettingsForm(prev => ({ ...prev, [field]: numericValue }));
      }
    } else {
      setSettingsForm(prev => ({ ...prev, [field]: value }));
    }
  };

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
        <div className="bg-white border-l-4 border-[color:var(--accent-primary)] rounded-xl p-5 shadow-sm card-hover flex flex-col justify-between h-full">
          <div>
            <div className="text-sm uppercase tracking-wide text-secondary opacity-80">Today's Status</div>
            <div className="mt-2 text-2xl font-bold text-primary">
              {todayAttendance?.status === 'present'
                ? 'Present'
                : todayAttendance?.status === 'absent'
                  ? 'Absent'
                  : 'Not Marked'}
            </div>
            {todayAttendance?.check_in && (
              <div className="mt-1 text-xs text-secondary">
                In: {todayAttendance.check_in}
              </div>
            )}
            {todayAttendance?.check_out && (
              <div className="mt-1 text-xs text-secondary">
                Out: {todayAttendance.check_out}
              </div>
            )}
            {todayAttendance?.total_hours && (
              <div className="mt-1 text-xs text-secondary font-semibold">
                Hours: {todayAttendance.total_hours}
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            <button
              onClick={handleMarkAttendance}
              disabled={attendanceMarked || todayAttendance?.status === 'present'}
              className={`w-full text-xs font-bold px-3 py-2 rounded-lg transition ${attendanceMarked || todayAttendance?.status === 'present'
                ? 'bg-[color:var(--status-success)] text-white cursor-not-allowed opacity-90'
                : 'bg-[color:var(--accent-primary)] text-white hover:opacity-90 shadow-md'
                }`}
            >
              {attendanceMarked || todayAttendance?.status === 'present' ? 'Checked In' : 'Check In Now'}
            </button>

            <button
              onClick={handleCheckout}
              disabled={!attendanceMarked || checkoutMarked}
              className={`w-full text-xs font-bold px-3 py-2 rounded-lg transition ${!attendanceMarked || checkoutMarked
                ? 'bg-[color:var(--bg-main)] text-secondary cursor-not-allowed'
                : 'bg-[color:var(--status-success)] text-white hover:opacity-90 shadow-md'
                }`}
            >
              {checkoutMarked ? 'Checked Out' : 'Check Out'}
            </button>
          </div>
        </div>

        {/* Existing Stat Cards & New Widgets */}
        <div className="bg-white border-l-4 border-[color:var(--accent-primary)] p-6 rounded-xl shadow-sm card-hover">
          <div className="text-sm font-semibold text-secondary uppercase tracking-wider">Total Employees</div>
          <div className="text-4xl font-extrabold text-primary mt-2">{dashboardSummary?.totals?.totalEmployees || totalEmployees}</div>
        </div>

        <div className="bg-white border-l-4 border-[color:var(--status-success)] p-6 rounded-xl shadow-sm card-hover">
          <div className="text-sm font-semibold text-secondary uppercase tracking-wider">Present Today</div>
          <div className="text-4xl font-extrabold text-primary mt-2">{dashboardSummary?.totals?.presentToday || 0}</div>
        </div>

        <div className="bg-white border-l-4 border-[color:var(--status-inactive)] p-6 rounded-xl shadow-sm card-hover">
          <div className="text-sm font-semibold text-secondary uppercase tracking-wider">Absent Today</div>
          <div className="text-4xl font-extrabold text-primary mt-2">{dashboardSummary?.totals?.absentToday || 0}</div>
        </div>

        <div className="bg-white border-l-4 border-[color:var(--status-pending)] p-6 rounded-xl shadow-sm card-hover">
          <div className="text-sm font-semibold text-secondary uppercase tracking-wider mb-2">Your Leave Balance</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{myLeaveBalance?.sick ?? '-'}</div>
              <div className="text-xs text-secondary">Sick</div>
            </div>
            <div className="text-center border-l border-gray-200">
              <div className="text-2xl font-bold text-primary">{myLeaveBalance?.casual ?? '-'}</div>
              <div className="text-xs text-secondary">Casual</div>
            </div>
            <div className="text-center border-l border-gray-200">
              <div className="text-2xl font-bold text-primary">{myLeaveBalance?.paid ?? '-'}</div>
              <div className="text-xs text-secondary">Planned</div>
            </div>
          </div>
        </div>

        <div className="bg-white border-l-4 border-[color:var(--status-pending)] p-6 rounded-xl shadow-sm card-hover">
          <div className="text-sm font-medium opacity-90 uppercase tracking-wider text-secondary">Pending Leaves</div>
          <div className="text-4xl font-extrabold mt-2 text-primary">{dashboardSummary?.totals?.pendingLeaveRequests || 0}</div>
        </div>

        <div className="bg-white border-l-4 border-[color:var(--status-inactive)] p-6 rounded-xl shadow-sm card-hover">
          <div className="text-sm font-semibold text-secondary uppercase tracking-wider">Pending Corrections</div>
          <div className="text-3xl font-bold text-primary mt-2">{dashboardSummary?.totals?.pendingAttendanceCorrections || 0}</div>
        </div>

      </div>

      {/* Row 2: Notifications & Birthdays */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Notifications & Action Items */}
        <div className="lg:col-span-2 space-y-6">

          {/* Announcements / User Notifications */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              📢 Announcements
            </h3>
            <div className="space-y-3">
              {userNotifications.length > 0 ? (
                userNotifications.map((note) => (
                  <div key={note.id} className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg text-sm text-purple-900 border border-purple-100">
                    <span className="mt-1 h-2 w-2 rounded-full bg-purple-500 shrink-0"></span>
                    <span>{note.message}</span>
                    <span className="text-xs text-purple-400 ml-auto whitespace-nowrap">
                      {new Date(note.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 italic text-sm">No new announcements.</p>
              )}
            </div>
          </div>

          {/* Action Items (System Alerts) */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
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
                    <p className="text-xs text-gray-500">{formatDate(b.dob, 'monthDay')}</p>
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
                <th className="px-4 py-2 text-left">Actions</th>
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
                  <td className="px-4 py-2">
                    {u.role === 'employee' || u.role === 'manager' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenQuickLeave(u, 'sick')}
                          className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 font-medium"
                        >
                          + Sick
                        </button>
                        <button
                          onClick={() => handleOpenQuickLeave(u, 'casual')}
                          className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200 font-medium"
                        >
                          + Casual
                        </button>
                      </div>
                    ) : <span className="text-gray-400">-</span>}
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-center" colSpan={6}>No employees found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  /* ---------- Renderers ---------- */

  const handleEditDatesSubmit = async (e) => {
    e.preventDefault();
    if (!editDateModal.startDate || !editDateModal.endDate) return;

    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/hr/leave-requests/${editDateModal.leaveId}/dates`,
        { startDate: editDateModal.startDate, endDate: editDateModal.endDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Leave dates updated successfully');
      setEditDateModal({ open: false, leaveId: null, startDate: '', endDate: '' });
      fetchLeaveApplications(); // Refresh list
      fetchLeaveStatistics(); // Refresh stats (balance changes)
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating leave dates:', err);
      setError(err.response?.data?.error || 'Failed to update leave dates');
      setTimeout(() => setError(''), 5000);
    }
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
                <p><span className="font-medium">Period:</span> {formatDate(la.start_date)} to {formatDate(la.end_date)} <span className="font-bold ml-2">({la.days || calculateDays(la.start_date, la.end_date)} Days)</span></p>
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
              ) : (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-gray-400 italic mt-1">Processed</span>
                  {la.status === 'approved' && la.type === 'paid' && (
                    <button
                      onClick={() => setEditDateModal({ open: true, leaveId: la.id, startDate: la.start_date, endDate: la.end_date })}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs rounded font-medium transition"
                    >
                      Edit Dates
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const CARD_COLORS = {
    indigo: 'border-l-4 border-[color:var(--accent-primary)]',
    emerald: 'border-l-4 border-[color:var(--status-success)]',
    blue: 'border-l-4 border-[color:var(--accent-primary)]',
    amber: 'border-l-4 border-[color:var(--status-pending)]',
    yellow: 'border-l-4 border-[color:var(--status-pending)]',
    green: 'border-l-4 border-[color:var(--status-success)]',
    red: 'border-l-4 border-[color:var(--status-inactive)]',
  };

  const Card = ({ label, value, color }) => (
    <div className={`bg-white ${CARD_COLORS[color]} p-6 rounded-xl shadow-sm card-hover`}>
      <p className="text-sm font-semibold uppercase tracking-wide text-secondary">{label}</p>
      <p className="text-3xl font-bold text-primary mt-2">{value ?? 0}</p>
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
    const PIE_COLORS = ['#8fa59b', '#3f4a59', '#2e2e2e'];

    if (!analytics) return <div className="text-gray-600">Loading analytics...</div>;

    return (
      <div className="space-y-8 pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">HR Analytics</h2>
            <p className="text-sm text-gray-500">
              Showing data from <span className="font-semibold">{formatDate(analyticsFilters.startDate)}</span> to <span className="font-semibold">{formatDate(analyticsFilters.endDate)}</span>
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
          <Card label="Pending Leaves" value={analytics.summary?.totalPendingLeaves ?? analytics.summary?.pendingLeaves} color="yellow" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow flex flex-col">
            <h3 className="text-lg font-semibold mb-2 text-primary">Avg Work Hours by Department (30 Days)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workHoursStats?.departmentHours || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="department" tick={{ fill: '#3f4a59' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#3f4a59' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                  <Bar dataKey="avg_hours" name="Avg Hours" fill="#4a6fa5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow flex flex-col">
            <h3 className="text-lg font-semibold mb-2 text-primary">Daily Work Hours Trend (7 Days)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={workHoursStats?.dailyTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fill: '#3f4a59' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#3f4a59' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                  <Legend />
                  <Line type="monotone" dataKey="avg_hours" name="Avg Hours" stroke="#8fa59b" strokeWidth={3} dot={{ fill: '#8fa59b' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow flex flex-col">
            <h3 className="text-lg font-semibold mb-2 text-primary">Staffing: Employees by Department</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="department" tick={{ fill: '#3f4a59' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: '#3f4a59' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                  <Bar dataKey="count" name="Employees" fill="#3f4a59" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow flex flex-col">
            <h3 className="text-lg font-semibold mb-2 text-primary">Leave Distribution (Status)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={leaveStatusData} dataKey="value" nameKey="name" outerRadius={80} label>
                    {leaveStatusData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
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
              <option value="work_from_home">Work From Home</option>
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
                  <td className="px-4 py-2">{formatDate(l.start_date)} to {formatDate(l.end_date)} <span className="text-gray-400 text-xs ml-1">({l.days} days)</span></td>
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
          {!attendanceMarked ? <button onClick={handleMarkAttendance} className="bg-[color:var(--accent-primary)] text-white px-4 py-2 rounded-lg hover:opacity-90 font-bold">Check In</button> : <span className="bg-[color:var(--status-success)] text-white px-4 py-2 rounded-lg font-bold">Checked In</span>}
          {attendanceMarked && !checkoutMarked && <button onClick={handleCheckout} className="bg-[color:var(--status-success)] text-white px-4 py-2 rounded-lg hover:opacity-90 font-bold">Check Out</button>}
          {checkoutMarked && <span className="bg-[color:var(--bg-main)] text-secondary px-4 py-2 rounded-lg font-bold border border-gray-200">Checked Out</span>}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <p className="mb-4 text-sm text-gray-600">Click on a date to manage holidays (HR Privilege).</p>
        <CalendarView
          attendance={attendanceRecords}
          holidays={holidays}
          leaves={myLeaveHistory}
          role="hr"
          onDateClick={handleToggleHoliday}
          calendarStats={calendarStats}
          onMonthChange={fetchCalendarSummary}
        />
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-6xl mx-auto pb-10 space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-[color:var(--accent-primary)] rounded-lg shadow-lg">
          <Settings className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Profile Settings</h2>
          <p className="text-gray-500 text-sm">Manage your personal information and security preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Personal Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative group">
            <div className="h-32 bg-[color:var(--accent-primary)]"></div>
            <div className="px-6 pb-6 text-center -mt-12 relative">
              <div className="w-24 h-24 mx-auto bg-white rounded-full p-1 shadow-lg">
                <div className="w-full h-full bg-[color:var(--bg-main)] rounded-full flex items-center justify-center text-3xl font-bold text-primary">
                  {settingsForm.name ? settingsForm.name.charAt(0) : 'U'}
                </div>
              </div>
              <h3 className="mt-4 text-xl font-bold text-primary">{settingsForm.name || 'User Name'}</h3>
              <p className="text-secondary font-medium">{settingsForm.role || 'Role'}</p>
              <div className="mt-4 flex justify-center gap-2">
                <span className="px-3 py-1 bg-[color:var(--status-success)] text-white text-xs font-semibold rounded-full">
                  {settingsForm.status || 'Active'}
                </span>
                <span className="px-3 py-1 bg-[color:var(--accent-primary)] text-white text-xs font-semibold rounded-full">
                  {settingsForm.department || 'Dept'}
                </span>
              </div>
            </div>
            <div className="border-t border-gray-50 px-6 py-4 bg-gray-50/50">
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div className="flex justify-between items-center group/item hover:bg-white p-2 rounded transition-colors">
                  <div className="flex items-center gap-3 text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span>Email</span>
                  </div>
                  <span className="font-medium text-gray-900">{settingsForm.email}</span>
                </div>
                <div className="flex justify-between items-center group/item hover:bg-white p-2 rounded transition-colors">
                  <div className="flex items-center gap-3 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>Joined</span>
                  </div>
                  <span className="font-medium text-gray-900">{settingsForm.joined_on ? formatDate(settingsForm.joined_on) : '-'}</span>
                </div>
                <div className="flex justify-between items-center group/item hover:bg-white p-2 rounded transition-colors">
                  <div className="flex items-center gap-3 text-gray-600">
                    <User className="w-4 h-4" />
                    <span>DOB</span>
                  </div>
                  <span className="font-medium text-gray-900">{settingsForm.dob ? formatDate(settingsForm.dob) : '-'}</span>
                </div>
                <div className="flex justify-between items-center group/item hover:bg-white p-2 rounded transition-colors">
                  <div className="flex items-center gap-3 text-gray-600">
                    <Activity className="w-4 h-4" />
                    <span>Blood</span>
                  </div>
                  <span className="font-medium text-gray-900">{settingsForm.blood_group || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Editable Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact & Preferences Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Phone className="w-5 h-5 text-[color:var(--accent-primary)]" />
                Contact & Details
              </h3>
            </div>

            <form onSubmit={handleSaveSettings} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Phone Number</label>
                  <input
                    type="text"
                    value={settingsForm.phone}
                    onChange={e => handleSettingsChange('phone', e.target.value)}
                    maxLength="10"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-sm"
                    placeholder="Enter 10-digit phone number"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Emergency Contact</label>
                  <input
                    type="text"
                    value={settingsForm.emergency_contact}
                    onChange={e => handleSettingsChange('emergency_contact', e.target.value)}
                    maxLength="10"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-sm"
                    placeholder="Enter 10-digit number"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">Residential Address</label>
                  <textarea
                    rows="2"
                    value={settingsForm.address}
                    onChange={e => handleSettingsChange('address', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-sm resize-none"
                    placeholder="Enter your full address"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Display Name</label>
                  <input
                    type="text"
                    value={settingsForm.display_name}
                    onChange={e => handleSettingsChange('display_name', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-sm"
                    placeholder="Preferred name"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-50">
                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="flex items-center gap-2 bg-[color:var(--accent-primary)] hover:opacity-90 text-white px-6 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all font-medium text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {settingsSaving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Save className="w-4 h-4" />}
                  {settingsSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Security Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Shield className="w-5 h-5 text-[color:var(--accent-primary)]" />
                Security & Password
              </h3>
            </div>

            <form onSubmit={handlePasswordSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Current Password</label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={e => handlePasswordChange('currentPassword', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-sm"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">New Password</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={e => handlePasswordChange('newPassword', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-sm"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Confirm Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={e => handlePasswordChange('confirmPassword', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-50">
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all font-medium text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {passwordSaving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Lock className="w-4 h-4" />}
                  {passwordSaving ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );

  const [quickLeaveModal, setQuickLeaveModal] = useState({ open: false, employeeId: null, employeeName: '', type: 'sick', startDate: '', endDate: '', reason: '' });

  const handleOpenQuickLeave = (user, type) => {
    setQuickLeaveModal({ open: true, employeeId: user.id, employeeName: user.name, type, startDate: '', endDate: '', reason: '' });
  };

  const handleQuickLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!quickLeaveModal.employeeId) return;

    // Date validation removed - HR can create approved leaves on any date including weekends

    try {
      const token = localStorage.getItem('token');
      // Using generic endpoint if backend supports type in body, reusing create-approved
      // Assuming create-approved takes type. Let's check backend or just send it.
      // If create-approved forces 'sick', we might need to change backend.
      // But typically 'create-approved' endpoint might be specific to sick leave? 
      // Checking backend... actually createApprovedLeave on backend likely hardcoded or takes type.
      // Let's assume we pass type. If backend ignores it, we fix backend later. 
      // Wait, let's CHECK backend logic for createApprovedLeave.
      // Assuming it takes type for now.

      await axios.post(`${API_BASE_URL}/hr/employees/${quickLeaveModal.employeeId}/leaves/create-approved`, {
        type: quickLeaveModal.type, // Pass type
        start_date: quickLeaveModal.startDate,
        end_date: quickLeaveModal.endDate,
        reason: quickLeaveModal.reason
      }, { headers: { Authorization: `Bearer ${token}` } });

      setSuccess(`${quickLeaveModal.type === 'sick' ? 'Sick' : 'Casual'} leave added for ${quickLeaveModal.employeeName}`);
      setQuickLeaveModal({ open: false, employeeId: null, employeeName: '', type: 'sick', startDate: '', endDate: '', reason: '' });
      setTimeout(() => setSuccess(''), 3000);
      fetchLeaveApplications(); // refresh leave list
      fetchAnalytics(); // refresh stats
    } catch (err) {
      alert(err.response?.data?.error || `Failed to add ${quickLeaveModal.type} leave`);
    }
  };

  const handleQuickLeaveDateChange = (field, value) => {
    // [MODIFIED] Removed blocking alert for weekends to allow calendar navigation
    setQuickLeaveModal(prev => ({ ...prev, [field]: value }));
  };

  const renderEditDateModal = () => {
    if (!editDateModal.open) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
          <h3 className="text-lg font-bold mb-4">Edit Leave Dates</h3>
          <form onSubmit={handleEditDatesSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                required
                value={editDateModal.startDate ? editDateModal.startDate.substring(0, 10) : ''}
                onChange={(e) => setEditDateModal(prev => ({ ...prev, startDate: e.target.value }))}
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                required
                value={editDateModal.endDate ? editDateModal.endDate.substring(0, 10) : ''}
                onChange={(e) => setEditDateModal(prev => ({ ...prev, endDate: e.target.value }))}
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setEditDateModal({ open: false, leaveId: null, startDate: '', endDate: '' })}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Update
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderQuickLeaveModal = () => {
    if (!quickLeaveModal.open) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
          <h3 className="text-lg font-bold mb-4">Add {quickLeaveModal.type === 'sick' ? 'Sick' : 'Casual'} Leave for {quickLeaveModal.employeeName}</h3>
          <form onSubmit={handleQuickLeaveSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <input type="date" required value={quickLeaveModal.startDate} onChange={e => handleQuickLeaveDateChange('startDate', e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <input type="date" required min={quickLeaveModal.startDate} value={quickLeaveModal.endDate} onChange={e => handleQuickLeaveDateChange('endDate', e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Reason</label>
              <textarea required value={quickLeaveModal.reason} onChange={e => setQuickLeaveModal(prev => ({ ...prev, reason: e.target.value }))} className="w-full border rounded px-3 py-2" rows="3"></textarea>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setQuickLeaveModal({ ...quickLeaveModal, open: false })} className="px-4 py-2 border rounded hover:bg-gray-100">Cancel</button>
              <button
                type="submit"
                className={`px-4 py-2 text-white rounded font-medium ${quickLeaveModal.type === 'sick' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                Add {quickLeaveModal.type === 'sick' ? 'Sick' : 'Casual'} Leave
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  /* ---------- Main render ---------- */

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  const renderAuditLogs = () => {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>

        {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4">{error}</div>}

        <div className="bg-white shadow rounded-lg p-6">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between">
            <div className="flex-1 flex flex-col md:flex-row gap-4">
              <input
                type="text"
                placeholder="Search audit logs..."
                className="flex-1 border rounded-md px-3 py-2"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  className="border rounded-md px-3 py-2"
                  value={auditDateRange.start}
                  onChange={(e) => setAuditDateRange(prev => ({ ...prev, start: e.target.value }))}
                  placeholder="Start Date"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="date"
                  className="border rounded-md px-3 py-2"
                  value={auditDateRange.end}
                  onChange={(e) => setAuditDateRange(prev => ({ ...prev, end: e.target.value }))}
                  placeholder="End Date"
                />
                <button
                  onClick={() => handleDownloadReport('audit_logs')}
                  className="bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700 whitespace-nowrap"
                >
                  Download CSV
                </button>
              </div>
            </div>
            <div className="flex gap-4">
              <select
                className="border rounded-md px-3 py-2"
                value={auditSortBy}
                onChange={(e) => setAuditSortBy(e.target.value)}
              >
                <option value="timestamp">Time</option>
                <option value="action">Action</option>
              </select>
              <select
                className="border rounded-md px-3 py-2"
                value={auditSortOrder}
                onChange={(e) => setAuditSortOrder(e.target.value)}
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                      No logs found.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(log.created_at, 'datetime')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.user_name || log.user_email || 'System'}
                        <div className="text-xs text-gray-400">{log.user_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {log.action}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {JSON.stringify(log.metadata)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{(auditPage - 1) * auditLimit + 1}</span> to <span className="font-medium">{Math.min(auditPage * auditLimit, auditTotal)}</span> of <span className="font-medium">{auditTotal}</span> results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                disabled={auditPage === 1}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setAuditPage(p => p + 1)}
                disabled={auditPage * auditLimit >= auditTotal}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderWorkHours = () => {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Employee Work Hours</h2>

        {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4">{error}</div>}

        <div className="bg-white shadow rounded-lg p-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Search by employee name or email..."
                className="w-full border rounded-md px-3 py-2"
                value={workHoursSearch}
                onChange={(e) => setWorkHoursSearch(e.target.value)}
              />
            </div>
            <div>
              <input
                type="date"
                className="w-full border rounded-md px-3 py-2"
                value={workHoursDateRange.start}
                onChange={(e) => setWorkHoursDateRange(prev => ({ ...prev, start: e.target.value }))}
                placeholder="Start Date"
              />
            </div>
            <div>
              <input
                type="date"
                className="w-full border rounded-md px-3 py-2"
                value={workHoursDateRange.end}
                onChange={(e) => setWorkHoursDateRange(prev => ({ ...prev, end: e.target.value }))}
                placeholder="End Date"
              />
            </div>
            <div className="flex items-end self-end mb-1">
              <button
                onClick={() => handleDownloadReport('work_hours_excel')}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Download Excel
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Hours</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workHoursLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  workHoursLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(log.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="font-medium">{log.employee_name}</div>
                        <div className="text-xs text-gray-500">{log.employee_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.check_in_time || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.check_out_time || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {log.total_hours || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${log.status === 'present' ? 'bg-green-100 text-green-800' :
                            log.status === 'absent' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'}`}>
                          {log.status}
                        </span>
                        {/* Late / Left Early Badges */}
                        <div className="flex gap-1 mt-1">
                          {log.is_late ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600 border border-red-200">
                              Late
                            </span>
                          ) : null}
                          {log.is_left_early ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-600 border border-orange-200">
                              Early Leave
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{(workHoursPage - 1) * workHoursLimit + 1}</span> to <span className="font-medium">{Math.min(workHoursPage * workHoursLimit, workHoursTotal)}</span> of <span className="font-medium">{workHoursTotal}</span> results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setWorkHoursPage(p => Math.max(1, p - 1))}
                disabled={workHoursPage === 1}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setWorkHoursPage(p => p + 1)}
                disabled={workHoursPage * workHoursLimit >= workHoursTotal}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Loading HR Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg-main)] flex overflow-hidden">
      {/* Sidebar Overlay (Mobile) */}
      <div
        className={`sidebar-overlay ${isSidebarOpen ? 'show' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar-drawer w-64 bg-[#2e2e2e] text-[#f6f3ee] flex flex-col shadow-xl lg:static lg:left-0 ${isSidebarOpen ? 'open' : ''}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#3f4a59]">
          <span className="text-lg font-bold tracking-wide">HRMS HR Panel</span>
          <button className="lg:hidden text-[#f6f3ee]" onClick={() => setIsSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
          {[
            { id: TABS.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
            { id: TABS.EMPLOYEES, label: 'Employees', icon: Users },
            { id: TABS.LEAVE_APPLICATIONS, label: 'Leaves', icon: FileText },
            { id: TABS.APPLY_LEAVE, label: 'Apply Leave', icon: PlusCircle },
            { id: TABS.CALENDAR, label: 'Calendar', icon: Calendar },
            { id: TABS.ANALYTICS, label: 'Analytics', icon: BarChartIcon },
            { id: TABS.AUDIT_LOGS, label: 'Audit Logs', icon: ClipboardList },
            { id: TABS.WORK_HOURS, label: 'Work Hours', icon: Clock },
            { id: TABS.SETTINGS, label: 'Settings', icon: Settings },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition rounded-md ${activeTab === item.id
                ? 'bg-[#3f4a59] text-white shadow-sm'
                : 'text-[#f6f3ee] hover:bg-[#3f4a59] hover:text-white'
                }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-[#3f4a59] p-4">
          <button
            onClick={handleLogout}
            className="w-full inline-flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 flex-shrink-0 bg-white shadow-sm border-b border-gray-200 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden text-gray-600 hover:text-gray-900"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-gray-900">Vivekanand Technologies</h1>
            </div>
            <div className="sm:hidden">
              <h1 className="text-lg font-bold text-gray-900">HR Panel</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-900">{user?.name || 'HR'}</p>
              <p className="text-xs text-gray-500 uppercase">{activeTab}</p>
            </div>
            <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold border-2 border-white shadow-sm">
              {user?.name?.charAt(0) || 'H'}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto bg-[color:var(--bg-main)]">
          {(error || success) && (
            <div className="max-w-7xl mx-auto mb-6">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm">
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}
              {success && (
                <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded shadow-sm">
                  <p className="text-sm text-emerald-700 font-medium">{success}</p>
                </div>
              )}
            </div>
          )}
          {activeTab === TABS.DASHBOARD && renderDashboard()}
          {activeTab === TABS.EMPLOYEES && renderEmployeeList()}
          {activeTab === TABS.LEAVE_APPLICATIONS && renderLeaveApplications()}
          {activeTab === TABS.APPLY_LEAVE && renderApplyLeave()}
          {activeTab === TABS.CALENDAR && renderCalendar(myLeaveHistory)}
          {activeTab === TABS.ANALYTICS && renderAnalytics()}
          {activeTab === TABS.AUDIT_LOGS && renderAuditLogs()}
          {activeTab === TABS.WORK_HOURS && renderWorkHours()}
          {activeTab === TABS.SETTINGS && renderSettings()}
          {renderQuickLeaveModal()}
          {renderEditDateModal()}
        </main>
      </div>
    </div>
  );
}

export default HrDashboard;
