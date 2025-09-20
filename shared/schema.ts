import { sql } from "drizzle-orm";
import { 
  pgTable, 
  serial, 
  varchar, 
  text, 
  date, 
  boolean, 
  timestamp,
  integer,
  jsonb,
  decimal,
  index
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for HR authentication and RBAC
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("hr"),
  createdAt: timestamp("created_at").defaultNow()
});

// Core Employees table
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  firstName: varchar("first_name", { length: 50 }).notNull(),
  middleName: varchar("middle_name", { length: 50 }),
  lastName: varchar("last_name", { length: 50 }).notNull(),
  dateOfBirth: date("date_of_birth"),
  personalEmail: varchar("personal_email", { length: 100 }).unique(),
  workEmail: varchar("work_email", { length: 100 }).unique().notNull(),
  cellPhone: varchar("cell_phone", { length: 20 }),
  workPhone: varchar("work_phone", { length: 20 }),
  homeAddress1: varchar("home_address1", { length: 100 }),
  homeAddress2: varchar("home_address2", { length: 100 }),
  homeCity: varchar("home_city", { length: 50 }),
  homeState: varchar("home_state", { length: 50 }),
  homeZip: varchar("home_zip", { length: 10 }),
  gender: varchar("gender", { length: 20 }),
  birthCity: varchar("birth_city", { length: 50 }),
  birthState: varchar("birth_state", { length: 50 }),
  birthCountry: varchar("birth_country", { length: 50 }),
  driversLicenseNumber: varchar("drivers_license_number", { length: 50 }),
  dlStateIssued: varchar("dl_state_issued", { length: 50 }),
  dlIssueDate: date("dl_issue_date"),
  dlExpirationDate: date("dl_expiration_date"),
  ssn: varchar("ssn", { length: 20 }), // Will be encrypted
  npiNumber: varchar("npi_number", { length: 20 }).unique(),
  enumerationDate: date("enumeration_date"),
  jobTitle: varchar("job_title", { length: 100 }),
  workLocation: varchar("work_location", { length: 100 }),
  qualification: text("qualification"),
  medicalLicenseNumber: varchar("medical_license_number", { length: 50 }),
  substanceUseLicenseNumber: varchar("substance_use_license_number", { length: 50 }),
  substanceUseQualification: text("substance_use_qualification"),
  mentalHealthLicenseNumber: varchar("mental_health_license_number", { length: 50 }),
  mentalHealthQualification: text("mental_health_qualification"),
  medicaidNumber: varchar("medicaid_number", { length: 50 }),
  medicarePtanNumber: varchar("medicare_ptan_number", { length: 50 }),
  caqhProviderId: varchar("caqh_provider_id", { length: 50 }),
  caqhIssueDate: date("caqh_issue_date"),
  caqhLastAttestationDate: date("caqh_last_attestation_date"),
  caqhEnabled: boolean("caqh_enabled").default(false),
  caqhReattestationDueDate: date("caqh_reattestation_due_date"),
  caqhLoginId: varchar("caqh_login_id", { length: 50 }),
  caqhPassword: varchar("caqh_password", { length: 100 }), // Will be encrypted
  nppesLoginId: varchar("nppes_login_id", { length: 50 }),
  nppesPassword: varchar("nppes_password", { length: 100 }), // Will be encrypted
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  workEmailIdx: index("idx_employees_work_email").on(table.workEmail),
  dlExpirationIdx: index("idx_dl_expiration").on(table.dlExpirationDate),
  caqhReattestationIdx: index("idx_caqh_reattestation").on(table.caqhReattestationDueDate)
}));

// Education history
export const educations = pgTable("educations", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  educationType: varchar("education_type", { length: 50 }),
  schoolInstitution: varchar("school_institution", { length: 100 }),
  degree: varchar("degree", { length: 50 }),
  specialtyMajor: varchar("specialty_major", { length: 100 }),
  startDate: date("start_date"),
  endDate: date("end_date")
});

// Employment history
export const employments = pgTable("employments", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  employer: varchar("employer", { length: 100 }),
  position: varchar("position", { length: 100 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  description: text("description")
});

// Peer references
export const peerReferences = pgTable("peer_references", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  referenceName: varchar("reference_name", { length: 100 }),
  contactInfo: varchar("contact_info", { length: 100 }),
  relationship: varchar("relationship", { length: 100 }),
  comments: text("comments")
});

