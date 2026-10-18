// Stateless bearer tokens for the two members: payload.signature, signed with
// API_SECRET. Each member logs in with their own password (USER1_PASSWORD /
// USER2_PASSWORD), so every write knows who made it.
const crypto = require('crypto');
const config = require('../config');

const TOKEN_DAYS = 90;

const secret = () => {
  if (!config.api.secret) throw Object.assign(new Error('API_SECRET is not configured'), { status: 500 });
  return config.api.secret;
};

const hmac = (data) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

const safeEqual = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

const signToken = (userId) => {
  const payload = Buffer.from(JSON.stringify({ u: String(userId), e: Date.now() + TOKEN_DAYS * 86400000 }))
    .toString('base64url');
  return `${payload}.${hmac(payload)}`;
};

const verifyToken = (token) => {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig || !safeEqual(sig, hmac(payload))) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!u || Date.now() > e || !config.isMember(u)) return null;
    return u;
  } catch {
    return null;
  }
};

// Returns the member whose password matches, or null.
const checkPassword = (password) => {
  if (!password) return null;
  for (const member of [config.users.user1, config.users.user2]) {
    if (member.id && member.password && safeEqual(password, member.password)) return member;
  }
  return null;
};

// Very small per-IP limiter for the login route: 10 attempts per 15 minutes.
const attempts = new Map();
const loginLimiter = (req, res, next) => {
  const key = req.ip;
  const now = Date.now();
  const entry = attempts.get(key) || { count: 0, reset: now + 15 * 60000 };
  if (now > entry.reset) Object.assign(entry, { count: 0, reset: now + 15 * 60000 });
  entry.count++;
  attempts.set(key, entry);
  if (entry.count > 10) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  next();
};

const requireAuth = (req, res, next) => {
  try {
    const header = req.get('Authorization') || '';
    const userId = verifyToken(header.replace(/^Bearer\s+/i, ''));
    if (!userId) return res.status(401).json({ error: 'Login required' });
    req.userId = userId;
    next();
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

module.exports = { signToken, verifyToken, checkPassword, loginLimiter, requireAuth };
