const express = require("express");
const { body, validationResult } = require("express-validator");
const { auth, requireRole } = require("../middleware/auth");
const pool = require("../config/database");

const router = express.Router();

// All task log routes require authentication
router.use(auth);

// GET /api/task-logs - List task logs with filters
router.get("/", async (req, res) => {
  try {
    const { patientId, userId, taskType, date, limit = 50 } = req.query;

    let query = `
      SELECT tl.*, 
             p.first_name as patient_first_name, 
             p.last_name as patient_last_name,
             p.medical_record_number,
             u.first_name as clinician_first_name,
             u.last_name as clinician_last_name
      FROM task_logs tl
      JOIN patients p ON tl.patient_id = p.id
      JOIN users u ON tl.user_id = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    // Add filters
    if (patientId) {
      query += ` AND tl.patient_id = $${paramCount++}`;
      params.push(patientId);
    }

    if (userId) {
      query += ` AND tl.user_id = $${paramCount++}`;
      params.push(userId);
    }

    if (taskType) {
      query += ` AND tl.task_type ILIKE $${paramCount++}`;
      params.push(`%${taskType}%`);
    }

    if (date) {
      query += ` AND DATE(tl.completed_at) = $${paramCount++}`;
      params.push(date);
    }

    query += ` ORDER BY tl.completed_at DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    const taskLogs = await pool.query(query, params);

    res.json({
      taskLogs: taskLogs.rows,
      count: taskLogs.rows.length,
      filters: { patientId, userId, taskType, date, limit },
    });
  } catch (error) {
    console.error("Get task logs error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/task-logs/:id - Get specific task log
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const taskLog = await pool.query(
      `
      SELECT tl.*, 
             p.first_name as patient_first_name, 
             p.last_name as patient_last_name,
             p.medical_record_number,
             u.first_name as clinician_first_name,
             u.last_name as clinician_last_name
      FROM task_logs tl
      JOIN patients p ON tl.patient_id = p.id
      JOIN users u ON tl.user_id = u.id
      WHERE tl.id = $1
    `,
      [id]
    );

    if (taskLog.rows.length === 0) {
      return res.status(404).json({ error: "Task log not found" });
    }

    res.json({ taskLog: taskLog.rows[0] });
  } catch (error) {
    console.error("Get task log error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/task-logs - Create new task log
router.post(
  "/",
  [
    body("patientId")
      .isInt({ min: 1 })
      .withMessage("Valid patient ID is required"),
    body("taskType")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Task type is required"),
    body("description")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Description is required"),
    body("completedAt")
      .isISO8601()
      .withMessage("Completed at must be a valid datetime (ISO 8601 format)"),
    body("notes").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { patientId, taskType, description, completedAt, notes } = req.body;

      // Verify patient exists
      const patient = await pool.query(
        "SELECT id FROM patients WHERE id = $1",
        [patientId]
      );
      if (patient.rows.length === 0) {
        return res.status(400).json({ error: "Patient not found" });
      }

      // Create task log (user_id comes from auth middleware)
      const newTaskLog = await pool.query(
        "INSERT INTO task_logs (patient_id, user_id, task_type, description, completed_at, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [
          patientId,
          req.user.id,
          taskType,
          description,
          completedAt,
          notes || null,
        ]
      );

      // Get the full task log with patient and user info
      const fullTaskLog = await pool.query(
        `
      SELECT tl.*, 
             p.first_name as patient_first_name, 
             p.last_name as patient_last_name,
             p.medical_record_number,
             u.first_name as clinician_first_name,
             u.last_name as clinician_last_name
      FROM task_logs tl
      JOIN patients p ON tl.patient_id = p.id
      JOIN users u ON tl.user_id = u.id
      WHERE tl.id = $1
    `,
        [newTaskLog.rows[0].id]
      );

      res.status(201).json({
        message: "Task log created successfully",
        taskLog: fullTaskLog.rows[0],
      });
    } catch (error) {
      console.error("Create task log error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// PUT /api/task-logs/:id - Update task log (only by creator or admin)
router.put(
  "/:id",
  [
    body("taskType").optional().trim().isLength({ min: 1 }),
    body("description").optional().trim().isLength({ min: 1 }),
    body("completedAt").optional().isISO8601(),
    body("notes").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { taskType, description, completedAt, notes } = req.body;

      // Check if task log exists and user has permission to edit
      const existingTaskLog = await pool.query(
        "SELECT user_id FROM task_logs WHERE id = $1",
        [id]
      );
      if (existingTaskLog.rows.length === 0) {
        return res.status(404).json({ error: "Task log not found" });
      }

      // Only allow creator or admin to edit
      if (
        existingTaskLog.rows[0].user_id !== req.user.id &&
        req.user.role !== "admin"
      ) {
        return res
          .status(403)
          .json({ error: "You can only edit your own task logs" });
      }

      // Build dynamic update query
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (taskType) {
        updates.push(`task_type = $${paramCount++}`);
        values.push(taskType);
      }
      if (description) {
        updates.push(`description = $${paramCount++}`);
        values.push(description);
      }
      if (completedAt) {
        updates.push(`completed_at = $${paramCount++}`);
        values.push(completedAt);
      }
      if (notes !== undefined) {
        updates.push(`notes = $${paramCount++}`);
        values.push(notes || null);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `UPDATE task_logs SET ${updates.join(
        ", "
      )} WHERE id = $${paramCount} RETURNING *`;
      const result = await pool.query(query, values);

      // Get the full updated task log
      const fullTaskLog = await pool.query(
        `
      SELECT tl.*, 
             p.first_name as patient_first_name, 
             p.last_name as patient_last_name,
             p.medical_record_number,
             u.first_name as clinician_first_name,
             u.last_name as clinician_last_name
      FROM task_logs tl
      JOIN patients p ON tl.patient_id = p.id
      JOIN users u ON tl.user_id = u.id
      WHERE tl.id = $1
    `,
        [id]
      );

      res.json({
        message: "Task log updated successfully",
        taskLog: fullTaskLog.rows[0],
      });
    } catch (error) {
      console.error("Update task log error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// DELETE /api/task-logs/:id - Delete task log (admin only)
router.delete("/:id", requireRole(["admin"]), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM task_logs WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task log not found" });
    }

    res.json({ message: "Task log deleted successfully" });
  } catch (error) {
    console.error("Delete task log error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/task-logs/patient/:patientId - Get all task logs for a specific patient
router.get("/patient/:patientId", async (req, res) => {
  try {
    const { patientId } = req.params;

    // Verify patient exists
    const patient = await pool.query("SELECT * FROM patients WHERE id = $1", [
      patientId,
    ]);
    if (patient.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const taskLogs = await pool.query(
      `
      SELECT tl.*, 
             u.first_name as clinician_first_name,
             u.last_name as clinician_last_name
      FROM task_logs tl
      JOIN users u ON tl.user_id = u.id
      WHERE tl.patient_id = $1
      ORDER BY tl.completed_at DESC
    `,
      [patientId]
    );

    res.json({
      patient: patient.rows[0],
      taskLogs: taskLogs.rows,
      count: taskLogs.rows.length,
    });
  } catch (error) {
    console.error("Get patient task logs error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