// State licenses
export const stateLicenses = pgTable("state_licenses", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  licenseNumber: varchar("license_number", { length: 50 }).notNull(),
  state: varchar("state", { length: 50 }).notNull(),
  issueDate: date("issue_date"),
  expirationDate: date("expiration_date"),
  status: varchar("status", { length: 50 })
}, (table) => ({
  expirationIdx: index("idx_state_licenses_expiration").on(table.expirationDate)
}));

// DEA licenses
export const deaLicenses = pgTable("dea_licenses", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  licenseNumber: varchar("license_number", { length: 50 }).notNull(),
  issueDate: date("issue_date"),
  expirationDate: date("expiration_date"),
  status: varchar("status", { length: 50 })
}, (table) => ({
  expirationIdx: index("idx_dea_licenses_expiration").on(table.expirationDate)
}));

// Board certifications
export const boardCertifications = pgTable("board_certifications", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  boardName: varchar("board_name", { length: 100 }),
  certification: varchar("certification", { length: 100 }),
  issueDate: date("issue_date"),
  expirationDate: date("expiration_date"),
  status: varchar("status", { length: 50 })
}, (table) => ({
  expirationIdx: index("idx_board_certifications_expiration").on(table.expirationDate)
}));

// Documents
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  documentType: varchar("document_type", { length: 100 }).notNull(),
  filePath: varchar("file_path", { length: 255 }),
  signedDate: date("signed_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow()
});

// Emergency contacts
export const emergencyContacts = pgTable("emergency_contacts", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  relationship: varchar("relationship", { length: 50 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 100 })
});

// Tax forms
export const taxForms = pgTable("tax_forms", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  formType: varchar("form_type", { length: 50 }).notNull(),
  filePath: varchar("file_path", { length: 255 }),
  submittedDate: date("submitted_date"),
  status: varchar("status", { length: 50 })
});

// Trainings/CEUs
export const trainings = pgTable("trainings", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  trainingType: varchar("training_type", { length: 100 }),
  provider: varchar("provider", { length: 100 }),
  completionDate: date("completion_date"),
  expirationDate: date("expiration_date"),
  credits: decimal("credits", { precision: 5, scale: 2 }),
  certificatePath: varchar("certificate_path", { length: 255 })
}, (table) => ({
  expirationIdx: index("idx_trainings_expiration").on(table.expirationDate)
}));

// Payer enrollments
export const payerEnrollments = pgTable("payer_enrollments", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  payerName: varchar("payer_name", { length: 100 }),
  enrollmentId: varchar("enrollment_id", { length: 50 }),
  enrollmentDate: date("enrollment_date"),
  status: varchar("status", { length: 50 })
});

// Incident logs
export const incidentLogs = pgTable("incident_logs", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  incidentDate: date("incident_date").notNull(),
  description: text("description"),
  resolution: text("resolution"),
  reportedBy: varchar("reported_by", { length: 50 })
});

// Audits table
export const audits = pgTable("audits", {
  id: serial("id").primaryKey(),
  tableName: varchar("table_name", { length: 50 }).notNull(),
  recordId: integer("record_id").notNull(),
  action: varchar("action", { length: 20 }).notNull(),
  changedBy: integer("changed_by").references(() => users.id),
  changedAt: timestamp("changed_at").defaultNow(),
  oldData: jsonb("old_data"),
  newData: jsonb("new_data")
}, (table) => ({
  tableRecordIdx: index("idx_audits_table_record").on(table.tableName, table.recordId),
  changedAtIdx: index("idx_audits_changed_at").on(table.changedAt)
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  audits: many(audits)
}));

export const employeesRelations = relations(employees, ({ many }) => ({
  educations: many(educations),
  employments: many(employments),
  peerReferences: many(peerReferences),
  stateLicenses: many(stateLicenses),
  deaLicenses: many(deaLicenses),
  boardCertifications: many(boardCertifications),
  documents: many(documents),
  emergencyContacts: many(emergencyContacts),
  taxForms: many(taxForms),
  trainings: many(trainings),
  payerEnrollments: many(payerEnrollments),
  incidentLogs: many(incidentLogs)
}));

export const educationsRelations = relations(educations, ({ one }) => ({
  employee: one(employees, { fields: [educations.employeeId], references: [employees.id] })
}));

export const employmentsRelations = relations(employments, ({ one }) => ({
  employee: one(employees, { fields: [employments.employeeId], references: [employees.id] })
}));

export const peerReferencesRelations = relations(peerReferences, ({ one }) => ({
  employee: one(employees, { fields: [peerReferences.employeeId], references: [employees.id] })
}));

