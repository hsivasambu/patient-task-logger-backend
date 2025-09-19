const jwt = require("jsonwebtoken");
const pool = require("../config/database");

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "No token, authorization denied" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database INCLUDING hospital_id
    const user = await pool.query(
      "SELECT id, email, first_name, last_name, role, hospital_id FROM users WHERE id = $1",
      [decoded.userId]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ error: "Token is not valid" });
    }

    req.user = user.rows[0];
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ error: "Token is not valid" });
  }
};

// Role-based access control
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "Access denied: insufficient permissions" });
    }
    next();
  };
};

module.exports = { auth, requireRole };
