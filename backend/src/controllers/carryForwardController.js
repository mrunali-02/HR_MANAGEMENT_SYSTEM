import db from '../db/db.js';
import { logAudit, createNotification } from '../utils/audit.js';

/**
 * Preview carry forward data before confirmation
 * Shows remaining leaves for each employee from previous year
 */
export async function previewCarryForward(req, res) {
    try {
        const { fromYear, toYear } = req.query;

        if (!fromYear || !toYear) {
            return res.status(400).json({ error: 'fromYear and toYear are required' });
        }

        const from = parseInt(fromYear, 10);
        const to = parseInt(toYear, 10);

        if (to !== from + 1) {
            return res.status(400).json({ error: 'toYear must be fromYear + 1' });
        }

        // Get all active employees
        const [employees] = await db.execute(
            'SELECT id, name, email FROM employees WHERE status = "active" AND role != "admin" ORDER BY name ASC'
        );

        // Get leave policies for fallback
        const [policies] = await db.execute('SELECT type, total_days FROM leave_policies');
        const policyDefaults = {};
        policies.forEach(p => { policyDefaults[p.type] = p.total_days; });

        const previewData = [];

        for (const employee of employees) {
            // Try fetching stored balances
            const [balances] = await db.execute(
                'SELECT leave_type, remaining_days FROM leave_balances WHERE user_id = ? AND year = ?',
                [employee.id, from]
            );

            const balanceMap = { sick: 0, casual: 0, paid: 0 };

            if (balances.length > 0) {
                // Use stored records
                balances.forEach(b => {
                    if (balanceMap[b.leave_type] !== undefined) {
                        balanceMap[b.leave_type] = b.remaining_days;
                    }
                });
            } else {
                // Fallback: Calculate from policies and approved requests
                balanceMap.sick = policyDefaults.sick || 0;
                balanceMap.casual = policyDefaults.casual || 0;
                balanceMap.paid = policyDefaults.paid || 0;

                const [usedRows] = await db.execute(
                    `SELECT type, COALESCE(SUM(DATEDIFF(end_date, start_date) + 1), 0) AS days
                     FROM leave_requests
                     WHERE user_id = ? AND status = 'approved' AND (YEAR(start_date) = ? OR YEAR(end_date) = ?)
                     GROUP BY type`,
                    [employee.id, from, from]
                );

                usedRows.forEach(row => {
                    if (balanceMap[row.type] !== undefined) {
                        balanceMap[row.type] = Math.max(0, balanceMap[row.type] - row.days);
                    }
                });
            }

            previewData.push({
                employee_id: employee.id,
                employee_name: employee.name,
                employee_email: employee.email,
                remaining: {
                    sick: balanceMap.sick,
                    casual: balanceMap.casual,
                    planned: balanceMap.paid
                },
                carried: {
                    sick: balanceMap.sick,
                    casual: balanceMap.casual,
                    planned: balanceMap.paid
                }
            });
        }

        res.json({
            fromYear: from,
            toYear: to,
            employeeCount: previewData.length,
            data: previewData
        });

    } catch (error) {
        console.error('Preview carry forward error:', error);
        res.status(500).json({ error: 'Failed to preview carry forward' });
    }
}

/**
 * Confirm and execute carry forward operation
 * Creates leave balance records for new year with carried forward amounts
 */
