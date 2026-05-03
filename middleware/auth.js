// Admin authentication middleware
const requireAdmin = (req, res, next) => {
  if (req.session && req.session.adminId) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  res.redirect('/admin/login');
};

// Voting session middleware
const requireVoteSession = (req, res, next) => {
  if (req.session && req.session.boothId && req.session.voteToken) {
    return next();
  }
  res.redirect('/');
};

module.exports = { requireAdmin, requireVoteSession };