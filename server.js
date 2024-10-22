const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());

// Database setup
const pool = new Pool({
  user: 'postgres', // your PostgreSQL username
  host: 'localhost',
  database: 'expenses', // name of your database
  password: 'postgres', // replace with your PostgreSQL password
  port: 5432, // default PostgreSQL port
});

// Secret key for JWT
const JWT_SECRET = 'your_secret_key'; // Change this to a more secure key in production

// Middleware for verifying JWT
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];

  // Ensure the token has the "Bearer " prefix
  if (!token || !token.startsWith('Bearer ')) {
    return res.status(403).json({ message: 'No token provided or invalid format' });
  }

  const jwtToken = token.split(' ')[1]; // Remove "Bearer " from the token

  jwt.verify(jwtToken, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(500).json({ message: 'Failed to authenticate token' });
    req.userId = decoded.id; // Save the user ID for later use
    next();
  });
};

// User registration
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10); // Hash the password

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id`,
      [username, hashedPassword]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') { // Unique violation error
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// User login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT * FROM users WHERE username = $1`, [username]);
    const row = result.rows[0];

    if (!row || !bcrypt.compareSync(password, row.password)) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Generate a JWT token
    const token = jwt.sign({ id: row.id, username: row.username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token: `Bearer ${token}` }); // Return the token with "Bearer" prefix
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Get all transactions
app.get('/transactions', verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM transactions');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Add a transaction
app.post('/transactions', verifyToken, async (req, res) => {
  const { type, category, amount, date, description } = req.body;

  if (!type || !category || !amount || !date) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO transactions (type, category, amount, date, description) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [type, category, amount, date, description]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update a transaction
app.put('/transactions/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { type, category, amount, date, description } = req.body;

  if (!type || !category || !amount || !date) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE transactions SET type = $1, category = $2, amount = $3, date = $4, description = $5 WHERE id = $6`,
      [type, category, amount, date, description, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.json({ message: 'Transaction updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Delete a transaction
app.delete('/transactions/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const result = await client.query(`DELETE FROM transactions WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.json({ message: 'Transaction deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Get transaction summary
app.get('/summary', verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT type, SUM(amount) AS total FROM transactions GROUP BY type');
    const summary = {
      totalIncome: result.rows.find(row => row.type === 'income')?.total || 0,
      totalExpenses: result.rows.find(row => row.type === 'expense')?.total || 0,
      balance: (result.rows.find(row => row.type === 'income')?.total || 0) - (result.rows.find(row => row.type === 'expense')?.total || 0),
    };
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Start the server
app.listen(PORT, (err) => {
  if (err) {
    return console.error('Error starting server:', err);
  }
  console.log(`Server is running on http://localhost:${PORT}`);
});
