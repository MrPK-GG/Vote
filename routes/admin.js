const express = require('express');
const router = express.Router();
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');
const multer = require('multer');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

// Login page
router.get('/login', (req, res) => {
  if (req.session.adminId) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, '../views/admin-login.html'));
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.json({ success: false, message: 'Invalid credentials' });
  }
  req.session.adminId = admin.id;
  req.session.adminUsername = admin.username;
  db.logAudit(admin.username, 'ADMIN_LOGIN', { ip: req.ip });
  res.json({ success: true, redirect: '/admin' });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Admin dashboard
router.get('/', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/admin.html'));
});

// Public results page
router.get('/results-redirect', (req, res) => {
  res.redirect('/results');
});

// Create admin user
router.post('/create-admin', requireAdmin, (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, message: 'Username and password required' });
    const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
    if (existing) return res.json({ success: false, message: 'Username already exists' });
    const hashed = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run(username, hashed);
    res.json({ success: true, message: 'Admin created successfully' });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// Update admin user
router.put('/admins/:id', requireAdmin, (req, res) => {
  try {
    const { username, password } = req.body;
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM admins WHERE id = ?').get(id);
    if (!existing) return res.json({ success: false, message: 'Admin user not found' });
    if (!username && !password) return res.json({ success: false, message: 'Nothing to update' });
    if (username) {
      const duplicate = db.prepare('SELECT id FROM admins WHERE username = ? AND id != ?').get(username, id);
      if (duplicate) return res.json({ success: false, message: 'Username already exists' });
    }
    const updates = [];
    const params = [];
    if (username) {
      updates.push('username = ?');
      params.push(username);
    }
    if (password) {
      updates.push('password = ?');
      params.push(bcrypt.hashSync(password, 10));
    }
    params.push(id);
    db.prepare(`UPDATE admins SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true, message: 'Admin updated successfully' });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

router.delete('/admins/:id', requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.session.adminId === id) return res.json({ success: false, message: 'Cannot delete your own account' });
    db.prepare('DELETE FROM admins WHERE id = ?').run(id);
    res.json({ success: true, message: 'Admin deleted successfully' });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// Categories CRUD
router.post('/categories', requireAdmin, (req, res) => {
  try {
    const { name, description, display_order } = req.body;
    const result = db.prepare('INSERT INTO categories (name, description, display_order) VALUES (?, ?, ?)').run(name, description || '', display_order || 0);
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    db.logAudit(req.session.adminUsername, 'CREATE_CATEGORY', { id: cat.id, name: cat.name });
    res.json({ success: true, category: cat });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.put('/categories/:id', requireAdmin, (req, res) => {
  try {
    const { name, description, display_order } = req.body;
    db.prepare('UPDATE categories SET name = ?, description = ?, display_order = ? WHERE id = ?').run(name, description || '', display_order || 0, req.params.id);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.delete('/categories/:id', requireAdmin, (req, res) => {
  try {
    const cat = db.prepare('SELECT name FROM categories WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    db.logAudit(req.session.adminUsername, 'DELETE_CATEGORY', { id: req.params.id, name: cat?.name });
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.post('/categories/bulk-delete', requireAdmin, (req, res) => {
  try {
    const { ids } = req.body;
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM categories WHERE id IN (${placeholders})`).run(...ids);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.post('/categories/:id/duplicate', requireAdmin, (req, res) => {
  try {
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!cat) return res.json({ success: false, message: 'Not found' });
    const result = db.prepare('INSERT INTO categories (name, description, display_order) VALUES (?, ?, ?)').run(`${cat.name} (Copy)`, cat.description, cat.display_order);
    const newCat = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, category: newCat });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Candidates CRUD
router.post('/candidates', requireAdmin, upload.fields([{ name: 'flag' }, { name: 'profile_pic' }]), (req, res) => {
  try {
    const { name, category_id, class: cls, section } = req.body;
    const flag = req.files?.flag?.[0]?.filename || null;
    const profile_pic = req.files?.profile_pic?.[0]?.filename || null;
    const result = db.prepare('INSERT INTO candidates (name, category_id, class, section, flag, profile_pic) VALUES (?, ?, ?, ?, ?, ?)').run(name, category_id, cls, section, flag, profile_pic);
    const candidate = db.prepare(`SELECT c.*, cat.name as category_name FROM candidates c LEFT JOIN categories cat ON c.category_id = cat.id WHERE c.id = ?`).get(result.lastInsertRowid);
    res.json({ success: true, candidate });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.put('/candidates/:id', requireAdmin, upload.fields([{ name: 'flag' }, { name: 'profile_pic' }]), (req, res) => {
  try {
    const { name, category_id, class: cls, section } = req.body;
    const existing = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
    const flag = req.files?.flag?.[0]?.filename || existing.flag;
    const profile_pic = req.files?.profile_pic?.[0]?.filename || existing.profile_pic;
    db.prepare('UPDATE candidates SET name = ?, category_id = ?, class = ?, section = ?, flag = ?, profile_pic = ? WHERE id = ?').run(name, category_id, cls, section, flag, profile_pic, req.params.id);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.delete('/candidates/:id', requireAdmin, (req, res) => {
  try {
    const candidateId = req.params.id;
    db.prepare('DELETE FROM votes WHERE candidate_id = ?').run(candidateId);
    db.prepare('DELETE FROM candidates WHERE id = ?').run(candidateId);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.post('/candidates/bulk-delete', requireAdmin, (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.json({ success: false, message: 'No candidates selected' });
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM votes WHERE candidate_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM candidates WHERE id IN (${placeholders})`).run(...ids);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Polling Booths
router.post('/booths', requireAdmin, (req, res) => {
  try {
    const { name, pin, expires_at, auth_type, username, password, max_votes } = req.body;
    let finalPin = pin;
    if (auth_type === 'userpass') {
      if (!username || !password) return res.json({ success: false, message: 'Username and Password required' });
      const existingUser = db.prepare('SELECT id FROM polling_booths WHERE username = ?').get(username);
      if (existingUser) return res.json({ success: false, message: 'Username already exists' });
      // Generate dummy pin for db constraint
      finalPin = Math.floor(1000 + Math.random() * 9000).toString(); 
      while(db.prepare('SELECT id FROM polling_booths WHERE pin = ?').get(finalPin)) {
        finalPin = Math.floor(1000 + Math.random() * 9000).toString();
      }
    } else {
      if (!finalPin || finalPin.length !== 4 || !/^\d{4}$/.test(finalPin)) return res.json({ success: false, message: 'PIN must be 4 digits' });
      const existing = db.prepare('SELECT id FROM polling_booths WHERE pin = ?').get(finalPin);
      if (existing) return res.json({ success: false, message: 'PIN already exists' });
    }
    
    const result = db.prepare('INSERT INTO polling_booths (name, pin, expires_at, auth_type, username, password, max_votes) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(name, finalPin, expires_at || null, auth_type || 'pin', auth_type === 'userpass' ? username : null, auth_type === 'userpass' ? password : null, max_votes || null);
    
    const booth = db.prepare('SELECT * FROM polling_booths WHERE id = ?').get(result.lastInsertRowid);
    db.logAudit(req.session.adminUsername, 'CREATE_BOOTH', { id: booth.id, name: booth.name });
    res.json({ success: true, booth });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.put('/booths/:id', requireAdmin, (req, res) => {
  try {
    const { name, pin, expires_at, is_active, auth_type, username, password, max_votes } = req.body;
    let finalPin = pin;
    if (auth_type === 'userpass') {
      if (!username || !password) return res.json({ success: false, message: 'Username and Password required' });
      const existingUser = db.prepare('SELECT id FROM polling_booths WHERE username = ? AND id != ?').get(username, req.params.id);
      if (existingUser) return res.json({ success: false, message: 'Username already exists' });
      const old = db.prepare('SELECT pin FROM polling_booths WHERE id = ?').get(req.params.id);
      finalPin = old ? old.pin : Math.floor(1000 + Math.random() * 9000).toString();
    } else {
      if (!finalPin || finalPin.length !== 4 || !/^\d{4}$/.test(finalPin)) return res.json({ success: false, message: 'PIN must be 4 digits' });
      const existing = db.prepare('SELECT id FROM polling_booths WHERE pin = ? AND id != ?').get(finalPin, req.params.id);
      if (existing) return res.json({ success: false, message: 'PIN already exists' });
    }
    
    db.prepare('UPDATE polling_booths SET name = ?, pin = ?, expires_at = ?, is_active = ?, auth_type = ?, username = ?, password = ?, max_votes = ? WHERE id = ?')
      .run(name, finalPin, expires_at || null, is_active !== undefined ? is_active : 1, auth_type || 'pin', auth_type === 'userpass' ? username : null, auth_type === 'userpass' ? password : null, max_votes || null, req.params.id);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.delete('/booths/:id', requireAdmin, (req, res) => {
  try {
    const boothId = req.params.id;
    const booth = db.prepare('SELECT name FROM polling_booths WHERE id = ?').get(boothId);
    db.prepare('DELETE FROM votes WHERE booth_id = ?').run(boothId);
    db.prepare('DELETE FROM vote_sessions WHERE booth_id = ?').run(boothId);
    db.prepare('DELETE FROM polling_booths WHERE id = ?').run(boothId);
    db.logAudit(req.session.adminUsername, 'DELETE_BOOTH', { id: boothId, name: booth?.name });
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.post('/booths/bulk-delete', requireAdmin, (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.json({ success: false, message: 'No booths selected' });
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM votes WHERE booth_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM vote_sessions WHERE booth_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM polling_booths WHERE id IN (${placeholders})`).run(...ids);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Reset all votes
router.post('/reset-votes', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM votes').run();
    db.prepare('UPDATE candidates SET vote_count = 0').run();
    db.prepare('DELETE FROM vote_sessions').run();
    db.logAudit(req.session.adminUsername, 'RESET_ALL_VOTES', {});
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Reset votes for specific candidate
router.post('/reset-candidate-votes/:id', requireAdmin, (req, res) => {
  try {
    const candidateId = parseInt(req.params.id, 10);
    const candidate = db.prepare('SELECT id FROM candidates WHERE id = ?').get(candidateId);
    if (!candidate) return res.json({ success: false, message: 'Candidate not found' });
    
    db.prepare('DELETE FROM votes WHERE candidate_id = ?').run(candidateId);
    db.prepare('UPDATE candidates SET vote_count = 0 WHERE id = ?').run(candidateId);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Get settings
router.get('/settings', requireAdmin, (req, res) => {
  try {
    const settings = {};
    const rows = db.prepare('SELECT key, value FROM settings').all();
    rows.forEach(row => settings[row.key] = row.value);
    res.json({ success: true, settings });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Update settings
router.put('/settings', requireAdmin, upload.single('site_logo'), (req, res) => {
  try {
    const updates = req.body;
    
    // Handle file upload for logo
    if (req.file) {
      updates.site_logo = req.file.filename;
    }
    
    // Update each setting
    const updateStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && value !== null) {
        updateStmt.run(key, value);
      }
    }
    
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

module.exports = router;