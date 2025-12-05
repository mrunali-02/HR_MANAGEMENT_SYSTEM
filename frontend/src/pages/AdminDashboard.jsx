import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './AdminDashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const TABS = {
  DASHBOARD: 'dashboard',
  EMPLOYEES: 'employees',
  LEAVE_APPLICATIONS: 'leaveApplications',
  REPORTS: 'reports',
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

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin/login');
      return;
    }
    Promise.all([fetchUsers(), fetchLeaveApplications()]).finally(() => {
      setLoading(false);
    });
  }, [user, navigate]);

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
      setSuccess('Leave request approved successfully!');
      setError('');
      fetchLeaveApplications();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve leave request');
      setSuccess('');
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
      setSuccess('Leave request rejected successfully!');
      setError('');
      fetchLeaveApplications();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject leave request');
      setSuccess('');
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
        setSuccess('Employee updated successfully!');
      } else {
        // Create new employee
        await axios.post(`${API_BASE_URL}/admin/employees`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setSuccess('Employee added successfully!');
      }

      resetForm();
      setShowAddForm(false);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add employee');
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
      setSuccess('User deleted successfully!');
      setError('');
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
      setSuccess('');
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
    setError('');
    setSuccess('');
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
              // closing create form
              setShowAddForm(false);
              resetForm();
            } else {
              // open as create form
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

      {error && (
        <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-2">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded mb-2">
          {success}
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
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  disabled={!!selectedEmployee}
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
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
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
      
      {error && (
        <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-2">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded mb-2">
          {success}
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

  const renderReports = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Reports & Charts</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2">Employees by Role</h3>
          <p className="text-sm text-gray-500 mb-4">
            Simple distribution of employees across different roles.
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Employees</span>
              <span className="font-semibold">{totalEmployees}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Managers</span>
              <span className="font-semibold">{totalManagers}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>HR</span>
              <span className="font-semibold">{totalHr}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Admins</span>
              <span className="font-semibold">{totalAdmins}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2">Activity Summary</h3>
          <p className="text-sm text-gray-500 mb-4">
            Placeholder for more advanced charts (e.g., attendance, leaves). You can integrate a
            chart library like Recharts or Chart.js here.
          </p>
          <div className="h-40 flex items-center justify-center bg-gray-50 rounded-lg text-gray-400 text-sm">
            Charts area (to be implemented)
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Admin Profile</h3>
          <div className="space-y-1 text-sm text-gray-700">
            <p>
              <span className="font-medium">Name:</span> {user?.name || 'Not set'}
            </p>
            <p>
              <span className="font-medium">Email:</span> {user?.email}
            </p>
            <p>
              <span className="font-medium">Role:</span> {user?.role}
            </p>
          </div>
        </div>
        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold mb-2">Account Settings</h3>
          <p className="text-sm text-gray-500 mb-3">
            This section can be extended to allow changing password, email, and other
            configuration options.
          </p>
          <button
            type="button"
            className="px-4 py-2 rounded-md bg-gray-100 text-sm text-gray-600 cursor-not-allowed"
          >
            Manage Settings (Coming Soon)
          </button>
        </div>
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
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${
              activeTab === TABS.DASHBOARD
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab(TABS.EMPLOYEES)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${
              activeTab === TABS.EMPLOYEES
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Employee List
          </button>
          <button
            onClick={() => setActiveTab(TABS.LEAVE_APPLICATIONS)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${
              activeTab === TABS.LEAVE_APPLICATIONS
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Leave Applications
          </button>
          <button
            onClick={() => setActiveTab(TABS.REPORTS)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${
              activeTab === TABS.REPORTS
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Reports
          </button>
          <button
            onClick={() => setActiveTab(TABS.SETTINGS)}
            className={`w-full text-left px-5 py-2.5 text-sm font-medium transition ${
              activeTab === TABS.SETTINGS
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
          {activeTab === TABS.REPORTS && renderReports()}
          {activeTab === TABS.SETTINGS && renderSettings()}
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;

