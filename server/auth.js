const jwt = require("jsonwebtoken");

function makeToken(user, secret) {
  return jwt.sign(
    { email: user.email, fullName: user.fullName },
    secret,
    { subject: user._id.toString(), expiresIn: "1h" }
  );
}

function requireAuth(secret) {
  return (req, res, next) => {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Bearer token" });
    }

    const token = auth.slice("Bearer ".length);

    try {
      const payload = jwt.verify(token, secret);
      req.user = { id: payload.sub, email: payload.email, fullName: payload.fullName };
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

module.exports = { makeToken, requireAuth };
