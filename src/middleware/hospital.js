// src/middleware/hospital.js
// Hospital Context Middleware for Multi-Tenancy

const pool = require("../config/database");

/**
 * Middleware to set hospital context for multi-tenant operations
 *
 * System Design Concepts:
 * - Multi-tenancy: Logical separation of data in shared infrastructure
 * - Context setting: Each request operates within a hospital's scope
 * - Security: Prevents cross-hospital data access
 */
const setHospitalContext = async (req, res, next) => {
  try {
    // In a real system, hospital could be determined by:
    // 1. Subdomain: nyc-general.healthsystem.com
    // 2. Header: X-Hospital-Code
    // 3. User's assigned hospital
    // 4. URL path: /api/hospitals/NYC001/patients

    let hospitalId;

    // Method 1: Get from user's hospital assignment
    if (req.user && req.user.hospital_id) {
      hospitalId = req.user.hospital_id;
    }

    // Method 2: Get from header (for admin/multi-hospital users)
    else if (req.headers["x-hospital-code"]) {
      const hospitalCode = req.headers["x-hospital-code"];
      const hospital = await pool.query(
        "SELECT id FROM hospitals WHERE code = $1 AND active = true",
        [hospitalCode]
      );

      if (hospital.rows.length === 0) {
        return res.status(400).json({ error: "Invalid hospital code" });
      }

      hospitalId = hospital.rows[0].id;
    }

    // Method 3: Get from URL parameter
    else if (req.params.hospitalCode) {
      const hospitalCode = req.params.hospitalCode;
      const hospital = await pool.query(
        "SELECT id FROM hospitals WHERE code = $1 AND active = true",
        [hospitalCode]
      );

      if (hospital.rows.length === 0) {
        return res.status(404).json({ error: "Hospital not found" });
      }

      hospitalId = hospital.rows[0].id;
    } else {
      return res.status(400).json({
        error:
          "Hospital context required. Provide X-Hospital-Code header or hospital in URL.",
      });
    }

    // Set hospital context for this request
    req.hospitalId = hospitalId;

    // Set PostgreSQL session variable for Row Level Security
    await pool.query("SET app.current_hospital_id = $1", [hospitalId]);

    next();
  } catch (error) {
    console.error("Hospital context error:", error);
    res.status(500).json({ error: "Failed to set hospital context" });
  }
};

/**
 * Middleware to verify user has access to requested hospital
 *
 * System Design Concept: Authorization vs Authentication
 * - Authentication: Who are you? (handled by auth middleware)
 * - Authorization: What can you access? (handled here)
 */
const checkHospitalAccess = async (req, res, next) => {
  try {
    const requestedHospitalId = req.hospitalId;
    const userHospitalId = req.user.hospital_id;

    // Super admins can access any hospital
    if (req.user.role === "super_admin") {
      return next();
    }

    // Regular users can only access their own hospital
    if (userHospitalId !== requestedHospitalId) {
      return res.status(403).json({
        error: "Access denied: You can only access your assigned hospital",
      });
    }

    next();
  } catch (error) {
    console.error("Hospital access check error:", error);
    res.status(500).json({ error: "Authorization check failed" });
  }
};

/**
 * Enhanced authentication middleware that includes hospital info
 */
const authWithHospital = async (req, res, next) => {
  try {
    const jwt = require("jsonwebtoken");
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "No token, authorization denied" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user with hospital information
    const user = await pool.query(
      `
      SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.hospital_id,
             h.name as hospital_name, h.code as hospital_code
      FROM users u
      JOIN hospitals h ON u.hospital_id = h.id
      WHERE u.id = $1 AND h.active = true
    `,
      [decoded.userId]
    );

    if (user.rows.length === 0) {
      return res
        .status(401)
        .json({ error: "Token is not valid or hospital inactive" });
    }

    req.user = user.rows[0];
    next();
  } catch (error) {
    console.error("Auth with hospital error:", error);
    res.status(401).json({ error: "Token is not valid" });
  }
};

/**
 * Utility function to add hospital filters to queries
 *
 * System Design Pattern: Query Scoping
 * - Automatically adds hospital_id filters to prevent data leakage
 * - Centralizes multi-tenant query logic
 */
const addHospitalFilter = (baseQuery, params, hospitalId) => {
  const paramIndex = params.length + 1;
  const filteredQuery = baseQuery.includes("WHERE")
    ? `${baseQuery} AND hospital_id = $${paramIndex}`
    : `${baseQuery} WHERE hospital_id = $${paramIndex}`;

  params.push(hospitalId);
  return { query: filteredQuery, params };
};

module.exports = {
  setHospitalContext,
  checkHospitalAccess,
  authWithHospital,
  addHospitalFilter,
};
