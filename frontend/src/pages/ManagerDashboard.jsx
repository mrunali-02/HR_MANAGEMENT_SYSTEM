// src/components/ManagerDashboard.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './AdminDashboard.css'; // reuse admin styling

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const TABS = {
  DASHBOARD: 'dashboard',
  ATTENDANCE: 'attendance',
  WORK_HOURS: 'workHours',
  LEAVES: 'leaves',
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
  const [teamStats, setTeamStats] = useState(null);

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
      // 1) Manager profile (existing API)
      const profileRes = await axios.get(`${API_BASE_URL}/manager/${id}`, {
        headers: getAuthHeader(),
      });
      setProfile(profileRes.data);

      // 2) Team data – TODO: wire these routes on backend
      // For now, we'll keep safe fallbacks if these endpoints don't exist.
      try {
        const [attendanceRes, workRes, leavesRes, statsRes] = await Promise.allSettled([
          axios.get(`${API_BASE_URL}/manager/team/attendance`, {
            headers: getAuthHeader(),
          }),
          axios.get(`${API_BASE_URL}/manager/team/work-hours`, {
            headers: getAuthHeader(),
          }),
          axios.get(`${API_BASE_URL}/manager/team/leave-requests`, {
            headers: getAuthHeader(),
          }),
          axios.get(`${API_BASE_URL}/manager/team/stats`, {
            headers: getAuthHeader(),
          }),
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
          setTeamLeaves(leavesRes.value.data.requests || leavesRes.value.data || []);
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
  const renderLeaves = () => (
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
              {teamLeaves.map((la) => (
                <tr key={la.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {la.employee_name || la.employee_email}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500 capitalize">
                    {la.type}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {la.start_date} → {la.end_date}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500 max-w-xs truncate">
                    {la.reason || '-'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        la.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : la.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
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
                    colSpan={6}
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

  // REPORTS – Team-level statistics / export info
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

      <div className="bg-white shadow rounded-lg p-4 space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">
          Export Team Reports
        </h3>
        <p className="text-sm text-gray-500">
          As per your module summary, you can export **team-level** reports.
          Admin controls global exports and enabling/disabling this feature.
        </p>
        <button
          type="button"
          onClick={() => alert('TODO: implement team report export API')}
          className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
        >
          Export Team Report (coming soon)
        </button>
      </div>
    </div>
  );

  // PROFILE – self-profile display (no edits; admin controls employee management)
  const renderProfile = () => (
    <div className="space-y-6 max-w-xl">
      <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
      <div className="bg-white shadow rounded-lg p-6 space-y-4">
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">Name</p>
          <p className="text-base text-gray-900">
            {managerUser?.name || 'Not set'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">Email</p>
          <p className="text-base text-gray-900">{managerUser?.email}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">Role</p>
          <p className="text-base text-gray-900 capitalize">
            {managerUser?.role}
          </p>
        </div>

        {profile?.profile && (
          <>
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">
                Display Name
              </p>
              <p className="text-base text-gray-900">
                {profile.profile.display_name || 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Bio</p>
              <p className="text-base text-gray-900">
                {profile.profile.bio || 'Not set'}
              </p>
            </div>
          </>
        )}

        <p className="text-xs text-gray-500">
          Employee Management changes (email, role, etc.) are controlled by the
          Admin module.
        </p>
      </div>
    </div>
  );

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
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${
              activeTab === TABS.DASHBOARD
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab(TABS.ATTENDANCE)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${
              activeTab === TABS.ATTENDANCE
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Team Attendance
          </button>
          <button
            onClick={() => setActiveTab(TABS.WORK_HOURS)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${
              activeTab === TABS.WORK_HOURS
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Work Hours
          </button>
          <button
            onClick={() => setActiveTab(TABS.LEAVES)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${
              activeTab === TABS.LEAVES
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Leave Requests
          </button>
          <button
            onClick={() => setActiveTab(TABS.REPORTS)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${
              activeTab === TABS.REPORTS
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Team Reports
          </button>
          <button
            onClick={() => setActiveTab(TABS.PROFILE)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${
              activeTab === TABS.PROFILE
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
          {activeTab === TABS.REPORTS && renderReports()}
          {activeTab === TABS.PROFILE && renderProfile()}
        </main>
      </div>
    </div>
  );
}

export default ManagerDashboard;
