import db from '../db/db.js';

export async function getHolidays(req, res) {
    try {
        const [holidays] = await db.execute('SELECT * FROM holidays ORDER BY holiday_date ASC');
        res.json({ holidays });
    } catch (error) {
        console.error('Get holidays error:', error);
        res.status(500).json({ error: 'Failed to fetch holidays' });
    }
}

export async function addHoliday(req, res) {
    try {
        const { date, name, type } = req.body;
        const userId = req.user.id; // Admin or HR

        if (!date || !name) {
            return res.status(400).json({ error: 'Date and name are required' });
        }

        await db.execute(
            'INSERT INTO holidays (date, name, type, created_by) VALUES (?, ?, ?, ?)',
            [date, name, type || 'public', userId]
        );

        res.status(201).json({ message: 'Holiday added successfully' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Holiday already exists for this date' });
        }
        console.error('Add holiday error:', error);
        res.status(500).json({ error: 'Failed to add holiday' });
    }
}

export async function deleteHoliday(req, res) {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM holidays WHERE id = ?', [id]);
        res.json({ message: 'Holiday deleted successfully' });
    } catch (error) {
        console.error('Delete holiday error:', error);
        res.status(500).json({ error: 'Failed to delete holiday' });
    }
}
