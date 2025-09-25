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
export async function hashPassword(password: string) {
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
export async function comparePasswords(supplied: string, stored: string) {
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
      console.log(`Authentication attempt for username: ${username}`);
      
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        console.log(`Authentication failed: User '${username}' not found`);
        return done(null, false);
      }
      
      const passwordMatch = await comparePasswords(password, user.passwordHash);
      
      if (!passwordMatch) {
        console.log(`Authentication failed: Invalid password for user '${username}'`);
        return done(null, false);
      }
      
      console.log(`Authentication successful for user '${username}' (ID: ${user.id}, Role: ${user.role})`);
      return done(null, user);
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
   * @param {string} body.invitationToken - Invitation token for employee onboarding
   * 
   * @returns {object} 201 - Created user object with onboarding info
   * @returns {string} 400 - Username already exists or invalid invitation
   * 
   * @example request
   * {
   *   "username": "john.doe",
   *   "password": "SecurePass123!",
   *   "role": "hr",
   *   "invitationToken": "abc123..."
   * }
   * 
   * @example response - 201
   * {
   *   "id": 1,
   *   "username": "john.doe",
   *   "role": "hr",
   *   "createdAt": "2024-01-20T10:00:00Z",
   *   "isOnboarding": true,
   *   "formsSent": 3,
   *   "message": "Account created successfully. Onboarding forms have been sent to your email."
   * }
   */
  app.post("/api/register", async (req, res, next) => {
    const { username, password, invitationToken } = req.body;
    
    // Invitation token is now required
    if (!invitationToken) {
      return res.status(400).json({ error: "Registration requires an invitation. Please contact your administrator." });
    }
    
    // Check if username already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }

    let invitation = null;
    let employee = null;
    let formsSent = 0;
    let isOnboarding = false;
    
    // Validate invitation token
    invitation = await storage.getInvitationByToken(invitationToken);
    
    if (!invitation) {
      return res.status(400).json({ error: "Invalid invitation token" });
    }
    
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: "This invitation has already been used or has expired" });
    }
    
    // Check if invitation has expired
    if (new Date(invitation.expiresAt) < new Date()) {
      await storage.updateInvitation(invitation.id, { status: 'expired' });
      return res.status(400).json({ error: "This invitation has expired" });
    }
    
    isOnboarding = true;

    // Create user account with the role specified in the invitation
    const user = await storage.createUser({
      username: username,
      passwordHash: await hashPassword(password),
      role: invitation.intendedRole || "viewer", // Use intendedRole from invitation
    });
    
    // If this is an onboarding registration, handle employee record and send forms
    if (invitation) {
      try {
        // Check if employee with this email already exists
        const existingEmployee = await storage.getEmployeeByWorkEmail(invitation.email);
        
        if (existingEmployee) {
          // Employee already exists - link user account to existing employee
          employee = await storage.updateEmployee(existingEmployee.id, {
            userId: user.id,
            status: 'onboarding',
            onboardingStatus: 'registered',
            invitationId: invitation.id
          });
          
          console.log(`Linked user account to existing employee: ${existingEmployee.firstName} ${existingEmployee.lastName} (ID: ${existingEmployee.id})`);
        } else {
          // No existing employee - create new employee record
          employee = await storage.createEmployee({
            firstName: invitation.firstName,
            lastName: invitation.lastName,
            personalEmail: invitation.email,
            workEmail: invitation.email,
            cellPhone: invitation.cellPhone,
            status: 'onboarding',
            onboardingStatus: 'registered',
            invitationId: invitation.id,
            userId: user.id
          });
          
          console.log(`Created new employee record: ${employee.firstName} ${employee.lastName} (ID: ${employee.id})`);
        }
        
        // Update invitation status
        await storage.updateInvitation(invitation.id, {
          status: 'registered',
          registeredAt: new Date(),
          employeeId: employee.id
        });
        
        // Try to send DocuSeal onboarding forms
        try {
          const { docuSealService } = await import('./services/docusealService');
          
          // Initialize DocuSeal service
          const initialized = await docuSealService.initialize();
          
          if (initialized) {
            // Send onboarding forms
            const submissions = await docuSealService.sendOnboardingForms(
              invitation.id,
              employee.id,
              user.id
            );
            
            formsSent = submissions.length;
            
            // Update invitation with form status
            await storage.updateInvitation(invitation.id, {
              status: formsSent > 0 ? 'in_progress' : 'registered'
            });
            
            console.log(`Sent ${formsSent} onboarding forms to ${invitation.email}`);
          } else {
            console.log("DocuSeal not configured - skipping form sending");
          }
        } catch (error) {
          // Log error but don't fail registration
          console.error("Failed to send onboarding forms:", error);
        }
      } catch (error) {
        // If employee linking/creation fails, clean up user and return error
        console.error("Failed to complete employee onboarding:", error);
        
        // Clean up the created user account to maintain data consistency
        try {
          await storage.deleteUser(user.id);
          console.log(`Cleaned up user account ${user.id} due to employee onboarding failure`);
        } catch (cleanupError) {
          const cleanupErr = cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError));
          console.error("Failed to clean up user account after employee onboarding failure:", cleanupErr.message);
        }
        
        // Return appropriate error message based on the original error
        const err = error instanceof Error ? error : new Error(String(error));
        if (err.message && err.message.includes('duplicate key value violates unique constraint')) {
          return res.status(400).json({ 
            error: "An employee with this email already has a user account. Please contact your administrator." 
          });
        }
        
        return res.status(500).json({ 
          error: "Failed to complete registration. Please contact support." 
        });
      }
    }

    // Log the user in
    req.login(user, (err) => {
      if (err) return next(err);
      
      const response: any = {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        isOnboarding: isOnboarding
      };
      
      if (isOnboarding) {
        response.employeeId = employee?.id;
        response.formsSent = formsSent;
        response.message = formsSent > 0 
          ? `Account created successfully. ${formsSent} onboarding form(s) have been sent to ${invitation.email}. Please check your email to complete them.`
          : "Account created successfully. You can now complete your employee profile.";
      }
      
      res.status(201).json(response);
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
    // Include requirePasswordChange flag in the response
    const userResponse = {
      ...req.user,
      requirePasswordChange: req.user?.requirePasswordChange || false
    };
    res.status(200).json(userResponse);
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
    // Include requirePasswordChange flag in the response
    const userResponse = {
      ...req.user,
      requirePasswordChange: req.user?.requirePasswordChange || false
    };
    res.json(userResponse);
  });

  /**
   * POST /api/change-password
   * 
   * @route POST /api/change-password
   * @group Authentication
   * @security Bearer
   * @param {string} body.currentPassword.required - Current password
   * @param {string} body.newPassword.required - New password
   * 
   * @returns {object} 200 - Password changed successfully
   * @returns {Error} 400 - Invalid current password or validation error
   * @returns {Error} 401 - Not authenticated
   * 
   * @description Changes the user's password and sets requirePasswordChange to false
   */
  app.post("/api/change-password", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters long" });
    }
    
    try {
      // Verify current password
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const isValidPassword = await comparePasswords(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
      
      // Update password and set requirePasswordChange to false
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(user.id, {
        passwordHash: hashedPassword,
        requirePasswordChange: false
      });
      
      // Update the session user object
      req.user.requirePasswordChange = false;
      
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });
}
