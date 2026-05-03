const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../database');

router.get('/', (req, res) => {
  // Check maintenance mode
  const maintenance = db.prepare('SELECT value FROM settings WHERE key = ?').get('maintenance_mode');
  if (maintenance && maintenance.value === 'true') {
    return res.sendFile(path.join(__dirname, '../public/maintenance.html'));
  }
  // Get settings for dynamic content
  const settings = {};
  const rows = db.prepare('SELECT key, value FROM settings').all();
  rows.forEach(row => settings[row.key] = row.value);
  
  const phase = settings.election_phase || 'voting';
  if (settings.maintenance_mode === 'true' || phase === 'completed') {
    return res.sendFile(path.join(__dirname, '../public/maintenance.html'));
  }
  
  let html = require('fs').readFileSync(path.join(__dirname, '../views/index.html'), 'utf8');
  
  // Replace dynamic content
  const siteName = settings.site_name || 'AKR Academy School';
  const siteLogo = settings.site_logo ? `/uploads/${settings.site_logo}` : 'https://panel.rathamcloud.xyz/extensions/resourcemanager/uploads/1775581335_images (1).jpg';
  
  html = html.replace(/AKR Academy School/g, siteName);
  html = html.replace(/https:\/\/panel\.rathamcloud\.xyz\/extensions\/resourcemanager\/uploads\/1775581335_images \(1\)\.jpg/g, siteLogo);
  
  // Inject global settings
  html = html.replace('</head>', `<script>window.SITE_SETTINGS = ${JSON.stringify(settings)};</script></head>`);
  
  res.send(html);
});

module.exports = router;