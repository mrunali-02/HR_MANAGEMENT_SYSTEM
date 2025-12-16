import db from './src/db/db.js';

async function addDocumentUrlColumn() {
    try {
        console.log('Attempting to add document_url column to leave_requests...');
        await db.execute('ALTER TABLE leave_requests ADD COLUMN document_url VARCHAR(255) NULL AFTER reason');
        console.log('Successfully added document_url column.');
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('Column document_url already exists.');
        } else {
            console.error('Error adding column:', error);
        }
    } finally {
        process.exit();
    }
}

addDocumentUrlColumn();
