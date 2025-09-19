const express = require("express");
const { body, validationResult } = require("express-validator");
const { auth, requireRole } = require("../middleware/auth");
const pool = require("../config/database");

const router = express.Router();

// All patient routes require authentication
router.use(auth);

// GET /api/patients - List all patients
router.get("/", async (req, res) => {
  try {
    const patients = await pool.query(
      "SELECT id, first_name, last_name, date_of_birth, medical_record_number, room_number, created_at FROM patients ORDER BY last_name, first_name"
    );

    res.json({
      patients: patients.rows,
      count: patients.rows.length,
    });
  } catch (error) {
    console.error("Get patients error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/patients/:id - Get specific patient
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await pool.query("SELECT * FROM patients WHERE id = $1", [
      id,
    ]);

    if (patient.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.json({ patient: patient.rows[0] });
  } catch (error) {
    console.error("Get patient error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/patients - Create new patient
router.post(
  "/",
  requireRole(["admin"]),
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

      // IMPORTANT: Get hospital_id from the authenticated user
      const hospitalId = req.user.hospital_id;

      if (!hospitalId) {
        return res
          .status(400)
          .json({ error: "User is not assigned to a hospital" });
      }

      // Check if medical record number already exists IN THIS HOSPITAL
      const existingPatient = await pool.query(
        "SELECT id FROM patients WHERE medical_record_number = $1 AND hospital_id = $2",
        [medicalRecordNumber, hospitalId]
      );

      if (existingPatient.rows.length > 0) {
        return res.status(400).json({
          error: "Medical record number already exists in this hospital",
        });
      }

      // Create patient with hospital_id from user
      const newPatient = await pool.query(
        "INSERT INTO patients (first_name, last_name, medical_record_number, room_number, date_of_birth, hospital_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [
          firstName,
          lastName,
          medicalRecordNumber,
          roomNumber || null,
          dateOfBirth || null,
          hospitalId,
        ]
      );

      res.status(201).json({
        message: "Patient created successfully",
        patient: newPatient.rows[0],
      });
    } catch (error) {
      console.error("Create patient error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// DELETE /api/patients/:id - Delete patient (admin only)
router.delete("/:id", requireRole(["admin"]), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if patient exists and belongs to user's hospital
    const existingPatient = await pool.query(
      "SELECT id, hospital_id FROM patients WHERE id = $1",
      [id]
    );

    if (existingPatient.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }

    // Check hospital access (if using multi-tenant)
    if (existingPatient.rows[0].hospital_id !== req.user.hospital_id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Delete patient (CASCADE will delete related task_logs)
    const result = await pool.query(
      "DELETE FROM patients WHERE id = $1 RETURNING *",
      [id]
    );

    res.json({
      message: "Patient deleted successfully",
      patient: result.rows[0],
    });
  } catch (error) {
    console.error("Delete patient error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/patients/:id - Update patient (admin only)
router.put(
  "/:id",
  requireRole(["admin"]),
  [
    body("firstName").optional().trim().isLength({ min: 1 }),
    body("lastName").optional().trim().isLength({ min: 1 }),
    body("roomNumber").optional().trim(),
    body("dateOfBirth").optional().isISO8601(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { firstName, lastName, roomNumber, dateOfBirth } = req.body;

      // Build dynamic update query
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (firstName) {
        updates.push(`first_name = $${paramCount++}`);
        values.push(firstName);
      }
      if (lastName) {
        updates.push(`last_name = $${paramCount++}`);
        values.push(lastName);
      }
      if (roomNumber !== undefined) {
        updates.push(`room_number = $${paramCount++}`);
        values.push(roomNumber || null);
      }
      if (dateOfBirth !== undefined) {
        updates.push(`date_of_birth = $${paramCount++}`);
        values.push(dateOfBirth || null);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `UPDATE patients SET ${updates.join(
        ", "
      )} WHERE id = $${paramCount} RETURNING *`;
      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Patient not found" });
      }

      res.json({
        message: "Patient updated successfully",
        patient: result.rows[0],
      });
    } catch (error) {
      console.error("Update patient error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
);

module.exports = router;
