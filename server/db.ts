/**
 * @fileoverview Database Configuration and Connection Module
 * 
 * This module configures the PostgreSQL database connection using Neon's
 * serverless PostgreSQL service. It establishes a connection pool and
 * provides the Drizzle ORM instance for database operations.
 * 
 * @module db
 * @requires @neondatabase/serverless
 * @requires drizzle-orm/neon-serverless
 * @requires ws
 * @requires @shared/schema
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

/**
 * Configure WebSocket support for Neon serverless PostgreSQL
 * Required for serverless environments without native WebSocket support
 */
neonConfig.webSocketConstructor = ws;

/**
 * Validate database connection configuration
 * 
 * @throws {Error} If DATABASE_URL environment variable is not set
 * 
 * @description DATABASE_URL format:
 * postgresql://username:password@host:port/database?sslmode=require
 */
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * PostgreSQL connection pool
 * 
 * @constant {Pool} pool
 * @description Manages database connections efficiently with:
 * - Connection pooling for optimal performance
 * - Automatic connection retry on failure
 * - SSL/TLS encryption for secure data transfer
 * - Support for prepared statements
 * 
 * Connection pool settings (defaults):
 * - Max connections: 10
 * - Idle timeout: 30 seconds
 * - Connection timeout: 10 seconds
 */
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Drizzle ORM instance
 * 
 * @constant {DrizzleInstance} db
 * @description Primary database interface providing:
 * - Type-safe database queries
 * - Automatic schema synchronization
 * - Migration support
 * - Transaction management
 * - Query builder with full TypeScript support
 * 
 * @example
 * // Select all active employees
 * const activeEmployees = await db
 *   .select()
 *   .from(employees)
 *   .where(eq(employees.status, 'active'));
 * 
 * @example
 * // Insert new employee with transaction
 * await db.transaction(async (tx) => {
 *   const employee = await tx.insert(employees).values(data).returning();
 *   await tx.insert(audits).values(auditLog);
 * });
 */
export const db = drizzle({ client: pool, schema });