export async function confirmCarryForward(req, res) {
    try {
        const { fromYear, toYear, overrides } = req.body;

        if (!fromYear || !toYear) {
            return res.status(400).json({ error: 'fromYear and toYear are required' });
        }

        const from = parseInt(fromYear, 10);
        const to = parseInt(toYear, 10);

        // Check if carry forward already done
        const [existing] = await db.execute(
            'SELECT COUNT(*) as count FROM leave_balances WHERE year = ? AND carried_forward > 0',
            [to]
        );

        if (existing[0].count > 0) {
            return res.status(400).json({
                error: `Carry forward already completed for year ${to}`,
                existingCount: existing[0].count,
                message: 'Use manual override to edit individual records if needed'
            });
        }

        // Get all active employees
        const [employees] = await db.execute(
            'SELECT id, name FROM employees WHERE status = "active" AND role != "admin"'
        );

        // Get leave policies
        const [policies] = await db.execute('SELECT type, total_days FROM leave_policies');
        const policyMap = {};
        policies.forEach(p => {
            policyMap[p.type] = p.total_days;
        });

        const overrideMap = {};
        if (overrides && Array.isArray(overrides)) {
            overrides.forEach(o => {
                overrideMap[o.employee_id] = {
                    sick: o.sick,
                    casual: o.casual,
                    planned: o.planned
                };
            });
        }

        let processedCount = 0;

        for (const employee of employees) {
            // Fetch remaining leaves for 'from' year
            const [balances] = await db.execute(
                'SELECT leave_type, remaining_days FROM leave_balances WHERE user_id = ? AND year = ?',
                [employee.id, from]
            );

            const remainingMap = { sick: 0, casual: 0, paid: 0 };

            if (balances.length > 0) {
                balances.forEach(b => {
                    if (remainingMap[b.leave_type] !== undefined) {
                        remainingMap[b.leave_type] = b.remaining_days;
                    }
                });
            } else {
                // Fallback: Default policies minus usage
                remainingMap.sick = policyMap.sick || 0;
                remainingMap.casual = policyMap.casual || 0;
                remainingMap.paid = policyMap.paid || 0;

                const [usedRows] = await db.execute(
                    `SELECT type, COALESCE(SUM(DATEDIFF(end_date, start_date) + 1), 0) AS days
                     FROM leave_requests
                     WHERE user_id = ? AND status = 'approved' AND (YEAR(start_date) = ? OR YEAR(end_date) = ?)
                     GROUP BY type`,
                    [employee.id, from, from]
                );

                usedRows.forEach(row => {
                    if (remainingMap[row.type] !== undefined) {
                        remainingMap[row.type] = Math.max(0, remainingMap[row.type] - row.days);
                    }
                });
            }

            // Calculate carried amounts (with overrides)
            const carried = {
                sick: parseInt(overrideMap[employee.id]?.sick ?? remainingMap.sick) || 0,
                casual: parseInt(overrideMap[employee.id]?.casual ?? remainingMap.casual) || 0,
                paid: parseInt(overrideMap[employee.id]?.planned ?? remainingMap.paid) || 0 // Mapping UI 'planned' to DB 'paid'
            };

            console.log(`[CarryForward] ${employee.name} (ID: ${employee.id}): Sick=${carried.sick}, Casual=${carried.casual}, Paid=${carried.paid}`);

            // Process each policy for next year
            for (const policy of policies) {
                const leaveType = policy.type;
                const baseDays = policyMap[leaveType] || 0;
                let carriedAmount = 0;

                // Added logic: only add to same leave type
                if (leaveType === 'sick') carriedAmount = carried.sick;
                else if (leaveType === 'casual') carriedAmount = carried.casual;
                else if (leaveType === 'paid') carriedAmount = carried.paid;

                const totalDays = baseDays + carriedAmount;

                await db.execute(`
                    INSERT INTO leave_balances 
                    (user_id, leave_type, total_days, used_days, remaining_days, year, carried_forward)
                    VALUES (?, ?, ?, 0, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                      total_days = VALUES(total_days),
                      remaining_days = VALUES(remaining_days),
                      carried_forward = VALUES(carried_forward)
                `, [employee.id, leaveType, totalDays, totalDays, to, carriedAmount]);
            }

            processedCount++;

            // Notification
            const totalCarried = carried.sick + carried.casual + carried.paid;
            if (totalCarried > 0) {
                await createNotification(
                    employee.id,
                    `Leaves carried forward to ${to}: Sick(${carried.sick}), Casual(${carried.casual}), Planned(${carried.paid}).`
                );
            }
        }

        // Log audit
        await logAudit(req.user.id, 'leave_carry_forward_completed', {
            from_year: from,
            to_year: to,
            employees_processed: processedCount,
            admin_id: req.user.id
        });

        res.json({
            message: 'Carry forward completed successfully',
            fromYear: from,
            toYear: to,
            employeesProcessed: processedCount
        });

    } catch (error) {
        console.error('Confirm carry forward error:', error);
        res.status(500).json({ error: 'Failed to complete carry forward' });
    }
}

/**
 * Get carry forward status for a specific year pair
 */
export async function getCarryForwardStatus(req, res) {
    try {
        const { fromYear, toYear } = req.query;

        if (!toYear) {
            return res.status(400).json({ error: 'toYear is required' });
        }

        const to = parseInt(toYear, 10);

        const [records] = await db.execute(`
      SELECT COUNT(*) as count, 
             SUM(carried_forward) as total_carried,
             MAX(updated_at) as last_updated
      FROM leave_balances 
      WHERE year = ? AND carried_forward > 0
    `, [to]);

        const completed = records[0].count > 0;

        res.json({
            completed,
            year: to,
            employeeCount: records[0].count || 0,
            totalCarriedDays: records[0].total_carried || 0,
            lastUpdated: records[0].last_updated || null
        });

    } catch (error) {
        console.error('Get carry forward status error:', error);
        res.status(500).json({ error: 'Failed to get carry forward status' });
    }
}

/**
 * Update carry forward amount for a specific employee (Admin override)
 */
export async function updateEmployeeCarryForward(req, res) {
    try {
        const { id } = req.params;
        const { year, amount } = req.body;

        if (!year || amount === undefined) {
            return res.status(400).json({ error: 'year and amount are required' });
        }

        const employeeId = parseInt(id, 10);
        const targetYear = parseInt(year, 10);
        const carriedAmount = Math.max(0, parseInt(amount, 10));

        // Get current leave policy for paid leave
        const [policies] = await db.execute(
            'SELECT total_days FROM leave_policies WHERE type = "paid"'
        );
        const basePaidLeaves = policies[0]?.total_days || 12;

        // Update the leave balance record
        const totalDays = basePaidLeaves + carriedAmount;

        await db.execute(`
      UPDATE leave_balances 
      SET carried_forward = ?,
          total_days = ?,
          remaining_days = total_days - used_days
      WHERE user_id = ? AND leave_type = 'paid' AND year = ?
    `, [carriedAmount, totalDays, employeeId, targetYear]);

        // Log audit
        await logAudit(req.user.id, 'leave_carry_forward_manual_update', {
            employee_id: employeeId,
            year: targetYear,
            new_amount: carriedAmount,
            admin_id: req.user.id
        });

        res.json({
            message: 'Carry forward updated successfully',
            employeeId,
            year: targetYear,
            carriedForward: carriedAmount,
            totalPlannedLeaves: totalDays
        });

    } catch (error) {
        console.error('Update employee carry forward error:', error);
        res.status(500).json({ error: 'Failed to update carry forward' });
    }
}
