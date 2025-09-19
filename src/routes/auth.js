const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const pool = require("../config/database");

const router = express.Router();

// Register new user
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("firstName").trim().isLength({ min: 1 }),
    body("lastName").trim().isLength({ min: 1 }),
    body("role").isIn(["clinician", "admin"]),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, firstName, lastName, role } = req.body;

      // Check if user already exists
      const userExists = await pool.query(
        "SELECT id FROM users WHERE email = $1",
        [email]
      );
      if (userExists.rows.length > 0) {
        return res.status(400).json({ error: "User already exists" });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const newUser = await pool.query(
        "INSERT INTO users (email, password_hash, first_name, last_name, role, hospital_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name, role, hospital_id",
        [
          email,
          passwordHash,
          firstName,
          lastName,
          role,
          req.body.hospitalId || 1,
        ] // Default to hospital 1 if not specified
      );

      // Generate JWT token
      const token = jwt.sign(
        { userId: newUser.rows[0].id, role: newUser.rows[0].role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );

      res.status(201).json({
        message: "User created successfully",
        token,
        user: newUser.rows[0],
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// Login user
router.post(
  "/login",
  [body("email").isEmail().normalizeEmail(), body("password").exists()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log("Validation errors:", errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      console.log("Login attempt:", { email, password }); // DEBUG

      // Find user
      const user = await pool.query("SELECT * FROM users WHERE email = $1", [
        email,
      ]);
      console.log("User found:", user.rows.length > 0); // DEBUG

      if (user.rows.length === 0) {
        console.log("No user found with email:", email); // DEBUG
        return res.status(400).json({ error: "Invalid credentials" });
      }

      console.log("Stored password hash:", user.rows[0].password_hash); // DEBUG
      console.log("Attempting to compare with password:", password); // DEBUG

      // Check password
      const validPassword = await bcrypt.compare(
        password,
        user.rows[0].password_hash
      );
      console.log("Password valid:", validPassword); // DEBUG

      if (!validPassword) {
        console.log("Password comparison failed"); // DEBUG
        return res.status(400).json({ error: "Invalid credentials" });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.rows[0].id, role: user.rows[0].role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );

      res.json({
        message: "Login successful",
        token,
        user: {
          id: user.rows[0].id,
          email: user.rows[0].email,
          firstName: user.rows[0].first_name,
          lastName: user.rows[0].last_name,
          role: user.rows[0].role,
          hospital_id: user.rows[0].hospital_id, // ADD THIS LINE
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
);

module.exports = router;
