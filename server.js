require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}
if (!fs.existsSync(path.join(__dirname, 'public/uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'public/uploads'), { recursive: true });
}

const db = require('./database');
const app = express();

// View engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', (filePath, options, callback) => {
  fs.readFile(filePath, 'utf8', (err, content) => {
    if (err) return callback(err);
    // Simple template replacement
    let rendered = content;
    for (const [key, value] of Object.entries(options)) {
      if (typeof value === 'string' || typeof value === 'number') {
        rendered = rendered.split(`{{${key}}}`).join(value);
      }
    }
    callback(null, rendered);
  });
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: './data' }),
  secret: process.env.SESSION_SECRET || 'akr_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Routes
const indexRouter = require('./routes/index');
const adminRouter = require('./routes/admin');
const voteRouter = require('./routes/vote');
const apiRouter = require('./routes/api');

app.use('/', indexRouter);
app.use('/admin', adminRouter);
app.use('/vote', voteRouter);
app.use('/api', apiRouter);

// Public results page
app.get('/results', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'results.html'));
});

// 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🏫 AKR Academy Voting System running at http://localhost:${PORT}`);
});