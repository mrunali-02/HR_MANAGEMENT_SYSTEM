import db from '../db/db.js';

export const getSettings = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT category, value FROM settings');

        // Convert array of {category, value} to a single object
        const settings = rows.reduce((acc, row) => {
            acc[row.category] = row.value;
            return acc;
        }, {});

        res.json({ settings });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};

export const updateSettings = async (req, res) => {
    const { category } = req.params;
    const { value } = req.body;

    if (!category || !value) {
        return res.status(400).json({ error: 'Category and value are required' });
    }

    try {
        // Upsert the setting (INSERT ... ON DUPLICATE KEY UPDATE)
        await db.query(
            `INSERT INTO settings (category, value) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
            [category, JSON.stringify(value)]
        );

        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error(`Error updating settings for ${category}:`, error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
};
