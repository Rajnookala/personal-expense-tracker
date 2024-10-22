// database.js
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres', 
  host: 'localhost',
  database: 'expenses', 
  password: 'postgres', 
  port: 5432, 
});

// Function to create tables
const createTables = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        type VARCHAR(10) NOT NULL,
        category VARCHAR(50) NOT NULL,
        amount NUMERIC NOT NULL,
        date DATE NOT NULL,
        description TEXT
      );
    `);
    console.log("Tables created or already exist.");
  } catch (err) {
    console.error("Error creating tables:", err);
  } finally {
    client.release();
  }
};

// Call the function to create tables
createTables();
