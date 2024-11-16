const { Pool } = require('pg');

// Initialize the PostgreSQL client
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Use connection string
    ssl: {
        rejectUnauthorized: false, // For hosted databases like Render or Heroku
    },
});



const resetWalletsTable = async () => {
    const dropAndCreateQuery = `
        DROP TABLE IF EXISTS wallets;

        CREATE TABLE wallets (
            chat_id BIGINT PRIMARY KEY,
            smart_account_address TEXT NOT NULL,
            private_key TEXT NOT NULL,
            chain_id INT NOT NULL
        );
    `;

    try {
        await pool.query(dropAndCreateQuery);
        console.log('Table `wallets` has been dropped and recreated successfully.');
    } catch (error) {
        console.error('Error resetting the `wallets` table:', error);
        throw error;
    }
};

// Call the reset function immediately
resetWalletsTable()
    .then(() => console.log('Table reset completed successfully.'))
    .catch((err) => console.error('Error resetting table:', err));


module.exports = {
    query: (text, params) => pool.query(text, params),
};