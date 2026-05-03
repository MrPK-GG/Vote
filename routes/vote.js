const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../database');
const { requireVoteSession } = require('../middleware/auth');

router.get('/', requireVoteSession, (req, res) => {
  // Check maintenance mode
  const maintenance = db.prepare('SELECT value FROM settings WHERE key = ?').get('maintenance_mode');
  if (maintenance && maintenance.value === 'true') {
    return res.redirect('/');
  }
  
  // Check if login booth is disabled
  const disableBooth = db.prepare('SELECT value FROM settings WHERE key = ?').get('disable_login_booth');
  if (disableBooth && disableBooth.value === 'true') {
    return res.redirect('/');
  }
  
  res.sendFile(path.join(__dirname, '../views/vote.html'));
});

module.exports = router;