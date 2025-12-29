import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

function LeaveCarryForward() {
    const currentYear = new Date().getFullYear();

    const [fromYear, setFromYear] = useState(currentYear - 1);
    const [toYear, setToYear] = useState(currentYear);
    const [previewData, setPreviewData] = useState([]);
    const [showPreview, setShowPreview] = useState(false);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [editValues, setEditValues] = useState({}); // { empId: { sick, casual, planned } }

    useEffect(() => {
        checkStatus();
    }, [toYear]);

    const checkStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${API_BASE_URL}/admin/leave-carry-forward/status`,
                {
                    params: { fromYear, toYear },
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setStatus(response.data);
        } catch (err) {
            console.error('Error checking status:', err);
        }
    };

    const handlePreview = async () => {
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${API_BASE_URL}/admin/leave-carry-forward/preview`,
                {
                    params: { fromYear, toYear },
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            setPreviewData(response.data.data || []);
            setShowPreview(true);

            // Initialize edit values with full objects
            const initialEditValues = {};
            response.data.data.forEach(emp => {
                initialEditValues[emp.employee_id] = { ...emp.carried };
            });
            setEditValues(initialEditValues);

        } catch (err) {
            console.error('Error loading preview:', err);
            setError(err.response?.data?.error || 'Failed to load preview');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!window.confirm(
            `This will carry forward leaves from ${fromYear} to ${toYear} for all employees. This operation cannot be easily undone. Continue?`
        )) {
            return;
        }

        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const token = localStorage.getItem('token');

            // Map editValues to API structure
            const overrides = Object.entries(editValues).map(([empId, values]) => ({
                employee_id: parseInt(empId),
                sick: parseInt(values.sick) || 0,
                casual: parseInt(values.casual) || 0,
                planned: parseInt(values.planned) || 0
            }));

            await axios.post(
                `${API_BASE_URL}/admin/leave-carry-forward/confirm`,
                { fromYear, toYear, overrides },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setSuccess('Carry forward completed successfully!');
            setShowPreview(false);
            checkStatus();
        } catch (err) {
            console.error('Error confirming carry forward:', err);
            setError(err.response?.data?.error || 'Failed to complete carry forward');
        } finally {
            setLoading(false);
        }
    };

    const handleEditChange = (employeeId, field, value) => {
        setEditValues(prev => ({
            ...prev,
            [employeeId]: {
                ...prev[employeeId],
                [field]: Math.max(0, parseInt(value) || 0)
            }
        }));
    };

    const yearOptions = [];
    for (let y = currentYear - 5; y <= currentYear + 5; y++) {
        yearOptions.push(y);
    }

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Leave Carry Forward</h2>
                <p className="text-sm text-gray-500">
                    Carry forward unused leaves (Sick, Casual, Planned) from one year to the next.
                </p>
            </header>

            {/* Status Banner */}
            {status && status.completed && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
                    <p className="font-semibold">Completed for {toYear}</p>
                    <p className="text-sm">Processed {status.employeeCount} employees.</p>
                </div>
            )}

            {/* Messages */}
            {error && <div className="p-3 bg-red-100 text-red-700 rounded-md border border-red-200">{error}</div>}
            {success && <div className="p-3 bg-green-100 text-green-700 rounded-md border border-green-200">{success}</div>}

            {/* Year Selection */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex flex-wrap gap-6 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">From Year</label>
                        <select
                            value={fromYear}
                            onChange={(e) => {
                                const y = parseInt(e.target.value);
                                setFromYear(y);
                                setToYear(y + 1);
                                setShowPreview(false);
                            }}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">To Year</label>
                        <select
                            value={toYear}
                            onChange={(e) => setToYear(parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <button
                        onClick={handlePreview}
                        disabled={loading || toYear !== fromYear + 1}
                        className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition drop-shadow-sm"
                    >
                        {loading ? 'Processing...' : 'Preview Data'}
                    </button>
                </div>
            </div>

            {/* Preview Table */}
            {showPreview && previewData.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h3 className="font-bold text-gray-800">Preview: {fromYear} → {toYear}</h3>
                        <button
                            onClick={() => setEditMode(!editMode)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${editMode ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'}`}
                        >
                            {editMode ? '✓ Done Editing' : '✎ Edit Balances'}
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th rowSpan="2" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Employee</th>
                                    <th colSpan="2" className="px-4 py-2 text-center text-xs font-bold text-red-500 uppercase border-l border-gray-200">Sick</th>
                                    <th colSpan="2" className="px-4 py-2 text-center text-xs font-bold text-orange-500 uppercase border-l border-gray-200">Casual</th>
                                    <th colSpan="2" className="px-4 py-2 text-center text-xs font-bold text-green-500 uppercase border-l border-r border-gray-200">Planned</th>
                                    <th rowSpan="2" className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Total</th>
                                </tr>
                                <tr className="bg-gray-50 border-t border-gray-100">
                                    <th className="px-2 py-2 text-[10px] text-gray-400 uppercase border-l border-gray-200">Left</th>
                                    <th className="px-2 py-2 text-[10px] text-gray-400 uppercase">Carry</th>
                                    <th className="px-2 py-2 text-[10px] text-gray-400 uppercase border-l border-gray-200">Left</th>
                                    <th className="px-2 py-2 text-[10px] text-gray-400 uppercase">Carry</th>
                                    <th className="px-2 py-2 text-[10px] text-gray-400 uppercase border-l border-gray-200">Left</th>
                                    <th className="px-2 py-2 text-[10px] text-gray-400 uppercase">Carry</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {previewData.map((emp) => {
                                    const edits = editValues[emp.employee_id] || { sick: 0, casual: 0, planned: 0 };
                                    const totalCarried = edits.sick + edits.casual + edits.planned;

                                    const renderInput = (field) => (
                                        editMode ? (
                                            <input
                                                type="number"
                                                min="0"
                                                value={edits[field]}
                                                onChange={(e) => handleEditChange(emp.employee_id, field, e.target.value)}
                                                className="w-12 px-1 py-1 border border-gray-200 rounded text-center text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                            />
                                        ) : (
                                            <span className="font-bold text-gray-900">{edits[field]}</span>
                                        )
                                    );

                                    return (
                                        <tr key={emp.employee_id} className="hover:bg-gray-50/50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-gray-900">{emp.employee_name}</div>
                                                <div className="text-xs text-gray-400">{emp.employee_email}</div>
                                            </td>

                                            <td className="px-2 py-4 text-center bg-red-50/30 border-l border-gray-100">{emp.remaining.sick}</td>
                                            <td className="px-2 py-4 text-center bg-red-50/30">{renderInput('sick')}</td>

                                            <td className="px-2 py-4 text-center bg-orange-50/30 border-l border-gray-100">{emp.remaining.casual}</td>
                                            <td className="px-2 py-4 text-center bg-orange-50/30">{renderInput('casual')}</td>

                                            <td className="px-2 py-4 text-center bg-green-50/30 border-l border-gray-100">{emp.remaining.planned}</td>
                                            <td className="px-2 py-4 text-center bg-green-50/30 border-r border-gray-100">{renderInput('planned')}</td>

                                            <td className="px-6 py-4 text-center font-black text-blue-600 bg-blue-50/20">{totalCarried}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                        <button onClick={() => setShowPreview(false)} className="px-6 py-2 text-gray-500 font-bold hover:text-gray-700">Cancel</button>
                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className="px-8 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-md transition"
                        >
                            {loading ? 'Processing...' : 'Confirm Carry Forward'}
                        </button>
                    </div>
                </div>
            )}
            {showPreview && previewData.length === 0 && !loading && (
                <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">
                    <p>No active employees found for carry forward.</p>
                </div>
            )}
        </div>
    );
}

export default LeaveCarryForward;
