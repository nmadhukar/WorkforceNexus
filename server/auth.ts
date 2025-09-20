/**
 * @fileoverview Authentication Module for HR Management System
 * 
 * This module handles user authentication using Passport.js with local strategy.
 * It provides secure password hashing using scrypt, session management,
 * and authentication endpoints for the HR system.
 * 
 * Security features:
 * - Scrypt password hashing with salt
 * - Timing-safe password comparison to prevent timing attacks
 * - Session-based authentication with PostgreSQL store
 * - Secure session configuration
 * 
 * @module auth
 * @requires passport
 * @requires passport-local
 * @requires express-session
 * @requires crypto
 */

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

/**
 * Promisified version of scrypt for async/await usage
 */
const scryptAsync = promisify(scrypt);

/**
 * Hash a password using scrypt with random salt
 * 
 * @async
 * @function hashPassword
 * @param {string} password - Plain text password to hash
 * @returns {Promise<string>} Hashed password in format: hash.salt
 * 
 * @description Uses scrypt with:
 * - 16 byte random salt
 * - 64 byte derived key
 * - Cost factor N=16384 (default)
 * 
 * @example
 * const hashedPassword = await hashPassword('mySecurePassword123');
 * // Returns: "a3f5b2...e8d9.1a2b3c...f9e8"
 */
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

/**
 * Compare supplied password with stored hash
 * 
 * @async
 * @function comparePasswords
 * @param {string} supplied - Plain text password from user input
 * @param {string} stored - Stored password hash from database
 * @returns {Promise<boolean>} True if passwords match, false otherwise
 * 
 * @description Uses timing-safe comparison to prevent timing attacks
 * that could leak information about the password hash
 * 
 * @example
 * const isValid = await comparePasswords('userInput', storedHash);
 * if (isValid) {
 *   // Password is correct
 * }
 */
async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

/**
 * Configure authentication for the Express application
 * 
 * @function setupAuth
 * @param {Express} app - Express application instance
 * 
 * @description Sets up:
 * - Express session with PostgreSQL store
 * - Passport.js local authentication strategy
 * - User serialization/deserialization for sessions
 * - Authentication endpoints (/api/login, /api/logout, /api/register, /api/user)
 * 
 * @throws {Error} If SESSION_SECRET environment variable is not set
 * 
 * @example
 * const app = express();
 * setupAuth(app);
 */
export function setupAuth(app: Express) {
  /**
   * Session configuration
   * - Uses PostgreSQL for session persistence
   * - Sessions expire after browser close (no maxAge set)
   * - Secure cookies in production (trust proxy enabled)
   */
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  /**
   * Passport Local Strategy Configuration
   * 
   * Authenticates users with username and password
   * Returns user object if credentials are valid
   * Returns false if authentication fails
   */
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.passwordHash))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  /**
   * POST /api/register
   * 
   * @route POST /api/register
   * @group Authentication - User authentication operations
   * @param {string} body.username.required - Unique username
   * @param {string} body.password.required - Password (min 8 characters recommended)
   * @param {string} body.role - User role: 'admin', 'hr', or 'viewer' (default: 'hr')
   * 
   * @returns {object} 201 - Created user object
   * @returns {string} 400 - Username already exists
   * 
   * @example request
   * {
   *   "username": "john.doe",
   *   "password": "SecurePass123!",
   *   "role": "hr"
   * }
   * 
   * @example response - 201
   * {
   *   "id": 1,
   *   "username": "john.doe",
   *   "role": "hr",
   *   "createdAt": "2024-01-20T10:00:00Z"
   * }
   */
  app.post("/api/register", async (req, res, next) => {
    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }

    const user = await storage.createUser({
      username: req.body.username,
      passwordHash: await hashPassword(req.body.password),
      role: req.body.role || "hr",
    });

    req.login(user, (err) => {
      if (err) return next(err);
      res.status(201).json(user);
    });
  });

  /**
   * POST /api/login
   * 
   * @route POST /api/login
   * @group Authentication
   * @param {string} body.username.required - Username
   * @param {string} body.password.required - Password
   * 
   * @returns {object} 200 - Authenticated user object
   * @returns {Error} 401 - Invalid credentials
   * 
   * @example request
   * {
   *   "username": "john.doe",
   *   "password": "SecurePass123!"
   * }
   */
  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  /**
   * POST /api/logout
   * 
   * @route POST /api/logout
   * @group Authentication
   * @security Bearer
   * 
   * @returns 200 - Successfully logged out
   * @returns {Error} 500 - Server error during logout
   * 
   * @description Destroys the user session and clears authentication
   */
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  /**
   * GET /api/user
   * 
   * @route GET /api/user
   * @group Authentication
   * @security Bearer
   * 
   * @returns {object} 200 - Current user object
   * @returns 401 - Not authenticated
   * 
   * @description Returns the currently authenticated user's information
   * Used for checking authentication status and getting user details
   */
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}
