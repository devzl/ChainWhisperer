const { Pool } = require('pg');

// Initialize the PostgreSQL client
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Use connection string
    ssl: {
        rejectUnauthorized: false, // For hosted databases like Render or Heroku
    },
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};
