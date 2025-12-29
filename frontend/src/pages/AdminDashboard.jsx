import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './AdminDashboard.css';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
} from 'recharts';
import CalendarView from '../components/CalendarView';
import EmployeeReports from '../components/EmployeeReports';
import LeaveCarryForward from '../components/LeaveCarryForward';
import { formatDate } from '../utils/dateUtils';
import { Save, Menu, X, Bell, LogOut, LayoutDashboard, Users, FileText, Calendar as CalendarIcon, ClipboardList, Clock, BarChart2, Settings as SettingsIcon, ChevronRight } from 'lucide-react';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const TABS = {
  DASHBOARD: 'dashboard',
  EMPLOYEES: 'employees',
  LEAVE_APPLICATIONS: 'leaveApplications',
  LEAVE_CARRY_FORWARD: 'leaveCarryForward',
  WORK_HOURS: 'workHours',
  REPORTS: 'reports',
  AUDIT_LOGS: 'auditLogs',
  CALENDAR: 'calendar',
  SETTINGS: 'settings',
};

const SETTINGS_TABS = {
  ACCOUNT: 'account',
  SECURITY: 'security',
};

function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
  const [users, setUsers] = useState([]);
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [holidays, setHolidays] = useState([]); // [NEW] Holidays state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit] = useState(20); // 20 logs per page
  const [auditSortBy, setAuditSortBy] = useState('timestamp'); // default sort by time, changed to 'timestamp'
  const [auditSortOrder, setAuditSortOrder] = useState('desc');
  const [auditSearch, setAuditSearch] = useState(''); // New state for audit log search

  // Reports State
  const [attendanceReport, setAttendanceReport] = useState([]);
  const [leaveReportData, setLeaveReportData] = useState([]);
  const [attendanceFilter, setAttendanceFilter] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    department: ''
  });
  const [leaveFilter, setLeaveFilter] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Tab-specific error and success messages
  const [tabErrors, setTabErrors] = useState({});
  const [tabSuccess, setTabSuccess] = useState({});
  const [reportData, setReportData] = useState({ attendance: [], leaves: [] });
  const [processingLeaveId, setProcessingLeaveId] = useState(null);

  // Work Hours Logs State (Admin)
  const [workHoursLogs, setWorkHoursLogs] = useState([]);
  const [workHoursTotal, setWorkHoursTotal] = useState(0);
  const [workHoursPage, setWorkHoursPage] = useState(1);
  const [workHoursLimit] = useState(20);
  const [workHoursSearch, setWorkHoursSearch] = useState('');
  const [workHoursDateRange, setWorkHoursDateRange] = useState({ start: '', end: '' });

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [formData, setFormData] = useState({
    employee_id: '',
    name: '',
    email: '',
    password: '',
    role: 'employee',
    department: '',
    designation: '',
    phone: '',
    joined_on: '',
    address: '',
    contact_number: '',
    dob: '',
    gender: '',
    blood_group: '',
    nationality: '',
    emergency_contact: '',
  });

  // ✅ Settings state moved to top-level (not inside renderSettings)
  const [profileInfo, setProfileInfo] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
  });

  const [summary, setSummary] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    pendingLeaveRequests: 0,
    presentToday: 0,
    absentToday: 0,
    totalManagers: 0,
    totalHr: 0,
    totalAdmins: 0,
    inactiveEmployees: 0,
    leavesToday: 0,
  });
  const [notifications, setNotifications] = useState([]);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [searchFilters, setSearchFilters] = useState({
    name: '',
    employeeId: '',
    email: '',
    role: '',
  });
  const [leaveStatistics, setLeaveStatistics] = useState({
    plannedLeave: 0,
    casualLeave: 0,
    sickLeave: 0,
    year: new Date().getFullYear(),
  });
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Settings State
  const [settingsActiveTab, setSettingsActiveTab] = useState(SETTINGS_TABS.ACCOUNT);
  const [settings, setSettings] = useState({
    security: {
      passwordMinLength: 8,
      passwordExpireInDays: 90,
      maxLoginAttempts: 5,
      enableTwoFactorAuth: false,
      enableRememberMe: true,
    },
  });

  // Calendar & Attendance State
  const [calendarStats, setCalendarStats] = useState({});
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [checkoutMarked, setCheckoutMarked] = useState(false);

  // Admin Leave Broadcast State
  const [showAdminLeaveModal, setShowAdminLeaveModal] = useState(false);
  const [adminLeaveForm, setAdminLeaveForm] = useState({
    startDate: '',
    endDate: '',
    reason: ''
  });

  const handleSettingChange = (category, field, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const saveSettings = async (category) => {
    try {
      const token = localStorage.getItem('token');
      const settingsValue = settings[category];

      await axios.put(
        `${API_BASE_URL}/admin/settings/${category}`,
        { value: settingsValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setTabSuccess({ [TABS.SETTINGS]: `${category} settings saved successfully!` });
      setTimeout(() => setTabSuccess(prev => {
        const newState = { ...prev };
        delete newState[TABS.SETTINGS];
        return newState;
      }), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setTabErrors({ [TABS.SETTINGS]: err.response?.data?.error || 'Failed to save settings.' });
      setTimeout(() => setTabErrors(prev => {
        const newState = { ...prev };
        delete newState[TABS.SETTINGS];
        return newState;
      }), 5000);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin/login');
      return;
    }
    Promise.all([
      fetchUsers(),
      fetchLeaveApplications(),
      fetchSettings(),
      fetchDashboardSummary(),
      fetchDashboardSummary(),
      fetchNotes(),
      fetchHolidays(),
      fetchMyAttendance()
    ]).finally(() => {
      setLoading(false);
    });
  }, [user, navigate]);

  // ... (existing code)

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

  useEffect(() => {
    if (activeTab === TABS.AUDIT_LOGS) {
      fetchAuditLogs();
    }
    if (activeTab === TABS.LEAVE_APPLICATIONS) {
      fetchLeaveStatistics();
    }
    if (activeTab === TABS.REPORTS) {
      fetchReportData();
    }
    if (activeTab === TABS.WORK_HOURS) {
      fetchWorkHoursLogs();
    }
  }, [activeTab, workHoursPage, workHoursSearch, workHoursDateRange]);

  /* ---------- Work Hours (Admin) ---------- */
  const fetchWorkHoursLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/admin/attendance-records`, {
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
      // setTabErrors({ [TABS.WORK_HOURS]: 'Failed to fetch work hours' }); 
      setWorkHoursLogs([]);
    }
  };

  const downloadWorkHoursReport = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/admin/export/work-hours-excel`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          search: workHoursSearch,
          startDate: workHoursDateRange.start,
          endDate: workHoursDateRange.end
        },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Work_Hours_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download work hours report error:', err);
      alert('Failed to download work hours report');
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const [attRes, leaveRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/admin/export/attendance`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/admin/export/leaves`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      console.log('Reports Data:', { attendance: attRes.data, leaves: leaveRes.data });
      setReportData({
        attendance: attRes.data,
        leaves: leaveRes.data
      });
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleBackLogout = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      logout();
    };
    window.addEventListener('popstate', handleBackLogout);
    return () => window.removeEventListener('popstate', handleBackLogout);
  }, [logout]);

  useEffect(() => {
    if (!showAddForm || selectedEmployee) return;
    setFormData((prev) => {
      const generated = generateEmployeeId(prev.role);
      if (prev.employee_id === generated) return prev;
      return { ...prev, employee_id: generated };
    });
  }, [showAddForm, selectedEmployee, users]);

  // Clear messages when switching tabs
  useEffect(() => {
    setError('');
    setSuccess('');
    setTabErrors({});
    setTabSuccess({});
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.settings) {
        setSettings(prev => ({
          ...prev,
          ...Object.keys(response.data.settings).reduce((acc, key) => {
            // Merge existing defaults with fetched data to ensure structure
            acc[key] = { ...prev[key], ...response.data.settings[key] };
            return acc;
          }, {})
        }));
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      // Don't show error to user immediately, just use defaults
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUsers(response.data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.response?.data?.error || 'Failed to fetch users');
      if (err.response?.status === 401) {
        navigate('/admin/login');
      }
    }
  };

  const fetchLeaveApplications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/admin/leave-requests`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setLeaveApplications(response.data.requests || response.data || []);
      // Also fetch leave statistics
      fetchLeaveStatistics();
    } catch (err) {
      console.error('Error fetching leave requests:', err);
      setLeaveApplications([]);
    }
  };

  const fetchLeaveStatistics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/admin/leave-statistics`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setLeaveStatistics(response.data || {
        plannedLeave: 0,
        casualLeave: 0,
        sickLeave: 0,
        year: new Date().getFullYear(),
      });
    } catch (err) {
      console.error('Error fetching leave statistics:', err);
    }
  };

  const handleCreateAdminLeave = async () => {
    try {
      if (!adminLeaveForm.startDate || !adminLeaveForm.endDate) {
        alert('Please select start and end dates');
        return;
      }

      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/admin/leaves/create-broadcast`,
        adminLeaveForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setTabSuccess({ [TABS.CALENDAR]: 'Admin leave broadcasted successfully!' });
      setShowAdminLeaveModal(false);
      setAdminLeaveForm({ startDate: '', endDate: '', reason: '' });

      // Refresh calendar
      fetchCalendarSummary(new Date());

      setTimeout(() => setTabSuccess(prev => {
        const n = { ...prev };
        delete n[TABS.CALENDAR];
        return n;
      }), 3000);

    } catch (err) {
      console.error('Failed to create admin leave:', err);
      setTabErrors({ [TABS.CALENDAR]: err.response?.data?.error || 'Failed to create leave' });
    }
  };

  const fetchDashboardSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSummary(response.data?.totals || {
        totalEmployees: 0,
        activeEmployees: 0,
        pendingLeaveRequests: 0,
        presentToday: 0,
        absentToday: 0,
        totalManagers: 0,
        totalHr: 0,
        totalAdmins: 0,
        inactiveEmployees: 0,
        leavesToday: 0,
      });
      setNotifications(response.data?.notifications || []);
    } catch (err) {
      // Fallback to stats endpoint if summary fails
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE_URL}/admin/dashboard-stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSummary(res.data);
      } catch (innerErr) {
        console.error('Fetch dashboard summary error:', innerErr);
        setSummary((prev) => ({ ...prev }));
      }
    }
  };

  const fetchNotes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/admin/notes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotes(response.data?.notes || []);
    } catch (err) {
      console.error('Error fetching notes:', err);
      setNotes([]);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const offset = (auditPage - 1) * auditLimit;
      const res = await axios.get(`${API_BASE_URL}/admin/audit-logs`, {
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
      setTabErrors((prev) => ({ ...prev, [TABS.AUDIT_LOGS]: err.response?.data?.error || 'Failed to fetch audit logs' }));
    }
  };

  useEffect(() => {
    if (activeTab === TABS.AUDIT_LOGS) {
      fetchAuditLogs();
    }
    if (activeTab === TABS.REPORTS) {
      fetchDetailedReports();
    }
    if (activeTab === TABS.CALENDAR) {
      fetchCalendarSummary();
    }
    if (activeTab === TABS.WORK_HOURS) {
      fetchWorkHoursLogs();
    }
  }, [activeTab, auditPage, auditSortBy, auditSortOrder, auditSearch, attendanceFilter, leaveFilter, workHoursPage, workHoursLimit, workHoursSearch, workHoursDateRange]);

  const fetchCalendarSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const now = new Date();
      // Using HR endpoint which is accessible to Admin
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

  const fetchMyAttendance = async () => {
    if (!user?.id) return;
    try {
      const token = localStorage.getItem('token');
      // Using Employee endpoint which is accessible to any authenticated user for their own ID
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


  const fetchDetailedReports = async () => {
    try {
      const token = localStorage.getItem('token');

      // Fetch Attendance
      const attRes = await axios.get(`${API_BASE_URL}/admin/reports/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
        params: attendanceFilter
      });
      setAttendanceReport(attRes.data.stats || []);

      // Fetch Leaves
      const leaveRes = await axios.get(`${API_BASE_URL}/admin/reports/leaves`, {
        headers: { Authorization: `Bearer ${token}` },
        params: leaveFilter
      });

      const rawStats = leaveRes.data.stats || [];
      // Pivot for Recharts: { date: '...', sick: 5, casual: 2 }
      const pivoted = {};
      rawStats.forEach(({ date, type, count }) => {
        if (!pivoted[date]) pivoted[date] = { date };
        pivoted[date][type] = count;
      });
      // Fill missing types with 0 if needed, or leave undefined (Recharts handles it)
      const chartData = Object.values(pivoted).sort((a, b) => new Date(a.date) - new Date(b.date));

      setLeaveReportData(chartData);

    } catch (err) {
      console.error('Error fetching reports:', err);
    }
  };

  const downloadCSV = (data, filename) => {
    if (!data.length) {
      alert('No data to export');
      return;
    }
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        let val = row[header] || '';
        // If the header suggests a date field, try to format it
        if (typeof val === 'string' && (header.includes('date') || header.includes('joined_on') || header.includes('dob'))) {
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

  const handleAddNote = async () => {
    const content = noteText.trim();
    if (!content) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/admin/notes`, { content }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNoteText('');
      fetchNotes();
    } catch (err) {
      console.error('Error saving note:', err);
      alert(err.response?.data?.error || 'Failed to save note');
    }
  };

  const handleDeleteNote = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/admin/notes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotes();
    } catch (err) {
      console.error('Error deleting note:', err);
      alert(err.response?.data?.error || 'Failed to delete note');
    }
  };

  const handleApproveLeave = async (leaveId) => {
    if (processingLeaveId === leaveId) return;
    setProcessingLeaveId(leaveId);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/admin/leave-requests/${leaveId}/approve`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setTabSuccess({ [TABS.LEAVE_APPLICATIONS]: 'Leave request approved successfully!' });
      setTimeout(() => setTabSuccess(prev => {
        const newState = { ...prev };
        delete newState[TABS.LEAVE_APPLICATIONS];
        return newState;
      }), 3000);
      fetchLeaveApplications();
      fetchDashboardSummary();
    } catch (err) {
      setTabErrors({ [TABS.LEAVE_APPLICATIONS]: err.response?.data?.error || 'Failed to approve leave request' });
      setTimeout(() => setTabErrors(prev => {
        const newState = { ...prev };
        delete newState[TABS.LEAVE_APPLICATIONS];
        return newState;
      }), 5000);
    } finally {
      setProcessingLeaveId(null);
    }
  };

  const handleRejectLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to reject this leave request?')) {
      return;
    }

    setProcessingLeaveId(leaveId);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/admin/leave-requests/${leaveId}/reject`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setTabSuccess({ [TABS.LEAVE_APPLICATIONS]: 'Leave request rejected successfully!' });
      setTimeout(() => setTabSuccess(prev => {
        const newState = { ...prev };
        delete newState[TABS.LEAVE_APPLICATIONS];
        return newState;
      }), 3000);
      fetchLeaveApplications();
      fetchDashboardSummary();
    } catch (err) {
      setTabErrors({ [TABS.LEAVE_APPLICATIONS]: err.response?.data?.error || 'Failed to reject leave request' });
      setTimeout(() => setTabErrors(prev => {
        const newState = { ...prev };
        delete newState[TABS.LEAVE_APPLICATIONS];
        return newState;
      }), 5000);
    } finally {
      setProcessingLeaveId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      employee_id: '',
      first_name: '',
      middle_name: '',
      last_name: '',
      email: '',
      password: '',
      role: 'employee',
      department: '',
      phone: '',
      joined_on: '',
      address: '',
      status: 'active',
      dob: '',
      gender: '',
      blood_group: '',
      nationality: '',
      emergency_contact: '',
    });
    setSelectedEmployee(null);
  };

  const handleAddOrUpdateEmployee = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');

      if (selectedEmployee) {
        // Update existing employee (metadata, not email/id)
        await axios.put(
          `${API_BASE_URL}/admin/employees/${selectedEmployee.id}`,
          {
            first_name: formData.first_name,
            middle_name: formData.middle_name,
            last_name: formData.last_name,
            role: formData.role,
            department: formData.department || null,
            phone: formData.phone || null,
            joined_on: formData.joined_on || null,
            address: formData.address || null,
            status: formData.status || 'active',
            dob: formData.dob || null,
            gender: formData.gender || null,
            blood_group: formData.blood_group || null,
            nationality: formData.nationality || null,
            emergency_contact: formData.emergency_contact || null,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setTabSuccess({ [TABS.EMPLOYEES]: 'Employee updated successfully!' });
        setTimeout(() => setTabSuccess(prev => {
          const newState = { ...prev };
          delete newState[TABS.EMPLOYEES];
          return newState;
        }), 3000);
      } else {
        // Create new employee
        await axios.post(`${API_BASE_URL}/admin/employees`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setTabSuccess({ [TABS.EMPLOYEES]: 'Employee added successfully!' });
        setTimeout(() => setTabSuccess(prev => {
          const newState = { ...prev };
          delete newState[TABS.EMPLOYEES];
          return newState;
        }), 3000);
      }

      resetForm();
      setShowAddForm(false);
      fetchUsers();
      fetchDashboardSummary();
    } catch (err) {
      setTabErrors({ [TABS.EMPLOYEES]: err.response?.data?.error || 'Failed to add employee' });
      setTimeout(() => setTabErrors(prev => {
        const newState = { ...prev };
        delete newState[TABS.EMPLOYEES];
        return newState;
      }), 5000);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/admin/users/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setTabSuccess({ [TABS.EMPLOYEES]: 'User deleted successfully!' });
      setTimeout(() => setTabSuccess(prev => {
        const newState = { ...prev };
        delete newState[TABS.EMPLOYEES];
        return newState;
      }), 3000);
      fetchUsers();
      fetchDashboardSummary();
    } catch (err) {
      setTabErrors({ [TABS.EMPLOYEES]: err.response?.data?.error || 'Failed to delete user' });
      setTimeout(() => setTabErrors(prev => {
        const newState = { ...prev };
        delete newState[TABS.EMPLOYEES];
        return newState;
      }), 5000);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const totalEmployees = users.length;
  const totalManagers = users.filter((u) => u.role === 'manager').length;
  const totalHr = users.filter((u) => u.role === 'hr').length;
  const totalAdmins = users.filter((u) => u.role === 'admin').length;
  const activeEmployeesCount = summary.activeEmployees || users.filter((u) => (u.status || 'active') !== 'inactive').length;
  const pendingLeaveCount = summary.pendingLeaveRequests || leaveApplications.filter((la) => la.status === 'pending').length;
  const presentTodayCount = summary.presentToday ?? 0;
  const absentTodayCount = summary.absentToday ?? Math.max(0, totalEmployees - presentTodayCount);
  const totalManagersCount = summary.totalManagers || totalManagers;
  const totalHrCount = summary.totalHr || totalHr;
  const totalAdminsCount = summary.totalAdmins || totalAdmins;
  const inactiveEmployeesCount = summary.inactiveEmployees || users.filter((u) => (u.status || 'active') === 'inactive').length;
  const leavesTodayCount = summary.leavesToday || 0;

  const generateEmployeeId = () => {
    const maxNumber = users.reduce((max, u) => {
      if (!u.employee_id) return max;
      // Extract numeric part from existing IDs (e.g. "emp001" -> 1, "005" -> 5)
      const numStr = u.employee_id.replace(/\D/g, '');
      if (!numStr) return max;
      const parsed = parseInt(numStr, 10);
      if (Number.isNaN(parsed)) return max;
      return Math.max(max, parsed);
    }, 0);

    const nextNumber = maxNumber + 1;
    return String(nextNumber).padStart(3, '0');
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Dashboard Overview</h2>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <div className="bg-white border-l-4 border-[color:var(--accent-primary)] rounded-xl p-5 shadow-sm card-hover">
          <div className="text-sm uppercase tracking-wide text-secondary">Total Employees</div>
          <div className="mt-2 text-3xl font-bold text-primary">
            {summary.totalEmployees || totalEmployees}
          </div>
        </div>

        <div className="bg-white border-l-4 border-[color:var(--status-success)] rounded-xl p-5 shadow-sm card-hover">
          <div className="text-sm uppercase tracking-wide text-secondary">Active Employees</div>
          <div className="mt-2 text-3xl font-bold text-primary">{activeEmployeesCount}</div>
        </div>

        <div className="bg-white border-l-4 border-[color:var(--status-pending)] rounded-xl p-5 shadow-sm card-hover">
          <div className="text-sm uppercase tracking-wide text-secondary">Pending Leave Requests</div>
          <div className="mt-2 text-3xl font-bold text-primary">{pendingLeaveCount}</div>
        </div>

        <div className="bg-white border-l-4 border-[color:var(--accent-primary)] rounded-xl p-5 shadow-sm card-hover">
          <div className="text-sm uppercase tracking-wide text-secondary">Today Attendance</div>
          <div className="mt-2 text-lg font-semibold flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[color:var(--status-success)]"></span>
              <span className="text-primary">Present: {presentTodayCount}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[color:var(--status-inactive)]"></span>
              <span className="text-secondary">Absent: {absentTodayCount}</span>
            </span>
          </div>
        </div>
        <div className="bg-white border-l-4 border-[color:var(--accent-primary)] rounded-xl p-5 shadow-sm card-hover">
          <div className="text-sm uppercase tracking-wide text-secondary">Today's Leaves</div>
          <div className="mt-2 text-3xl font-bold text-primary">{leavesTodayCount}</div>
        </div>

        <div className="bg-white border-l-4 border-[color:var(--text-secondary)] rounded-xl p-5 shadow-sm card-hover">
          <div className="text-sm uppercase tracking-wide text-secondary">Total Managers</div>
          <div className="mt-2 text-3xl font-bold text-primary">{totalManagersCount}</div>
        </div>

        <div className="bg-white border-l-4 border-[color:var(--text-secondary)] rounded-xl p-5 shadow-sm card-hover">
          <div className="text-sm uppercase tracking-wide text-secondary">Total HR</div>
          <div className="mt-2 text-3xl font-bold text-primary">{totalHrCount}</div>
        </div>

        <div className="bg-white border-l-4 border-[color:var(--text-secondary)] rounded-xl p-5 shadow-sm card-hover">
          <div className="text-sm uppercase tracking-wide text-secondary">Total Admins</div>
          <div className="mt-2 text-3xl font-bold text-primary">{totalAdminsCount}</div>
        </div>

        <div className="bg-white border-l-4 border-[color:var(--status-inactive)] rounded-xl p-5 shadow-sm card-hover">
          <div className="text-sm uppercase tracking-wide text-secondary">Inactive Employees</div>
          <div className="mt-2 text-3xl font-bold text-primary">{inactiveEmployeesCount}</div>
        </div>
      </div>

      {/* Recent employees */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4 text-primary">Recent Employees</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-[#f0f4f8]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                  Joined On
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.slice(0, 5).map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-primary">
                    {[u.first_name, u.middle_name, u.last_name].filter(Boolean).join(' ') || u.email}

                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary">{u.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary capitalize">
                    {u.role}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary">
                    {formatDate(u.joined_on)}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-center text-sm text-gray-500" colSpan={4}>
                    No employees yet. Use the Employee List tab to add employees.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notifications + Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-900">Notifications</h3>
          <ul className="space-y-2">
            {notifications.map((note, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500 inline-block"></span>
                <span>{note}</span>
              </li>
            ))}
            {notifications.length === 0 && (
              <li className="text-sm text-gray-500">No notifications</li>
            )}
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
            <button
              onClick={handleAddNote}
              className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
            >
              Save Note
            </button>
          </div>
          <textarea
            className="w-full border rounded-md p-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={3}
            placeholder="Add a quick note..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {notes.map((n) => (
              <div
                key={n.id}
                className="border rounded-md p-2 text-sm flex items-start justify-between gap-2"
              >
                <div>
                  <p className="text-gray-800">{n.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteNote(n.id)}
                  className="text-red-600 text-xs hover:underline"
                >
                  Delete
                </button>
              </div>
            ))}
            {notes.length === 0 && (
              <p className="text-sm text-gray-500">No notes saved yet.</p>
            )}
          </div>
        </div>
      </div>
    </div >
  );

  const handleEditClick = (employee) => {
    console.log('Editing employee:', employee);
    setSelectedEmployee(employee);
    setShowAddForm(true);
    setTabErrors(prev => {
      const newState = { ...prev };
      delete newState[TABS.EMPLOYEES];
      return newState;
    });
    setTabSuccess(prev => {
      const newState = { ...prev };
      delete newState[TABS.EMPLOYEES];
      return newState;
    });
    setFormData({
      employee_id: employee.employee_id || '',
      first_name: employee.first_name || '',
      middle_name: (employee.middle_name && employee.middle_name !== employee.email) ? employee.middle_name : '',
      last_name: employee.last_name || '',
      email: employee.email,
      role: employee.role || 'employee',
      department: employee.department || '',
      phone: employee.phone || '',
      joined_on: employee.joined_on ? employee.joined_on.substring(0, 10) : '',
      address: employee.address || '',
      status: employee.status || 'active',
      dob: employee.dob ? employee.dob.substring(0, 10) : '',
      gender: employee.gender || '',
      blood_group: employee.blood_group || '',
      nationality: employee.nationality || '',
      emergency_contact: employee.emergency_contact || '',
    });
  };

  const renderEmployeeList = () => {
    const filteredUsers = users.filter((u) => {
      const fullName = [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(' ') || u.name || '';
      const nameMatch = searchFilters.name ? fullName.toLowerCase().includes(searchFilters.name.toLowerCase()) : true;
      const idMatch = searchFilters.employeeId ? (u.employee_id || '').toLowerCase().includes(searchFilters.employeeId.toLowerCase()) : true;
      const emailMatch = searchFilters.email ? (u.email || '').toLowerCase().includes(searchFilters.email.toLowerCase()) : true;
      const roleMatch = searchFilters.role ? (u.role || '').toLowerCase().includes(searchFilters.role.toLowerCase()) : true;
      return nameMatch && idMatch && emailMatch && roleMatch;
    });

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Employee List</h2>
          <button
            onClick={() => {
              if (showAddForm && !selectedEmployee) {
                setShowAddForm(false);
                resetForm();
              } else {
                setSelectedEmployee(null);
                resetForm();

                // Pre-fill new Employee ID
                const newId = generateEmployeeId();
                setFormData(prev => ({ ...prev, employee_id: newId }));

                setShowAddForm(true);
              }
            }}
            className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-700 focus:outline-none"
          >
            {showAddForm ? 'Cancel' : 'Add Employee'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search by name"
            value={searchFilters.name}
            onChange={(e) => setSearchFilters({ ...searchFilters, name: e.target.value })}
          />
          <input
            className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search by employee ID"
            value={searchFilters.employeeId}
            onChange={(e) => setSearchFilters({ ...searchFilters, employeeId: e.target.value })}
          />
          <input
            className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search by email"
            value={searchFilters.email}
            onChange={(e) => setSearchFilters({ ...searchFilters, email: e.target.value })}
          />
          <input
            className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search by role"
            value={searchFilters.role}
            onChange={(e) => setSearchFilters({ ...searchFilters, role: e.target.value })}
          />
        </div>

        {tabErrors[TABS.EMPLOYEES] && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-2">
            {tabErrors[TABS.EMPLOYEES]}
          </div>
        )}

        {tabSuccess[TABS.EMPLOYEES] && (
          <div className="bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded mb-2">
            {tabSuccess[TABS.EMPLOYEES]}
          </div>
        )}

        {showAddForm && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4">
              {selectedEmployee ? 'Edit Employee' : 'Add New Employee'}
            </h3>
            <form onSubmit={handleAddOrUpdateEmployee} autoComplete="off">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                  <input
                    type="text"
                    name="employee_id"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    name="last_name"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Last Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    name="first_name"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="First Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Middle Name <span className="text-gray-400 text-xs">(Optional)</span></label>
                  <input
                    type="text"
                    name="middle_name"
                    autoComplete="off"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.middle_name}
                    onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                    placeholder="Middle Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    name="email"
                    required={!selectedEmployee}
                    autoComplete="off"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!!selectedEmployee}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    required={!selectedEmployee}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={selectedEmployee ? 'Leave blank to keep current password' : ''}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role <span className="text-red-500">*</span></label>
                  <select
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        role: e.target.value,
                        // ID should remain the same even if role changes
                      }))
                    }
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="hr">HR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Department <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Designation</label>
                  <input
                    type="text"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Senior Developer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    pattern="[0-9]{10}"
                    maxLength={10}
                    title="Enter 10 digit phone number"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter 10-digit phone"
                    value={formData.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData({ ...formData, phone: value });
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Joined On</label>
                  <input
                    type="date"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.joined_on}
                    onChange={(e) => setFormData({ ...formData, joined_on: e.target.value })}


                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date of Birth <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.dob}
                    max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}


                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Gender <span className="text-red-500">*</span></label>
                  <select
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Blood Group</label>
                  <select
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.blood_group}
                    onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                  >
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nationality <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Emergency Contact <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    pattern="[0-9]{10}"
                    title="Enter 10 digit phone number"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter 10-digit number"
                    value={formData.emergency_contact}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData({ ...formData, emergency_contact: value });
                    }}
                    maxLength={10}
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Address <span className="text-red-500">*</span></label>
                  <textarea
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={2}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded shadow-sm"
                >
                  {selectedEmployee ? 'Save Changes' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee ID
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Designation
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined On
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{u.id}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {u.employee_id || '-'}
                    </td>
                    <td
                      className="px-4 py-2 whitespace-nowrap text-sm text-indigo-600 cursor-pointer hover:underline"
                      onClick={() => handleEditClick(u)}
                    >
                      {u.name || u.email}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {u.designation || '-'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {u.phone || '-'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(u.joined_on)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                        {u.status || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right text-sm">
                      {u.id !== user?.id && (
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-4 text-center text-sm text-gray-500"
                      colSpan={5}
                    >
                      No employees to display.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div >
      </div>
    );
  }
  const renderLeaveApplications = () => {
    const sortedLeaves = leaveApplications;

    const handleLeaveRowClick = (leave) => {
      setSelectedLeave(leave);
      setShowLeaveModal(true);
    };

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
        <h2 className="text-2xl font-bold text-gray-900">Leave Applications</h2>

        {tabErrors[TABS.LEAVE_APPLICATIONS] && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-2">
            {tabErrors[TABS.LEAVE_APPLICATIONS]}
          </div>
        )}

        {tabSuccess[TABS.LEAVE_APPLICATIONS] && (
          <div className="bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded mb-2">
            {tabSuccess[TABS.LEAVE_APPLICATIONS]}
          </div>
        )}

        {/* Leave Statistics Card */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">
            Total Approved Leave Days for {leaveStatistics.year}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-sm text-blue-600 font-medium">Planned Leave</div>
              <div className="text-2xl font-bold text-blue-800 mt-1">{leaveStatistics.plannedLeave}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-sm text-green-600 font-medium">Casual Leave</div>
              <div className="text-2xl font-bold text-green-800 mt-1">{leaveStatistics.casualLeave}</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="text-sm text-orange-600 font-medium">Sick Leave</div>
              <div className="text-2xl font-bold text-orange-800 mt-1">{leaveStatistics.sickLeave}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="text-sm text-purple-600 font-medium">Work From Home</div>
              <div className="text-2xl font-bold text-purple-800 mt-1">{leaveStatistics.wfhLeave || 0}</div>
            </div>
          </div>
        </div>

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
                    Reason
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
                {sortedLeaves.map((la) => (
                  <tr
                    key={la.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleLeaveRowClick(la)}
                  >
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                      {la.employee_name || la.employee_email}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {la.type === 'paid' ? 'Planned' : la.type}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(la.start_date)} &rarr; {formatDate(la.end_date)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 font-semibold">
                      {la.days || calculateDays(la.start_date, la.end_date)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500 max-w-xs truncate">
                      {la.reason || '-'}
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
                    <td className="px-4 py-2 whitespace-nowrap text-right text-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApproveLeave(la.id)}
                          disabled={la.status === 'approved' || la.status === 'cancelled' || processingLeaveId === la.id}
                          className={`inline-flex items-center px-3 py-1.5 rounded-md text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${la.status === 'approved' || la.status === 'cancelled' || processingLeaveId === la.id
                            ? 'bg-green-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700'
                            }`}
                        >
                          {processingLeaveId === la.id ? 'Processing...' : la.status === 'approved' ? 'Approved' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleRejectLeave(la.id)}
                          disabled={la.status === 'rejected' || la.status === 'cancelled' || processingLeaveId === la.id}
                          className={`inline-flex items-center px-3 py-1.5 rounded-md text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${la.status === 'rejected' || la.status === 'cancelled' || processingLeaveId === la.id
                            ? 'bg-red-400 cursor-not-allowed'
                            : 'bg-red-600 hover:bg-red-700'
                            }`}
                        >
                          {processingLeaveId === la.id && la.status !== 'rejected' ? 'Processing...' : la.status === 'rejected' ? 'Rejected' : 'Reject'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedLeaves.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-4 text-center text-sm text-gray-500"
                      colSpan={7}
                    >
                      No leave applications to display yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leave Details Modal */}
        {showLeaveModal && selectedLeave && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Leave Application Details</h3>
                  <button
                    onClick={() => {
                      setShowLeaveModal(false);
                      setSelectedLeave(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Employee</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedLeave.employee_name || selectedLeave.employee_email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedLeave.employee_email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Leave Type</label>
                    <p className="mt-1 text-sm text-gray-900 capitalize">{selectedLeave.type === 'paid' ? 'Planned' : selectedLeave.type}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Start Date</label>
                      <p className="mt-1 text-sm text-gray-900">{formatDate(selectedLeave.start_date)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">End Date</label>
                      <p className="mt-1 text-sm text-gray-900">{formatDate(selectedLeave.end_date)}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duration</label>
                    <p className="mt-1 text-sm text-gray-900 font-bold">{selectedLeave.days || calculateDays(selectedLeave.start_date, selectedLeave.end_date)} Days</p>
                  </div>
                  {selectedLeave.document_url && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Attached Document</label>
                      <a
                        href={`${API_BASE_URL.replace('/api', '')}/${selectedLeave.document_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-sm text-indigo-600 hover:text-indigo-800 underline"
                      >
                        View Document
                      </a>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reason</label>
                    <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{selectedLeave.reason || 'No reason provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <span
                      className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full mt-1 ${selectedLeave.status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : selectedLeave.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : selectedLeave.status === 'cancelled'
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                    >
                      {selectedLeave.status}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Applied On</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedLeave.created_at ? new Date(selectedLeave.created_at).toLocaleString() : '-'}
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      setShowLeaveModal(false);
                      setSelectedLeave(null);
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAuditLogs = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
          <p className="text-sm text-gray-500">System activities and actions</p>
        </div>
        <div className="text-sm text-gray-500">Total: {auditTotal}</div>
      </div>

      {tabErrors[TABS.AUDIT_LOGS] && (
        <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-2">
          {tabErrors[TABS.AUDIT_LOGS]}
        </div>
      )}

      {/* Search Input */}
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Search by User or Activity..."
          className="w-full sm:w-1/3 border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={auditSearch}
          onChange={(e) => {
            setAuditSearch(e.target.value);
            setAuditPage(1); // Reset to first page on search
          }}
        />
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    if (auditSortBy === 'time') {
                      setAuditSortOrder(auditSortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setAuditSortBy('time');
                      setAuditSortOrder('desc');
                    }
                  }}
                >
                  Time {auditSortBy === 'time' && (auditSortOrder === 'asc' ? 'â†‘' : 'â†“')}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    if (auditSortBy === 'user') {
                      setAuditSortOrder(auditSortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setAuditSortBy('user');
                      setAuditSortOrder('asc');
                    }
                  }}
                >
                  User {auditSortBy === 'user' && (auditSortOrder === 'asc' ? 'â†‘' : 'â†“')}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    if (auditSortBy === 'activity') {
                      setAuditSortOrder(auditSortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setAuditSortBy('activity');
                      setAuditSortOrder('asc');
                    }
                  }}
                >
                  Activity {auditSortBy === 'activity' && (auditSortOrder === 'asc' ? 'â†‘' : 'â†“')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Metadata
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-sm text-gray-500">
                    No audit logs found.
                  </td>
                </tr>
              )}
              {auditLogs.map((log) => {
                let meta = null;
                try {
                  meta = log.metadata ? JSON.parse(log.metadata) : null;
                } catch (e) {
                  meta = log.metadata;
                }
                return (
                  <tr key={log.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : '--'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                      {log.user_name || log.user_email || 'System'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                      {log.action}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {meta
                        ? typeof meta === 'string'
                          ? meta
                          : Object.entries(meta)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ')
                        : '--'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-lg shadow mt-4">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => setAuditPage(Math.max(1, auditPage - 1))}
            disabled={auditPage === 1}
            className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${auditPage === 1 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
          >
            Previous
          </button>
          <button
            onClick={() => setAuditPage(auditPage + 1)}
            disabled={auditPage * auditLimit >= auditTotal}
            className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${auditPage * auditLimit >= auditTotal ? 'opacity-50 cursor-not-allowed' : ''
              }`}
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{Math.min((auditPage - 1) * auditLimit + 1, auditTotal)}</span> to{' '}
              <span className="font-medium">{Math.min(auditPage * auditLimit, auditTotal)}</span> of{' '}
              <span className="font-medium">{auditTotal}</span> results
            </p>
          </div>
          <div>
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                onClick={() => setAuditPage(Math.max(1, auditPage - 1))}
                disabled={auditPage === 1}
                className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${auditPage === 1 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
              >
                <span className="sr-only">Previous</span>
                &larr; Prev
              </button>
              <button
                disabled
                className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0"
              >
                Page {auditPage}
              </button>
              <button
                onClick={() => setAuditPage(auditPage + 1)}
                disabled={auditPage * auditLimit >= auditTotal}
                className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${auditPage * auditLimit >= auditTotal ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
              >
                <span className="sr-only">Next</span>
                Next &rarr;
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Organization Reports</h2>
      <EmployeeReports
        attendanceData={reportData.attendance}
        leaveData={reportData.leaves}
        employees={users}
      />
    </div>
  );

  const renderCalendar = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
        <h2 className="text-2xl font-bold text-gray-800">My Attendance & Holidays</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdminLeaveModal(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-bold flex items-center gap-2"
          >
            <span>+ Admin Leave</span>
          </button>
          {!attendanceMarked ? (
            <button onClick={handleMarkAttendance} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold">Check In</button>
          ) : (
            <span className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-bold">Checked In</span>
          )}
          {attendanceMarked && !checkoutMarked && (
            <button onClick={handleCheckout} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-bold">Check Out</button>
          )}
          {checkoutMarked && (
            <span className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-bold">Checked Out</span>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <p className="mb-4 text-sm text-gray-600">Click on a date to manage holidays.</p>
        <CalendarView
          attendance={attendanceRecords}
          holidays={holidays}
          role="admin"
          onDateClick={handleToggleHoliday}
          calendarStats={calendarStats}
          onMonthChange={fetchCalendarSummary}
        />
      </div>

      {/* Admin Leave Modal */}
      {showAdminLeaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Add Admin Leave (Broadcast)</h3>
              <p className="text-sm text-gray-500 mb-4">
                This will create an approved leave for you and notify ALL active employees.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Date</label>
                  <input
                    type="date"
                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                    value={adminLeaveForm.startDate}
                    onChange={(e) => setAdminLeaveForm({ ...adminLeaveForm, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Date</label>
                  <input
                    type="date"
                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                    value={adminLeaveForm.endDate}
                    onChange={(e) => setAdminLeaveForm({ ...adminLeaveForm, endDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Reason</label>
                  <textarea
                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                    rows="3"
                    value={adminLeaveForm.reason}
                    onChange={(e) => setAdminLeaveForm({ ...adminLeaveForm, reason: e.target.value })}
                    placeholder="Brief reason for leave..."
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowAdminLeaveModal(false)}
                  className="px-4 py-2 border text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAdminLeave}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  Broadcast Leave
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderSettings = () => {
    const renderAccountSettings = () => (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Profile & Password</h3>

        {/* Profile Update */}
        <div className="bg-white rounded-xl border p-4 space-y-4">
          <h4 className="font-medium text-gray-700">Profile Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                className="mt-1 w-full border rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={profileInfo.name}
                onChange={(e) => setProfileInfo({ ...profileInfo, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                className="mt-1 w-full border rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={profileInfo.email}
                onChange={(e) => setProfileInfo({ ...profileInfo, email: e.target.value })}
              />
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                const token = localStorage.getItem('token');
                await axios.put(`${API_BASE_URL}/admin/profile/update`, profileInfo, { headers: { Authorization: `Bearer ${token}` } });
                setTabSuccess({ [TABS.SETTINGS]: 'Profile updated!' });
              } catch (err) { setTabErrors({ [TABS.SETTINGS]: 'Failed to update profile' }); }
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded shadow-sm hover:bg-indigo-700"
          >
            Save Profile
          </button>
        </div>

        {/* Password Change */}
        <div className="bg-white rounded-xl border p-4 space-y-4">
          <h4 className="font-medium text-gray-700">Change Password</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Current Password</label>
              <input
                type="password"
                className="mt-1 w-full border rounded-md p-2"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                className="mt-1 w-full border rounded-md p-2"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              />
            </div>
          </div>
          <button
            onClick={async () => {
              if (!passwordData.currentPassword || !passwordData.newPassword) return alert('Fill both fields');
              try {
                const token = localStorage.getItem('token');
                await axios.put(`${API_BASE_URL}/admin/profile/change-password`, passwordData, { headers: { Authorization: `Bearer ${token}` } });
                setTabSuccess({ [TABS.SETTINGS]: 'Password updated!' });
                setPasswordData({ currentPassword: '', newPassword: '' });
              } catch (err) { setTabErrors({ [TABS.SETTINGS]: 'Failed to change password' }); }
            }}
            className="bg-green-600 text-white px-4 py-2 rounded shadow-sm hover:bg-green-700"
          >
            Update Password
          </button>
        </div>
      </div>
    );

    const renderSecuritySettings = () => (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">System Security</h3>
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Minimum Password Length</label>
            <input type="number" className="mt-1 block w-full border rounded-md p-2"
              value={settings.security.passwordMinLength}
              onChange={(e) => handleSettingChange('security', 'passwordMinLength', parseInt(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password Expiry (Days)</label>
            <input type="number" className="mt-1 block w-full border rounded-md p-2"
              value={settings.security.passwordExpireInDays}
              onChange={(e) => handleSettingChange('security', 'passwordExpireInDays', parseInt(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Max Login Attempts</label>
            <input type="number" className="mt-1 block w-full border rounded-md p-2"
              value={settings.security.maxLoginAttempts}
              onChange={(e) => handleSettingChange('security', 'maxLoginAttempts', parseInt(e.target.value))} />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Enable Two-Factor Authentication</label>
            <input type="checkbox" className="h-5 w-5 text-indigo-600 rounded"
              checked={settings.security.enableTwoFactorAuth}
              onChange={(e) => handleSettingChange('security', 'enableTwoFactorAuth', e.target.checked)} />
          </div>
          <button onClick={() => saveSettings('security')} className="mt-4 w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Save Security Settings</button>
        </div>
      </div>
    );

    return (
      <div className="flex flex-col lg:flex-row gap-6 h-full">
        {/* Settings Navigation Sidebar */}
        <div className="w-full lg:w-64 flex-shrink-0 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-fit">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Settings</h2>
          </div>
          <nav className="flex flex-col">
            {Object.entries({
              [SETTINGS_TABS.ACCOUNT]: 'Account & Profile',
              [SETTINGS_TABS.SECURITY]: 'Security',
            }).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSettingsActiveTab(key)}
                className={`text-left px-4 py-3 text-sm font-medium transition-colors border-l-4 ${settingsActiveTab === key
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Settings Content Area */}
        <div className="flex-1 bg-gray-50 rounded-xl p-1">
          {tabSuccess[TABS.SETTINGS] && (
            <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
              {tabSuccess[TABS.SETTINGS]}
            </div>
          )}
          {tabErrors[TABS.SETTINGS] && (
            <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
              {tabErrors[TABS.SETTINGS]}
            </div>
          )}

          {settingsActiveTab === SETTINGS_TABS.ACCOUNT && renderAccountSettings()}
          {settingsActiveTab === SETTINGS_TABS.SECURITY && renderSecuritySettings()}
        </div>
      </div>
    );
  };



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg font-medium text-gray-700">Loading admin dashboard...</div>
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
          <span className="text-lg font-bold tracking-wide">HRMS Admin</span>
          <button className="lg:hidden text-[#f6f3ee]" onClick={() => setIsSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
          {[
            { id: TABS.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
            { id: TABS.EMPLOYEES, label: 'Employees', icon: Users },
            { id: TABS.LEAVE_APPLICATIONS, label: 'Leave Requests', icon: FileText },
            { id: TABS.LEAVE_CARRY_FORWARD, label: 'Carry Forward', icon: ChevronRight },
            { id: TABS.CALENDAR, label: 'Calendar', icon: CalendarIcon },
            { id: TABS.AUDIT_LOGS, label: 'Audit Logs', icon: ClipboardList },
            { id: TABS.WORK_HOURS, label: 'Work Hours', icon: Clock },
            { id: TABS.REPORTS, label: 'Reports', icon: BarChart2 },
            { id: TABS.SETTINGS, label: 'Settings', icon: SettingsIcon },
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
        {/* Top bar */}
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
              <h1 className="text-lg font-bold text-gray-900">Admin</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-900">{user?.name || 'Administrator'}</p>
              <p className="text-xs text-gray-500 uppercase">{activeTab}</p>
            </div>
            <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold border-2 border-white shadow-sm">
              {user?.name?.charAt(0) || 'A'}
            </div>
          </div>
        </header>

        {/* Content area */}
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
          {activeTab === TABS.LEAVE_CARRY_FORWARD && <LeaveCarryForward />}
          {activeTab === TABS.CALENDAR && renderCalendar()}
          {activeTab === TABS.AUDIT_LOGS && renderAuditLogs()}
          {activeTab === TABS.WORK_HOURS && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Work Hours & Attendance</h2>
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
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      className="w-full border rounded-md px-3 py-2"
                      value={workHoursDateRange.end}
                      onChange={(e) => setWorkHoursDateRange(prev => ({ ...prev, end: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-end self-end">
                    <button
                      onClick={downloadWorkHoursReport}
                      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Download Excel
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Times</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {workHoursLogs.length === 0 ? (
                        <tr><td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">No records found.</td></tr>
                      ) : (
                        workHoursLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(log.date)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="font-medium">{log.employee_name}</div>
                              <div className="text-xs text-gray-500">{log.employee_email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div>In: {log.check_in_time || '-'}</div>
                              <div>Out: {log.check_out_time || '-'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.total_hours || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                  ${log.status === 'present' ? 'bg-green-100 text-green-800' :
                                  log.status === 'absent' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'}`}>
                                {log.status}
                              </span>
                              <div className="flex gap-1 mt-1">
                                {log.is_late ? <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600 border border-red-200">Late</span> : null}
                                {log.is_left_early ? <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-600 border border-orange-200">Early</span> : null}
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
                  <button onClick={() => setWorkHoursPage(p => Math.max(1, p - 1))} disabled={workHoursPage === 1} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
                  <span className="text-sm">Page {workHoursPage}</span>
                  <button onClick={() => setWorkHoursPage(p => p + 1)} disabled={workHoursLogs.length < workHoursLimit} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
                </div>
              </div>
            </div>
          )}
          {activeTab === TABS.REPORTS && renderReports()}
          {activeTab === TABS.SETTINGS && renderSettings()}
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
