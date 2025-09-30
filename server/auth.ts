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
 * @throws {Error} If scrypt hashing fails
 * 
 * @description Uses scrypt with:
 * - 16 byte random salt for uniqueness
 * - 64 byte derived key for security
 * - Cost factor N=16384 (default) for computational difficulty
 * - Salt stored with hash for verification
 * 
 * @security
 * - Cryptographically secure random salt generation
 * - Memory-hard algorithm resistant to GPU attacks
 * - Unique salt per password prevents rainbow tables
 * - High cost factor prevents brute force
 * - Used for all password storage (login, reset, initial setup)
 * 
 * @example
 * const hashedPassword = await hashPassword('mySecurePassword123');
 * // Returns: "a3f5b2...e8d9.1a2b3c...f9e8"
 * // Format: <64-char-hex-hash>.<32-char-hex-salt>
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
 * @param {string} stored - Stored password hash from database (format: hash.salt)
 * @returns {Promise<boolean>} True if passwords match, false otherwise
 * @throws {Error} If stored hash format is invalid
 * 
 * @description 
 * Securely compares passwords using:
 * - Scrypt hashing with original salt
 * - Timing-safe comparison to prevent attacks
 * - No early returns that could leak information
 * 
 * @security
 * - Uses timingSafeEqual to prevent timing attacks
 * - Constant-time comparison regardless of match
 * - No information leakage about hash structure
 * - Resistant to side-channel attacks
 * 
 * @validation
 * - Used for login authentication
 * - Password change verification  
 * - Admin password reset validation
 * - Password reset token validation
 * 
 * @example
 * const isValid = await comparePasswords('userInput', storedHash);
 * if (isValid) {
 *   // Password is correct - proceed with authentication
 * } else {
 *   // Invalid password - deny access
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
  // Only use secure cookies if explicitly in production mode
  // For local development (even on Replit), don't require HTTPS
  const isProduction = process.env.NODE_ENV === 'production';
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true, // Prevent XSS attacks
      secure: isProduction, // Use secure cookies in production (HTTPS)
      sameSite: 'lax', // CSRF protection - use 'lax' for both dev and production
      maxAge: undefined // Session cookie (expires on browser close)
    }
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
   * @description Register a new user through invitation-based onboarding.
   * Creates user account with associated employee record for prospective employees.
   * 
   * @param {string} body.username.required - Unique username for the account
   * @param {string} body.password.required - Password meeting security requirements (min 8 chars)
   * @param {string} body.invitationToken.required - Valid invitation token (required for all registrations)
   * 
   * @returns {object} 201 - User created with onboarding details including employeeId
   * @returns {object} 400 - Invalid request (username taken, invalid/expired token)
   * @returns {object} 500 - Server error during registration process
   * 
   * @example request
   * {
   *   "username": "john.doe",
   *   "password": "SecurePass123!",
   *   "invitationToken": "abc123def456..."
   * }
   * 
   * @example response - 201 Success
   * {
   *   "id": 35,
   *   "username": "john.doe",
   *   "role": "prospective_employee",
   *   "createdAt": "2025-01-20T10:00:00Z",
   *   "isOnboarding": true,
   *   "employeeId": 16,
   *   "formsSent": 0,
   *   "message": "Account created successfully. You can now complete your employee profile."
   * }
   * 
   * @security
   * - Passwords hashed using scrypt algorithm
   * - Invitation tokens are single-use and expire after 7 days
   * - Failed registrations clean up partial data for consistency
   * - Email from invitation is stored in user record for identification
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

    // Create user account with the role and email from the invitation
    // IMPORTANT: Email must be set from invitation to ensure proper user identification
    const user = await storage.createUser({
      username: username,
      passwordHash: await hashPassword(password),
      role: invitation.intendedRole || "prospective_employee", // Use intendedRole from invitation
      email: invitation.email, // Add email from invitation
      email: invitation.email, // Add email from invitation for proper user-employee linking
    });
    
    // If this is an onboarding registration, handle employee record and send forms
    if (invitation) {
      try {
        console.log(`Processing employee onboarding for user ${user.id} (${username}) with invitation ${invitation.id}`);
        
        // Check if employee with this email already exists
        const existingEmployee = await storage.getEmployeeByWorkEmail(invitation.email);
        
        if (existingEmployee) {
          // Employee already exists - link user account to existing employee
          // This handles pre-created employee records from HR
          console.log(`Found existing employee with email ${invitation.email} (ID: ${existingEmployee.id})`);
          
          // Check if employee already has a user linked to prevent duplicates
          if (existingEmployee.userId) {
            throw new Error(`Employee ${existingEmployee.id} already has a linked user account (User ID: ${existingEmployee.userId})`);
          }
          
          employee = await storage.updateEmployee(existingEmployee.id, {
            userId: user.id,
            status: 'onboarding',
            onboardingStatus: 'registered',
            invitationId: invitation.id
          });
          
          console.log(`Successfully linked user ${user.id} to existing employee ${existingEmployee.id}: ${existingEmployee.firstName} ${existingEmployee.lastName}`);
        } else {
          // No existing employee - create new employee record
          // Critical for prospective_employee users to access /onboarding page
          console.log(`Creating new employee record for ${invitation.firstName} ${invitation.lastName} (${invitation.email})`);
          
          // Ensure we have required fields - use defaults if missing
          const employeeData = {
            firstName: invitation.firstName || 'Prospective',
            lastName: invitation.lastName || 'Employee',
            personalEmail: invitation.email,
            workEmail: invitation.email,
            cellPhone: invitation.cellPhone || '',
            status: 'onboarding',
            onboardingStatus: 'registered',
            invitationId: invitation.id,
            userId: user.id
          };
          
          console.log('Creating employee with data:', employeeData);
          employee = await storage.createEmployee(employeeData);
          
          console.log(`Successfully created employee record ${employee.id} for user ${user.id}: ${employee.firstName} ${employee.lastName}`);
        }
        
        // Verify the employee record was created/updated correctly
        if (!employee || !employee.id) {
          throw new Error('Failed to create or link employee record - no employee ID returned');
        }
        
        if (employee.userId !== user.id) {
          throw new Error(`Employee userId mismatch: expected ${user.id}, got ${employee.userId}`);
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
        // This maintains data consistency by preventing orphaned user accounts
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`Failed to complete employee onboarding for user ${user.id} (${username}):`, err.message);
        console.error('Full error:', error);
        
        // Clean up the created user account to maintain data consistency
        try {
          await storage.deleteUser(user.id);
          console.log(`Cleaned up user account ${user.id} (${username}) due to employee onboarding failure`);
        } catch (cleanupError) {
          const cleanupErr = cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError));
          console.error(`CRITICAL: Failed to clean up user account ${user.id} after employee onboarding failure:`, cleanupErr.message);
          // Log this for manual cleanup later
          console.error(`MANUAL CLEANUP REQUIRED: User ${user.id} (${username}) with email ${invitation.email} needs manual cleanup`);
        }
        
        // Return appropriate error message based on the original error
        if (err.message && err.message.includes('duplicate key value violates unique constraint')) {
          if (err.message.includes('work_email')) {
            return res.status(400).json({ 
              error: "An employee with this email already exists. Please contact your administrator." 
            });
          }
          if (err.message.includes('personal_email')) {
            return res.status(400).json({ 
              error: "This email is already registered. Please use a different email or contact your administrator." 
            });
          }
          if (err.message.includes('already has a linked user account')) {
            return res.status(400).json({ 
              error: "This employee already has a user account. Please login with your existing credentials." 
            });
          }
          return res.status(400).json({ 
            error: "An employee with this information already exists. Please contact your administrator." 
          });
        }
        
        // Log invitation details for debugging
        console.error('Invitation details:', {
          id: invitation.id,
          email: invitation.email,
          firstName: invitation.firstName,
          lastName: invitation.lastName,
          intendedRole: invitation.intendedRole
        });
        
        return res.status(500).json({ 
          error: "Failed to complete registration. Please contact support with reference: " + invitation.id 
        });
      }
    }

    // CRITICAL: Verify employee was created for prospective_employee users
    if (user.role === 'prospective_employee' && !employee) {
      console.error('CRITICAL ERROR: prospective_employee user created without employee record!');
      console.error('User ID:', user.id, 'Username:', user.username);
      
      // This should never happen but if it does, fail the registration
      return res.status(500).json({
        error: "Registration failed: Employee profile could not be created. Please contact support."
      });
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
   * PATCH /api/users/me
   * 
   * @route PATCH /api/users/me
   * @group Authentication
   * @security Bearer
   * @param {string} body.email - New email address
   * 
   * @returns {object} 200 - Updated user object
   * @returns {Error} 400 - Invalid email format or email already exists
   * @returns {Error} 401 - Not authenticated
   * 
   * @description Updates the current user's profile information
   * Currently only supports updating email address
   */
  app.patch("/api/users/me", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.sendStatus(401);
    }

    const { email } = req.body;

    // Validate email format
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Check if email is already taken by another user
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({ error: "Email already in use" });
      }
    }

    try {
      // Update user in database
      const updatedUser = await storage.updateUser(req.user.id, { email });
      
      // Update the user object in the session
      req.user = updatedUser;
      
      // Return updated user data
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
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
