const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');
const crypto = require('crypto');
const XLSX = require('xlsx');

// Verify polling pin
router.post('/verify-pin', (req, res) => {
  try {
    const { pin, username, password } = req.body;

    const maintenance = db.prepare('SELECT value FROM settings WHERE key = ?').get('maintenance_mode');
    const phase = db.prepare('SELECT value FROM settings WHERE key = ?').get('election_phase');
    
    if (phase && phase.value === 'preparing') return res.json({ success: false, message: 'Election has not started yet. Please wait.' });
    if (phase && phase.value === 'completed') return res.json({ success: false, message: 'This election has concluded.' });
    if (maintenance && maintenance.value === 'true') return res.json({ success: false, message: 'Voting is disabled during maintenance mode' });

    const disableBooth = db.prepare('SELECT value FROM settings WHERE key = ?').get('disable_login_booth');
    if (disableBooth && disableBooth.value === 'true') {
      return res.json({ success: false, message: 'Login booths are currently disabled' });
    }

    const loginType = db.prepare('SELECT value FROM settings WHERE key = ?').get('login_screen_type');
    const now = new Date().toISOString();
    let booth;

    if (loginType && loginType.value === 'userpass') {
      if (!username || !password) return res.json({ success: false, message: 'Username and password required' });
      booth = db.prepare(`SELECT * FROM polling_booths WHERE username = ? AND password = ? AND auth_type = 'userpass' AND is_active = 1 AND (expires_at IS NULL OR expires_at > ?)`).get(username, password, now);
      if (!booth) return res.json({ success: false, message: 'Invalid username or password' });
    } else {
      if (!pin) return res.json({ success: false, message: 'PIN required' });
      booth = db.prepare(`SELECT * FROM polling_booths WHERE pin = ? AND auth_type = 'pin' AND is_active = 1 AND (expires_at IS NULL OR expires_at > ?)`).get(pin, now);
      if (!booth) return res.json({ success: false, message: 'Invalid or expired PIN' });
    }

    // Count persons who have COMPLETED voting at this booth (each CAST MY VOTE = 1 person)
    const completedVoters = db.prepare(
      'SELECT COUNT(*) as count FROM vote_sessions WHERE booth_id = ? AND is_complete = 1'
    ).get(booth.id);

    if (booth.max_votes !== null && completedVoters.count >= booth.max_votes) {
      return res.json({ success: false, message: `This booth has reached its vote limit (${completedVoters.count}/${booth.max_votes}). No more voters allowed.` });
    }

    // Clean up only truly stale incomplete sessions (older than 2 hours)
    // This prevents ghost sessions without killing active ones in other booths/windows
    db.prepare("DELETE FROM vote_sessions WHERE created_at < datetime('now', '-2 hours') AND is_complete = 0").run();

    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO vote_sessions (booth_id, session_token) VALUES (?, ?)').run(booth.id, token);
    
    req.session.boothId = booth.id;
    req.session.boothName = booth.name;
    req.session.voteToken = token;
    req.session.votedCategories = [];
    
    res.json({ success: true, redirect: '/vote' });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Get categories with candidates (for voting page)
router.get('/voting-data', (req, res) => {
  if (!req.session.boothId) return res.json({ success: false, message: 'Not authorized' });
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY display_order, name').all();
    const candidates = db.prepare(`
      SELECT c.*, cat.name as category_name 
      FROM candidates c 
      LEFT JOIN categories cat ON c.category_id = cat.id
      ORDER BY cat.display_order, cat.name, c.name
    `).all();
    
    const result = categories.map(cat => ({
      ...cat,
      candidates: candidates.filter(c => c.category_id === cat.id)
    })).filter(cat => cat.candidates.length > 0);
    
    // Check setting for votes left
    let showVotesLeft = false;
    let votesLeft = null;
    const svlSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('show_votes_left');
    if (svlSetting && svlSetting.value === 'true') {
      showVotesLeft = true;
      const boothInfo = db.prepare('SELECT max_votes FROM polling_booths WHERE id = ?').get(req.session.boothId);
      if (boothInfo && boothInfo.max_votes !== null) {
        // Count persons who pressed CAST MY VOTE (is_complete = 1), NOT category-level votes
        const completedVoters = db.prepare(
          'SELECT COUNT(*) as count FROM vote_sessions WHERE booth_id = ? AND is_complete = 1'
        ).get(req.session.boothId);
        votesLeft = Math.max(0, boothInfo.max_votes - completedVoters.count);
      }
    }
    
    res.json({ success: true, categories: result, boothName: req.session.boothName, showVotesLeft, votesLeft });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Submit votes
router.post('/submit-votes', (req, res) => {
  if (!req.session.boothId || !req.session.voteToken) {
    return res.json({ success: false, message: 'Session expired' });
  }
  try {
    const { votes } = req.body; // { category_id: candidate_id, ... }
    const boothId = req.session.boothId;

    // Hard enforce limit again immediately before accepting the write
    const boothInfo = db.prepare('SELECT max_votes FROM polling_booths WHERE id = ?').get(boothId);
    if (boothInfo && boothInfo.max_votes !== null) {
      const distinctVoters = db.prepare('SELECT count(DISTINCT session_token) as count FROM vote_sessions WHERE booth_id = ? AND is_complete = 1').get(boothId);
      if (distinctVoters.count >= boothInfo.max_votes) return res.json({ success: false, message: 'This booth has reached its maximum vote limit.', maxLimitReached: true });
    }
    
    const insertVote = db.prepare('INSERT INTO votes (booth_id, candidate_id, category_id) VALUES (?, ?, ?)');
    const updateCount = db.prepare('UPDATE candidates SET vote_count = vote_count + 1 WHERE id = ?');
    const completeSession = db.prepare('UPDATE vote_sessions SET is_complete = 1 WHERE session_token = ?');
    
    const insertMany = db.transaction((votesArr) => {
      for (const [categoryId, candidateId] of Object.entries(votesArr)) {
        insertVote.run(boothId, candidateId, categoryId);
        updateCount.run(candidateId);
      }
      completeSession.run(req.session.voteToken);
    });
    
    insertMany(votes);
    
    // Clear vote session data (but keep booth access)
    req.session.votedCategories = [];
    
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// End vote session (go back to index)
router.post('/end-session', (req, res) => {
  req.session.boothId = null;
  req.session.voteToken = null;
  req.session.boothName = null;
  res.json({ success: true });
});

// ===== ADMIN API =====
// Get all categories
router.get('/admin/categories', requireAdmin, (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT c.*, COUNT(cand.id) as candidate_count 
      FROM categories c 
      LEFT JOIN candidates cand ON c.id = cand.category_id 
      GROUP BY c.id 
      ORDER BY c.display_order, c.name
    `).all();
    res.json({ success: true, categories });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Get all candidates
router.get('/admin/candidates', requireAdmin, (req, res) => {
  try {
    const candidates = db.prepare(`
      SELECT c.*, cat.name as category_name 
      FROM candidates c 
      LEFT JOIN categories cat ON c.category_id = cat.id
      ORDER BY cat.display_order, cat.name, c.name
    `).all();
    res.json({ success: true, candidates });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Get all booths (with votes_received count)
router.get('/admin/booths', requireAdmin, (req, res) => {
  try {
    const booths = db.prepare(`
      SELECT pb.*,
        (SELECT COUNT(*) FROM vote_sessions vs WHERE vs.booth_id = pb.id AND vs.is_complete = 1) AS votes_received
      FROM polling_booths pb
      ORDER BY pb.created_at DESC
    `).all();
    res.json({ success: true, booths });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Get overview stats
router.get('/admin/overview', requireAdmin, (req, res) => {
  try {
    const totalVotes = db.prepare('SELECT COUNT(*) as count FROM votes').get().count;
    const totalCandidates = db.prepare('SELECT COUNT(*) as count FROM candidates').get().count;
    const totalCategories = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
    const totalBooths = db.prepare('SELECT COUNT(*) as count FROM polling_booths WHERE is_active = 1').get().count;
    const totalMembersVoted = db.prepare('SELECT COUNT(*) as count FROM vote_sessions WHERE is_complete = 1').get().count;
    
    const candidateResults = db.prepare(`
      SELECT c.id, c.name, c.vote_count, c.class, c.section, c.profile_pic, 
             cat.name as category_name, cat.id as category_id
      FROM candidates c
      LEFT JOIN categories cat ON c.category_id = cat.id
      ORDER BY cat.display_order, c.vote_count DESC
    `).all();
    
    const boothStats = db.prepare(`
      SELECT pb.name, pb.pin, COUNT(DISTINCT v.id) as vote_count,
             (SELECT COUNT(*) FROM vote_sessions vs WHERE vs.booth_id = pb.id AND vs.is_complete = 1) as member_voted_count
      FROM polling_booths pb
      LEFT JOIN votes v ON pb.id = v.booth_id
      GROUP BY pb.id
      ORDER BY member_voted_count DESC
    `).all();
    
    res.json({
      success: true,
      stats: { totalVotes, totalCandidates, totalCategories, totalBooths, totalMembersVoted },
      candidateResults,
      boothStats
    });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Export to Excel
router.get('/admin/export', requireAdmin, (req, res) => {
  try {
    const rawResults = db.prepare(`
      SELECT c.name as "Candidate Name", c.class as "Class", c.section as "Section",
             cat.name as "Category", c.vote_count as "Total Votes"
      FROM candidates c
      LEFT JOIN categories cat ON c.category_id = cat.id
      ORDER BY cat.display_order, c.vote_count DESC
    `).all();
    
    // Group by category to assign ranks and calculate winner margin
    const grouped = {};
    rawResults.forEach(c => {
      if (!grouped[c.Category]) grouped[c.Category] = [];
      grouped[c.Category].push(c);
    });

    const formattedResults = [];
    
    // Process ranking and winner margins per category
    Object.keys(grouped).forEach(cat => {
      const allCands = grouped[cat];
      let winnerInfo = '';
      if (allCands.length > 0) {
        const winner = allCands[0];
        if (allCands.length > 1) {
          const margin = winner["Total Votes"] - allCands[1]["Total Votes"];
          winnerInfo = margin > 0 ? `Won by ${margin} vote(s)` : 'Tie for first place';
        } else {
          winnerInfo = 'Won unopposed';
        }
      }

      allCands.forEach((c, index) => {
        formattedResults.push({
          "Category": c.Category,
          "Rank": index + 1,
          "Candidate Name": c["Candidate Name"],
          "Class": c.Class,
          "Section": c.Section,
          "Total Votes": c["Total Votes"],
          "Status / Margin": index === 0 ? winnerInfo : ''
        });
      });
      // Add empty row to separate categories
      formattedResults.push({});
    });

    const ws = XLSX.utils.json_to_sheet(formattedResults);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=AKR_Voting_Results.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Get admins list
router.get('/admin/admins', requireAdmin, (req, res) => {
  try {
    const admins = db.prepare('SELECT id, username, created_at FROM admins ORDER BY created_at').all();
    res.json({ success: true, admins });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Get vote wait time (public)
router.get('/vote-wait-time', (req, res) => {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('vote_wait_seconds');
    const seconds = parseInt(row?.value || '10', 10);
    res.json({ success: true, seconds: Math.max(1, Math.min(seconds, 60)) });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// Get vote sound setting (public)
router.get('/vote-sound', (req, res) => {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('vote_sound');
    res.json({ success: true, enabled: row?.value === 'true' });
  } catch (e) { res.json({ success: false, enabled: false }); }
});

// Get session info
router.get('/admin/session', requireAdmin, (req, res) => {
  res.json({ success: true, adminId: req.session.adminId, username: req.session.adminUsername });
});

const updateVoteWaitTime = (req, res) => {
  try {
    const seconds = parseInt(req.body.seconds, 10);
    if (!seconds || seconds < 1 || seconds > 60) {
      return res.json({ success: false, message: 'Value must be between 1 and 60 seconds' });
    }
    db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run('vote_wait_seconds', seconds.toString());
    res.json({ success: true, seconds });
  } catch (e) { res.json({ success: false, message: e.message }); }
};

router.put('/admin/settings/vote-wait-time', requireAdmin, updateVoteWaitTime);
router.post('/admin/settings/vote-wait-time', requireAdmin, updateVoteWaitTime);

// ===== THEME =====
// GET /api/theme — public, returns active theme id
router.get('/theme', (req, res) => {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('active_theme');
    res.json({ success: true, themeId: row?.value || 'royal-navy' });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// PUT /api/admin/theme — set active theme
router.put('/admin/theme', requireAdmin, (req, res) => {
  try {
    const { themeId } = req.body;
    if (!themeId) return res.json({ success: false, message: 'themeId required' });
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('active_theme', themeId);
    db.logAudit(req.session.adminUsername, 'CHANGE_THEME', { themeId });
    res.json({ success: true, themeId });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// ===== PUBLIC STATUS =====
// GET /api/status — public, no auth needed
router.get('/status', (req, res) => {
  try {
    const maintenance = db.prepare('SELECT value FROM settings WHERE key = ?').get('maintenance_mode');
    const disableBooth = db.prepare('SELECT value FROM settings WHERE key = ?').get('disable_login_booth');
    const showPublicResults = db.prepare('SELECT value FROM settings WHERE key = ?').get('show_public_results');

    const votingOpen = !(
      (maintenance && maintenance.value === 'true') ||
      (disableBooth && disableBooth.value === 'true')
    );

    const totalVotes = db.prepare('SELECT COUNT(*) as count FROM votes').get().count;
    const activeBooothCount = db.prepare('SELECT COUNT(*) as count FROM polling_booths WHERE is_active = 1').get().count;
    const totalCandidates = db.prepare('SELECT COUNT(*) as count FROM candidates').get().count;

    res.json({
      success: true,
      votingOpen,
      totalVotes,
      activeBooths: activeBooothCount,
      totalCandidates,
      publicResultsEnabled: !!(showPublicResults && showPublicResults.value === 'true')
    });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// ===== LIVE RESULTS =====
// GET /api/live-results — gated by show_public_results setting when called without admin session
router.get('/live-results', (req, res) => {
  try {
    // If not admin, check public results toggle
    if (!req.session.adminId) {
      const showPublicResults = db.prepare('SELECT value FROM settings WHERE key = ?').get('show_public_results');
      if (!showPublicResults || showPublicResults.value !== 'true') {
        return res.json({ success: false, message: 'Results are not yet public' });
      }
    }

    const categories = db.prepare('SELECT * FROM categories ORDER BY display_order, name').all();
    const candidates = db.prepare(`
      SELECT c.id, c.name, c.class, c.section, c.profile_pic, c.vote_count, c.category_id,
             cat.name as category_name
      FROM candidates c
      LEFT JOIN categories cat ON c.category_id = cat.id
      ORDER BY cat.display_order, c.vote_count DESC
    `).all();

    const totalVotes = db.prepare('SELECT COUNT(*) as count FROM votes').get().count;
    const totalMembersVoted = db.prepare('SELECT COUNT(*) as count FROM vote_sessions WHERE is_complete = 1').get().count;

    const result = categories.map(cat => ({
      ...cat,
      candidates: candidates
        .filter(c => c.category_id === cat.id)
        .sort((a, b) => b.vote_count - a.vote_count)
    }));

    res.json({ success: true, categories: result, totalVotes, totalMembersVoted });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// ===== CATEGORY LEADERS =====
// GET /api/category-leaders — returns the top candidate per category (public after voting)
router.get('/category-leaders', (req, res) => {
  try {
    const leaders = db.prepare(`
      SELECT c.id, c.name, c.vote_count, c.profile_pic, cat.id as category_id, cat.name as category_name
      FROM candidates c
      JOIN categories cat ON c.category_id = cat.id
      WHERE c.vote_count = (
        SELECT MAX(c2.vote_count) FROM candidates c2 WHERE c2.category_id = c.category_id
      )
      ORDER BY cat.display_order, cat.name
    `).all();
    res.json({ success: true, leaders });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// ===== BOOTH STATS =====
// GET /api/booth-stats — votes per polling booth
router.get('/booth-stats', (req, res) => {
  try {
    // Gate for non-admins
    if (!req.session.adminId) {
      const showPublicResults = db.prepare('SELECT value FROM settings WHERE key = ?').get('show_public_results');
      if (!showPublicResults || showPublicResults.value !== 'true') {
        return res.json({ success: false, message: 'Not authorized' });
      }
    }

    const booths = db.prepare(`
      SELECT pb.id, pb.name, pb.pin, pb.is_active,
             COUNT(DISTINCT v.id) as vote_count,
             (SELECT COUNT(*) FROM vote_sessions vs WHERE vs.booth_id = pb.id AND vs.is_complete = 1) as member_voted_count
      FROM polling_booths pb
      LEFT JOIN votes v ON pb.id = v.booth_id
      GROUP BY pb.id
      ORDER BY member_voted_count DESC
    `).all();

    const totalVotes = booths.reduce((sum, b) => sum + b.vote_count, 0);

    res.json({ success: true, booths, totalVotes });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// ===== ADMIN ACTIVITY FEED =====
// GET /api/admin/activity — last 50 vote events (booth + category, no candidate name)
router.get('/admin/activity', requireAdmin, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const activity = db.prepare(`
      SELECT v.voted_at, pb.name as booth_name, cat.name as category_name
      FROM votes v
      LEFT JOIN polling_booths pb ON v.booth_id = pb.id
      LEFT JOIN categories cat ON v.category_id = cat.id
      ORDER BY v.voted_at DESC
      LIMIT ?
    `).all(limit);
    res.json({ success: true, activity });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

// ===== ADMIN AUDIT LOG =====
// GET /api/admin/audit-log
router.get('/admin/audit-log', requireAdmin, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const logs = db.prepare(`
      SELECT id, admin_username, action, details, created_at
      FROM audit_log
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);
    res.json({ success: true, logs });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

module.exports = router;