// src/routes/patients-multitenant.js
// Multi-tenant aware patient management

const express = require("express");
const { body, validationResult } = require("express-validator");
const {
  authWithHospital,
  setHospitalContext,
  checkHospitalAccess,
} = require("../middleware/hospital");
const pool = require("../config/database");

const router = express.Router();

// Apply multi-tenant middleware to all routes
router.use(authWithHospital);
router.use(setHospitalContext);
router.use(checkHospitalAccess);

/**
 * GET /api/patients - List patients (hospital-scoped)
 *
 * System Design Concepts Demonstrated:
 * - Data Isolation: Only returns patients from user's hospital
 * - Row Level Security: PostgreSQL automatically filters by hospital_id
 * - Pagination: Essential for large datasets across multiple hospitals
 */
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, 
             COUNT(*) OVER() as total_count
      FROM patients p 
      WHERE p.hospital_id = $1
    `;

    const params = [req.hospitalId];
    let paramCount = 2;

    // Search functionality
    if (search) {
      query += ` AND (
        p.first_name ILIKE $${paramCount} OR 
        p.last_name ILIKE $${paramCount} OR 
        p.medical_record_number ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY p.last_name, p.first_name LIMIT $${paramCount} OFFSET $${
      paramCount + 1
    }`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    const totalCount = result.rows.length > 0 ? result.rows[0].total_count : 0;
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      patients: result.rows.map((row) => {
        const { total_count, ...patient } = row;
        return patient;
      }),
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount: parseInt(totalCount),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      hospital: {
        id: req.user.hospital_id,
        name: req.user.hospital_name,
        code: req.user.hospital_code,
      },
    });
  } catch (error) {
    console.error("Get patients error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/patients - Create patient (hospital-scoped)
 *
 * System Design Concepts:
 * - Auto-assignment: Automatically assigns patient to user's hospital
 * - Unique constraints: MRN only unique within hospital, not globally
 * - Audit trail: Tracks which hospital created the patient
 */
router.post(
  "/",
  [
    body("firstName")
      .trim()
      .isLength({ min: 1 })
      .withMessage("First name is required"),
    body("lastName")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Last name is required"),
    body("medicalRecordNumber")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Medical record number is required"),
    body("roomNumber").optional().trim(),
    body("dateOfBirth")
      .optional()
      .isISO8601()
      .withMessage("Date must be in YYYY-MM-DD format"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        firstName,
        lastName,
        medicalRecordNumber,
        roomNumber,
        dateOfBirth,
      } = req.body;

      // Check if MRN exists within this hospital (not globally)
      const existingPatient = await pool.query(
        "SELECT id FROM patients WHERE medical_record_number = $1 AND hospital_id = $2",
        [medicalRecordNumber, req.hospitalId]
      );

      if (existingPatient.rows.length > 0) {
        return res.status(400).json({
          error: "Medical record number already exists in this hospital",
        });
      }

      // Create patient with automatic hospital assignment
      const newPatient = await pool.query(
        `
      INSERT INTO patients (
        first_name, last_name, medical_record_number, 
        room_number, date_of_birth, hospital_id
      ) VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *`,
        [
          firstName,
          lastName,
          medicalRecordNumber,
          roomNumber || null,
          dateOfBirth || null,
          req.hospitalId,
        ]
      );

      res.status(201).json({
        message: "Patient created successfully",
        patient: newPatient.rows[0],
        hospital: {
          id: req.user.hospital_id,
          name: req.user.hospital_name,
        },
      });
    } catch (error) {
      console.error("Create patient error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * GET /api/patients/analytics - Hospital-specific analytics
 *
 * System Design Concepts:
 * - Data segregation: Analytics only for current hospital
 * - Aggregation: Summary statistics for operational insights
 * - Performance: Uses indexes on hospital_id for fast queries
 */
router.get("/analytics", async (req, res) => {
  try {
    const { timeframe = "30" } = req.query; // days

    const analytics = await pool.query(
      `
      SELECT 
        COUNT(DISTINCT p.id) as total_patients,
        COUNT(DISTINCT tl.id) as total_task_logs,
        COUNT(DISTINCT tl.id) FILTER (
          WHERE tl.created_at >= NOW() - INTERVAL '${parseInt(timeframe)} days'
        ) as recent_task_logs,
        COUNT(DISTINCT u.id) as active_clinicians,
        AVG(
          EXTRACT(EPOCH FROM (
            SELECT MAX(created_at) - MIN(created_at) 
            FROM task_logs tl2 
            WHERE tl2.patient_id = p.id 
            AND tl2.hospital_id = $1
          )) / 3600
        ) as avg_care_duration_hours
      FROM patients p
      LEFT JOIN task_logs tl ON p.id = tl.patient_id AND tl.hospital_id = $1
      LEFT JOIN users u ON tl.user_id = u.id AND u.hospital_id = $1
      WHERE p.hospital_id = $1
        AND p.created_at >= NOW() - INTERVAL '${parseInt(timeframe)} days'
    `,
      [req.hospitalId]
    );

    res.json({
      analytics: analytics.rows[0],
      timeframe: `${timeframe} days`,
      hospital: {
        id: req.user.hospital_id,
        name: req.user.hospital_name,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
