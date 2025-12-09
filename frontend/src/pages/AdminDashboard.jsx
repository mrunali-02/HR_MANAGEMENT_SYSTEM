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
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const TABS = {
  DASHBOARD: 'dashboard',
  EMPLOYEES: 'employees',
  LEAVE_APPLICATIONS: 'leaveApplications',
  REPORTS: 'reports',
  AUDIT_LOGS: 'auditLogs',
  SETTINGS: 'settings',
};

function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
  const [users, setUsers] = useState([]);
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);

  // Tab-specific error and success messages
  const [tabErrors, setTabErrors] = useState({});
  const [tabSuccess, setTabSuccess] = useState({});

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [formData, setFormData] = useState({
    employee_id: '',
    name: '',
    email: '',
    password: '',
    role: 'employee',
    department: '',
    phone: '',
    joined_on: '',
    address: '',
    contact_number: '',
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

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin/login');
      return;
    }
    Promise.all([fetchUsers(), fetchLeaveApplications()]).finally(() => {
      setLoading(false);
    });
  }, [user, navigate]);

  useEffect(() => {
    if (activeTab === TABS.AUDIT_LOGS) {
      fetchAuditLogs();
    }
  }, [activeTab]);

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
    } catch (err) {
      console.error('Error fetching leave requests:', err);
      setLeaveApplications([]);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/admin/audit-logs`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setAuditLogs(response.data.logs || []);
      setAuditTotal(response.data.total || 0);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setAuditLogs([]);
      setAuditTotal(0);
      setTabErrors((prev) => ({ ...prev, [TABS.AUDIT_LOGS]: err.response?.data?.error || 'Failed to fetch audit logs' }));
    }
  };

  const handleApproveLeave = async (leaveId) => {
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
    } catch (err) {
      setTabErrors({ [TABS.LEAVE_APPLICATIONS]: err.response?.data?.error || 'Failed to approve leave request' });
      setTimeout(() => setTabErrors(prev => {
        const newState = { ...prev };
        delete newState[TABS.LEAVE_APPLICATIONS];
        return newState;
      }), 5000);
    }
  };

  const handleRejectLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to reject this leave request?')) {
      return;
    }

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
    } catch (err) {
      setTabErrors({ [TABS.LEAVE_APPLICATIONS]: err.response?.data?.error || 'Failed to reject leave request' });
      setTimeout(() => setTabErrors(prev => {
        const newState = { ...prev };
        delete newState[TABS.LEAVE_APPLICATIONS];
        return newState;
      }), 5000);
    }
  };

  const resetForm = () => {
    setFormData({
      employee_id: '',
      name: '',
      email: '',
      password: '',
      role: 'employee',
      department: '',
      phone: '',
      joined_on: '',
      address: '',
      contact_number: '',
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
            name: formData.name,
            role: formData.role,
            department: formData.department || null,
            phone: formData.phone || null,
            joined_on: formData.joined_on || null,
            address: formData.address || null,
            contact_number: formData.contact_number || null,
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

  const generateEmployeeId = (role) => {
    const prefixMap = { employee: 'emp', manager: 'man', hr: 'hr' };
    const prefix = prefixMap[role] || 'emp';
    const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');

    const maxNumber = users.reduce((max, u) => {
      if (!u.employee_id) return max;
      const match = u.employee_id.match(regex);
      if (!match) return max;
      const parsed = parseInt(match[1], 10);
      if (Number.isNaN(parsed)) return max;
      return Math.max(max, parsed);
    }, 0);

    const nextNumber = maxNumber + 1;
    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Dashboard Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl p-5 shadow-lg">
          <div className="text-sm uppercase tracking-wide opacity-80">Total Employees</div>
          <div className="mt-2 text-3xl font-bold">{totalEmployees}</div>
        </div>
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl p-5 shadow-lg">
          <div className="text-sm uppercase tracking-wide opacity-80">Managers</div>
          <div className="mt-2 text-3xl font-bold">{totalManagers}</div>
        </div>
        <div className="bg-gradient-to-r from-sky-500 to-sky-600 text-white rounded-xl p-5 shadow-lg">
          <div className="text-sm uppercase tracking-wide opacity-80">HR</div>
          <div className="mt-2 text-3xl font-bold">{totalHr}</div>
        </div>
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl p-5 shadow-lg">
          <div className="text-sm uppercase tracking-wide opacity-80">Admins</div>
          <div className="mt-2 text-3xl font-bold">{totalAdmins}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Recent Employees</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.slice(0, 5).map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                    {u.name || u.email}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {u.role}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    className="px-4 py-4 text-center text-sm text-gray-500"
                    colSpan={4}
                  >
                    No employees yet. Use the Employee List tab to add employees.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const handleEditClick = (employee) => {
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
      name: employee.name || '',
      email: employee.email,
      password: '',
      role: employee.role || 'employee',
      department: employee.department || '',
      phone: employee.phone || '',
      joined_on: employee.joined_on ? employee.joined_on.substring(0, 10) : '',
      address: employee.address || '',
      contact_number: employee.contact_number || '',
    });
  };

  const renderEmployeeList = () => (
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
              setShowAddForm(true);
            }
          }}
          className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-700 focus:outline-none"
        >
          {showAddForm ? 'Cancel' : 'Add Employee'}
        </button>
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
          <form onSubmit={handleAddOrUpdateEmployee}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                <input
                  type="text"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
                  value={formData.employee_id}
                  readOnly
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  required={!selectedEmployee}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!selectedEmployee}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  required={!selectedEmployee}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={selectedEmployee ? 'Leave blank to keep current password' : ''}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      role: e.target.value,
                      employee_id: selectedEmployee ? prev.employee_id : generateEmployeeId(e.target.value),
                    }))
                  }
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="hr">HR</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Department</label>
                <input
                  type="text"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="text"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <textarea
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contact Number</label>
                <input
                  type="text"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.contact_number}
                  onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                />
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
                  Department
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined On
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact Number
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
              {users.map((u) => (
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
                    {u.department || '-'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {u.phone || '-'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {u.joined_on ? new Date(u.joined_on).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {u.contact_number || '-'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
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
              {users.length === 0 && (
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
      </div>
    </div>
  );

  const renderLeaveApplications = () => (
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
              {leaveApplications.map((la) => (
                <tr key={la.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                    {la.employee_name || la.employee_email}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {la.type}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {la.start_date} → {la.end_date}
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
                          : 'bg-yellow-100 text-yellow-800'
                        }`}
                    >
                      {la.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-right text-sm">
                    {la.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApproveLeave(la.id)}
                          className="inline-flex items-center px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectLeave(la.id)}
                          className="inline-flex items-center px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {la.status !== 'pending' && (
                      <span className="text-xs text-gray-400">No actions available</span>
                    )}
                  </td>
                </tr>
              ))}
              {leaveApplications.length === 0 && (
                <tr>
                  <td
                    className="px-4 py-4 text-center text-sm text-gray-500"
                    colSpan={6}
                  >
                    No leave applications to display yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

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

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metadata</th>
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
    </div>
  );

  const renderReports = () => {
    // employees by role
    const employeeCount = users.filter((u) => u.role === 'employee').length;
    const managerCount = totalManagers;
    const hrCount = totalHr;
    const adminCount = totalAdmins;

    const roleData = [
      { name: 'Employee', value: employeeCount },
      { name: 'Manager', value: managerCount },
      { name: 'HR', value: hrCount },
      { name: 'Admin', value: adminCount },
    ].filter((item) => item.value > 0);

    // leaves by status
    const pendingLeaves = leaveApplications.filter((la) => la.status === 'pending').length;
    const approvedLeaves = leaveApplications.filter((la) => la.status === 'approved').length;
    const rejectedLeaves = leaveApplications.filter((la) => la.status === 'rejected').length;

    const leaveStatusData = [
      { name: 'Pending', value: pendingLeaves },
      { name: 'Approved', value: approvedLeaves },
      { name: 'Rejected', value: rejectedLeaves },
    ];

    const PIE_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444']; // blue, green, yellow, red
    const BAR_COLORS = ['#22c55e', '#3b82f6', '#ef4444']; // green, blue, red

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Reports & Charts</h2>

        {/* Summary stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-bold text-gray-900">{totalEmployees}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Employees</p>
            <p className="text-2xl font-bold text-gray-900">{employeeCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Managers</p>
            <p className="text-2xl font-bold text-gray-900">{managerCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">HR & Admin</p>
            <p className="text-2xl font-bold text-gray-900">{hrCount + adminCount}</p>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie chart - employees by role */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-2">Employees by Role</h3>
            <p className="text-sm text-gray-500 mb-4">
              Distribution of users across different roles.
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    label
                  >
                    {roleData.map((entry, index) => (
                      <Cell
                        key={`role-cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar chart - leaves by status */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-2">Leave Requests by Status</h3>
            <p className="text-sm text-gray-500 mb-4">
              Overview of all leave applications handled by the system.
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leaveStatusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value">
                    {leaveStatusData.map((entry, index) => (
                      <Cell
                        key={`leave-cell-${index}`}
                        fill={BAR_COLORS[index % BAR_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ✅ Settings renderer now pure (no hooks)
  const renderSettings = () => (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900">Account Settings</h2>

      {/* Profile Update */}
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Profile Details</h3>

        <input
          type="text"
          className="w-full border rounded p-2"
          value={profileInfo.name}
          onChange={(e) => setProfileInfo({ ...profileInfo, name: e.target.value })}
          placeholder="Your Name"
        />

        <input
          type="email"
          className="w-full border rounded p-2"
          value={profileInfo.email}
          onChange={(e) => setProfileInfo({ ...profileInfo, email: e.target.value })}
          placeholder="Your Email"
        />

        <button
          onClick={async () => {
            try {
              const token = localStorage.getItem('token');
              await axios.put(
                `${API_BASE_URL}/admin/profile/update`,
                profileInfo,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              alert('Profile updated!');
            } catch (err) {
              alert(err.response?.data?.error || 'Failed to update');
            }
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded"
        >
          Save Profile
        </button>
      </div>

      {/* Password Change */}
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>

        <input
          type="password"
          className="w-full border rounded p-2"
          placeholder="Current Password"
          value={passwordData.currentPassword}
          onChange={(e) =>
            setPasswordData({ ...passwordData, currentPassword: e.target.value })
          }
        />

        <input
          type="password"
          className="w-full border rounded p-2"
          placeholder="New Password"
          value={passwordData.newPassword}
          onChange={(e) =>
            setPasswordData({ ...passwordData, newPassword: e.target.value })
          }
        />

        <button
          onClick={async () => {
            if (!passwordData.currentPassword || !passwordData.newPassword) {
              return alert('Fill both fields');
            }
            try {
              const token = localStorage.getItem('token');
              await axios.put(
                `${API_BASE_URL}/admin/profile/change-password`,
                passwordData,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              alert('Password updated');
              setPasswordData({ currentPassword: '', newPassword: '' });
            } catch (err) {
              alert(err.response?.data?.error || 'Failed to change password');
            }
          }}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Update Password
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg font-medium text-gray-700">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col shadow-xl">
        <div className="h-16 flex items-center justify-center border-b border-slate-800">
          <span className="text-lg font-semibold tracking-wide">HRMS Admin</span>
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
            onClick={() => setActiveTab(TABS.EMPLOYEES)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === TABS.EMPLOYEES
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            Employee List
          </button>
          <button
            onClick={() => setActiveTab(TABS.LEAVE_APPLICATIONS)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === TABS.LEAVE_APPLICATIONS
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            Leave Applications
          </button>
          <button
            onClick={() => setActiveTab(TABS.AUDIT_LOGS)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === TABS.AUDIT_LOGS
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            Audit Logs
          </button>
          <button
            onClick={() => setActiveTab(TABS.REPORTS)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === TABS.REPORTS
              ? 'bg-slate-800 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            Reports
          </button>
          <button
            onClick={() => setActiveTab(TABS.SETTINGS)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${activeTab === TABS.SETTINGS
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

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {activeTab === TABS.DASHBOARD && 'Dashboard'}
              {activeTab === TABS.EMPLOYEES && 'Employee Management'}
              {activeTab === TABS.LEAVE_APPLICATIONS && 'Leave Applications'}
              {activeTab === TABS.AUDIT_LOGS && 'Audit Logs'}
              {activeTab === TABS.REPORTS && 'Reports'}
              {activeTab === TABS.SETTINGS && 'Settings'}
            </h1>
            <p className="text-xs text-gray-500">
              Signed in as {user?.name || user?.email} ({user?.role})
            </p>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 p-6 overflow-y-auto">
          {activeTab === TABS.DASHBOARD && renderDashboard()}
          {activeTab === TABS.EMPLOYEES && renderEmployeeList()}
          {activeTab === TABS.LEAVE_APPLICATIONS && renderLeaveApplications()}
          {activeTab === TABS.AUDIT_LOGS && renderAuditLogs()}
          {activeTab === TABS.REPORTS && renderReports()}
          {activeTab === TABS.SETTINGS && renderSettings()}
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
