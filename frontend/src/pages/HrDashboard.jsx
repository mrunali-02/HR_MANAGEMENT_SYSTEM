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


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const TABS = {
  DASHBOARD: 'dashboard',
  EMPLOYEES: 'employees',
  LEAVE_APPLICATIONS: 'leaveApplications',
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'hr') {
      navigate('/login');
      return;
    }
    Promise.all([fetchUsers(), fetchManagers(), fetchLeaveApplications()]).finally(() => {
      setLoading(false);
    });
  }, [user, navigate]);

  useEffect(() => {
    if (activeTab === TABS.ANALYTICS) {
      fetchAnalytics();
    }
  }, [activeTab]);


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
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-6">
        <div className="bg-indigo-600 text-white p-6 rounded-lg shadow">
          <div className="text-sm opacity-80">Total Employees</div>
          <div className="text-3xl font-bold">{totalEmployees}</div>
        </div>
        <div className="bg-emerald-600 text-white p-6 rounded-lg shadow">
          <div className="text-sm opacity-80">Managers</div>
          <div className="text-3xl font-bold">{totalManagers}</div>
        </div>
        <div className="bg-sky-600 text-white p-6 rounded-lg shadow">
          <div className="text-sm opacity-80">HR Staff</div>
          <div className="text-3xl font-bold">{totalHr}</div>
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

  const renderLeaveApplications = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Leave Applications</h2>

      {leaveApplications.map((la) => (
        <div key={la.id} className="border bg-white shadow p-4 rounded flex justify-between">
          <div>
            <div>
              <strong>{la.employee_name}</strong> ({la.type})
            </div>
            <div>{la.start_date} - {la.end_date}</div>
            <div className="text-gray-600 text-sm">{la.reason}</div>
          </div>
          <div className="flex gap-2">
            {la.status === 'pending' ? (
              <>
                <button onClick={() => handleApproveLeave(la.id)} className="bg-green-600 text-white px-3 py-1 rounded">
                  Approve
                </button>
                <button onClick={() => handleRejectLeave(la.id)} className="bg-red-600 text-white px-3 py-1 rounded">
                  Reject
                </button>
              </>
            ) : (
              <span className="text-gray-500">{la.status.toUpperCase()}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

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
              className={`w-full text-left px-4 py-2 rounded ${
                activeTab === tab ? 'bg-slate-800' : 'hover:bg-slate-700'
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
        {activeTab === TABS.ANALYTICS && renderAnalytics()}  
        {activeTab === TABS.SETTINGS && renderSettings()}
      </main>
    </div>
  );
}

export default HrDashboard;