export const stateLicensesRelations = relations(stateLicenses, ({ one }) => ({
  employee: one(employees, { fields: [stateLicenses.employeeId], references: [employees.id] })
}));

export const deaLicensesRelations = relations(deaLicenses, ({ one }) => ({
  employee: one(employees, { fields: [deaLicenses.employeeId], references: [employees.id] })
}));

export const boardCertificationsRelations = relations(boardCertifications, ({ one }) => ({
  employee: one(employees, { fields: [boardCertifications.employeeId], references: [employees.id] })
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  employee: one(employees, { fields: [documents.employeeId], references: [employees.id] })
}));

export const emergencyContactsRelations = relations(emergencyContacts, ({ one }) => ({
  employee: one(employees, { fields: [emergencyContacts.employeeId], references: [employees.id] })
}));

export const taxFormsRelations = relations(taxForms, ({ one }) => ({
  employee: one(employees, { fields: [taxForms.employeeId], references: [employees.id] })
}));

export const trainingsRelations = relations(trainings, ({ one }) => ({
  employee: one(employees, { fields: [trainings.employeeId], references: [employees.id] })
}));

export const payerEnrollmentsRelations = relations(payerEnrollments, ({ one }) => ({
  employee: one(employees, { fields: [payerEnrollments.employeeId], references: [employees.id] })
}));

export const incidentLogsRelations = relations(incidentLogs, ({ one }) => ({
  employee: one(employees, { fields: [incidentLogs.employeeId], references: [employees.id] })
}));

export const auditsRelations = relations(audits, ({ one }) => ({
  user: one(users, { fields: [audits.changedBy], references: [users.id] })
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  passwordHash: true,
  role: true
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertEducationSchema = createInsertSchema(educations).omit({ id: true });
export const insertEmploymentSchema = createInsertSchema(employments).omit({ id: true });
export const insertPeerReferenceSchema = createInsertSchema(peerReferences).omit({ id: true });
export const insertStateLicenseSchema = createInsertSchema(stateLicenses).omit({ id: true });
export const insertDeaLicenseSchema = createInsertSchema(deaLicenses).omit({ id: true });
export const insertBoardCertificationSchema = createInsertSchema(boardCertifications).omit({ id: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export const insertEmergencyContactSchema = createInsertSchema(emergencyContacts).omit({ id: true });
export const insertTaxFormSchema = createInsertSchema(taxForms).omit({ id: true });
export const insertTrainingSchema = createInsertSchema(trainings).omit({ id: true });
export const insertPayerEnrollmentSchema = createInsertSchema(payerEnrollments).omit({ id: true });
export const insertIncidentLogSchema = createInsertSchema(incidentLogs).omit({ id: true });
export const insertAuditSchema = createInsertSchema(audits).omit({ id: true, changedAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Education = typeof educations.$inferSelect;
export type InsertEducation = z.infer<typeof insertEducationSchema>;
export type Employment = typeof employments.$inferSelect;
export type InsertEmployment = z.infer<typeof insertEmploymentSchema>;
export type PeerReference = typeof peerReferences.$inferSelect;
export type InsertPeerReference = z.infer<typeof insertPeerReferenceSchema>;
export type StateLicense = typeof stateLicenses.$inferSelect;
export type InsertStateLicense = z.infer<typeof insertStateLicenseSchema>;
export type DeaLicense = typeof deaLicenses.$inferSelect;
export type InsertDeaLicense = z.infer<typeof insertDeaLicenseSchema>;
export type BoardCertification = typeof boardCertifications.$inferSelect;
export type InsertBoardCertification = z.infer<typeof insertBoardCertificationSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type EmergencyContact = typeof emergencyContacts.$inferSelect;
export type InsertEmergencyContact = z.infer<typeof insertEmergencyContactSchema>;
export type TaxForm = typeof taxForms.$inferSelect;
export type InsertTaxForm = z.infer<typeof insertTaxFormSchema>;
export type Training = typeof trainings.$inferSelect;
export type InsertTraining = z.infer<typeof insertTrainingSchema>;
export type PayerEnrollment = typeof payerEnrollments.$inferSelect;
export type InsertPayerEnrollment = z.infer<typeof insertPayerEnrollmentSchema>;
export type IncidentLog = typeof incidentLogs.$inferSelect;
export type InsertIncidentLog = z.infer<typeof insertIncidentLogSchema>;
export type Audit = typeof audits.$inferSelect;
export type InsertAudit = z.infer<typeof insertAuditSchema>;
