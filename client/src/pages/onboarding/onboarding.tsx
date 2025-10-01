import { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, FormProvider, useFormContext, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MainLayout } from "@/components/layout/main-layout";
import { EmployeeDocumentsSubmission } from "@/components/forms/employee-documents-submission";
import { EmployeeForms } from "@/components/forms/employee-forms";
import { EmployeeReview } from "@/components/forms/employee-review";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ClipboardList, CheckCircle, Save, FileText, AlertTriangle, Plus, Trash2, GraduationCap, Briefcase, Shield, Award, Users, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

/**
 * @fileoverview Employee Onboarding Wizard Component
 * 
 * A comprehensive 12-step onboarding form for prospective healthcare employees.
 * Implements a config-driven wizard with step-level validation, auto-save drafts,
 * and atomic submission with nested entity management.
 * 
 * **Architecture:**
 * - Config-driven: Steps defined in configuration array with titles and icons
 * - Step-level validation: Each step has its own Zod schema for granular validation
 * - Dual validation strategy: Strict validation for navigation, relaxed for draft saves
 * - FormProvider: React Hook Form context for managing complex nested forms
 * - Auto-save: Automatic draft saves on step navigation
 * - Transaction atomicity: All related entities saved in single backend transaction
 * 
 * @module OnboardingPage
 * @requires react-hook-form
 * @requires zod
 * @requires @tanstack/react-query
 */

/**
 * Step-level Zod Validation Schemas
 * 
 * WHY STEP-LEVEL SCHEMAS?
 * - Allows users to navigate to any step and save progress
 * - Provides immediate, focused feedback on current step only
 * - Prevents "validation fatigue" from showing errors on incomplete steps
 * - Enables conditional validation based on context (draft vs. submission)
 * 
 * VALIDATION STRATEGY:
 * - Navigation: Validates current step only (blocks if invalid)
 * - Draft Save: Bypasses validation (allows partial/incomplete data)
 * - Final Submit: Validates all required fields across all steps
 * 
 * Each schema uses:
 * - `.min(1)` for required fields
 * - `.optional()` for optional fields
 * - `.refine()` for custom validation logic
 * - Clear error messages for user guidance
 */

// Step 1: Personal Information
// Required fields: firstName, lastName, dateOfBirth, ssn, personalEmail, cellPhone
// WHY: These are the minimum fields needed to create an employee record
const step1Schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.string().optional(),
  ssn: z.string().min(1, "SSN is required"),
  personalEmail: z.string().min(1, "Personal email is required").email("Invalid email address"),
  workEmail: z.string().optional().refine(
    (val) => !val || z.string().email().safeParse(val).success,
    "Invalid email address"
  ),
  cellPhone: z.string().min(1, "Cell phone is required").regex(/^[\d\s\-\(\)\+]*$/, "Invalid phone number format"),
  workPhone: z.string().optional(),
});

// Step 2: Professional Information
const step2Schema = z.object({
  jobTitle: z.string().min(1, "Job title is required"),
  workLocation: z.string().min(1, "Work location is required"),
  status: z.string().optional().default("active"),
  npiNumber: z.string().optional().refine(
    (val) => !val || val.length === 0 || /^\d{10}$/.test(val),
    "NPI number must be exactly 10 digits"
  ),
  enumerationDate: z.string().optional(),
  qualification: z.string().optional(),
});

// Step 3: Address Information
const step3Schema = z.object({
  homeAddress1: z.string().optional(),
  homeAddress2: z.string().optional(),
  homeCity: z.string().optional(),
  homeState: z.string().optional(),
  homeZip: z.string().optional(),
  medicalLicenseNumber: z.string().optional(),
  substanceUseLicenseNumber: z.string().optional(),
  mentalHealthLicenseNumber: z.string().optional(),
  substanceUseQualification: z.string().optional(),
  mentalHealthQualification: z.string().optional(),
  medicaidNumber: z.string().optional(),
  medicarePtanNumber: z.string().optional(),
  caqhProviderId: z.string().optional(),
  caqhIssueDate: z.string().optional(),
  caqhLastAttestationDate: z.string().optional(),
  caqhReattestationDueDate: z.string().optional(),
  caqhEnabled: z.boolean().optional().default(false),
});

// Step 4: Education History
const educationItemSchema = z.object({
  educationType: z.string().min(1, "Education type is required"),
  schoolInstitution: z.string().min(1, "School/Institution is required"),
  degree: z.string().min(1, "Degree is required"),
  specialtyMajor: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const step4Schema = z.object({
  educations: z.array(educationItemSchema).min(1, "At least one education entry is required"),
});

// Step 5: Employment History
const employmentItemSchema = z.object({
  employer: z.string().min(1, "Employer is required"),
  position: z.string().min(1, "Position is required"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
});

const step5Schema = z.object({
  employments: z.array(employmentItemSchema).min(0),
});

// Step 6: State Licenses
const stateLicenseItemSchema = z.object({
  licenseNumber: z.string().min(1, "License number is required"),
  state: z.string().min(1, "State is required"),
  issueDate: z.string().optional(),
  expirationDate: z.string().optional(),
  status: z.string().optional(),
});

const step6Schema = z.object({
  stateLicenses: z.array(stateLicenseItemSchema).min(0),
});

// Step 7: DEA & Certifications
const deaLicenseItemSchema = z.object({
  licenseNumber: z.string().min(1, "DEA license number is required"),
  state: z.string().optional(),
  issueDate: z.string().optional(),
  expirationDate: z.string().optional(),
});

const boardCertItemSchema = z.object({
  certification: z.string().min(1, "Certification name is required"),
  boardName: z.string().optional(),
  issueDate: z.string().optional(),
  expirationDate: z.string().optional(),
});

const step7Schema = z.object({
  deaLicenses: z.array(deaLicenseItemSchema).min(0),
  boardCertifications: z.array(boardCertItemSchema).min(0),
});

// Step 8: References & Emergency Contacts
const peerRefItemSchema = z.object({
  referenceName: z.string().min(1, "Reference name is required"),
  contactInfo: z.string().min(1, "Contact information is required"),
  relationship: z.string().optional(),
  comments: z.string().optional(),
});

const emergencyContactItemSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  relationship: z.string().min(1, "Relationship is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().optional(),
});

const step8Schema = z.object({
  peerReferences: z.array(peerRefItemSchema).min(0),
  emergencyContacts: z.array(emergencyContactItemSchema).min(0),
});

// Step 10: Training & Payer Enrollment
const trainingItemSchema = z.object({
  trainingName: z.string().min(1, "Training name is required"),
  provider: z.string().optional(),
  completionDate: z.string().optional(),
  expirationDate: z.string().optional(),
});

const payerEnrollmentItemSchema = z.object({
  payerName: z.string().min(1, "Payer name is required"),
  providerId: z.string().optional(),
  effectiveDate: z.string().optional(),
  enrollmentStatus: z.string().optional(),
});

const step10Schema = z.object({
  trainings: z.array(trainingItemSchema).min(0),
  payerEnrollments: z.array(payerEnrollmentItemSchema).min(0),
});

// Complete form schema (union of all steps)
const completeFormSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Schema)
  .merge(step6Schema)
  .merge(step7Schema)
  .merge(step8Schema)
  .merge(step10Schema)
  .extend({
    // Document and forms metadata (managed by child components)
    documentUploads: z.array(z.any()).optional(),
    allRequiredDocumentsUploaded: z.boolean().optional(),
    uploadedRequiredCount: z.number().optional(),
    requiredDocumentsCount: z.number().optional(),
    allFormsCompleted: z.boolean().optional(),
    completedForms: z.number().optional(),
    totalRequiredForms: z.number().optional(),
    submissions: z.array(z.any()).optional(),
  });

type FormData = z.infer<typeof completeFormSchema>;

/**
 * ErrorBoundary Component
 * 
 * @component
 * @description
 * React Error Boundary for graceful error handling in the onboarding wizard.
 * Catches JavaScript errors in child component tree and displays fallback UI.
 * 
 * **Purpose:**
 * - Prevents full application crash from rendering errors
 * - Provides user-friendly error message with recovery option
 * - Logs detailed error information for debugging
 * 
 * **Error Handling Strategy:**
 * - `getDerivedStateFromError`: Updates state to trigger fallback UI
 * - `componentDidCatch`: Logs error details and invokes callback
 * - Fallback UI: Displays error card with reload button
 * 
 * WHY: The onboarding form is complex with many nested components and dynamic rendering.
 * Errors in one step shouldn't crash the entire onboarding experience. The ErrorBoundary
 * provides a safety net while preserving error information for debugging.
 * 
 * @example
 * <ErrorBoundary onError={(error) => console.error(error)}>
 *   <ComplexFormStep />
 * </ErrorBoundary>
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  onError: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {this.state.error?.message || 'An unexpected error occurred while loading the onboarding form.'}
              </p>
              <Button 
                onClick={() => window.location.reload()} 
                variant="default"
                data-testid="button-reload-after-error"
              >
                <FileText className="w-4 h-4 mr-2" />
                Reload Page
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * StepRenderer Component
 * 
 * @component
 * @description
 * Dynamically renders the appropriate form step based on step number.
 * Manages 12 different step configurations with varying complexity.
 * 
 * **Step Types:**
 * 
 * 1. **Simple Form Steps (1-3):**
 *    - Steps 1-3: Personal info, professional details, address
 *    - Use FormField components with Input/Select/Textarea
 *    - Direct validation via Zod schemas
 * 
 * 2. **Array-Based Steps (4-8, 10):**
 *    - Steps 4-8, 10: Education, employment, licenses, certifications, training
 *    - Use useFieldArray for dynamic add/remove functionality
 *    - Nested validation for each array item
 *    - WHY: Healthcare employees have multiple credentials that must be tracked separately
 * 
 * 3. **Child Component Steps (9, 11, 12):**
 *    - Step 9: EmployeeDocumentsSubmission (document uploads)
 *    - Step 11: EmployeeForms (DocuSeal form signing)
 *    - Step 12: EmployeeReview (final review before submission)
 *    - WHY: These steps have complex logic better encapsulated in separate components
 * 
 * **Data Flow:**
 * - Reads form data via useFormContext (from FormProvider)
 * - Updates are automatically synced to parent via React Hook Form
 * - Child components use updateFormData callback for non-standard fields
 * 
 * **Field Arrays (useFieldArray):**
 * - Manages dynamic lists (educations, employments, licenses, etc.)
 * - Provides add/remove functionality with proper React key tracking
 * - Each item tracks its ID for backend updates vs. inserts
 * - WHY: Allows users to add unlimited credentials during onboarding
 * 
 * @param {number} stepNumber - Current step number (1-12)
 * @param {Function} updateFormData - Callback to update form data for child components
 * @param {FormData} formData - Current form data state
 * @param {number} [onboardingId] - Employee ID for existing onboarding records
 */
interface StepRendererProps {
  stepNumber: number;
  updateFormData: (data: Partial<FormData>) => void;
  formData: FormData;
  onboardingId?: number;
}

function StepRenderer({ stepNumber, updateFormData, formData, onboardingId }: StepRendererProps) {
  const form = useFormContext<FormData>();

  if (stepNumber === 1) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter first name" data-testid="input-first-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="middleName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Middle Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter middle name" data-testid="input-middle-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter last name" data-testid="input-last-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dateOfBirth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Birth <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input {...field} type="date" data-testid="input-date-of-birth" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gender</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ssn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SSN <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input {...field} placeholder="XXX-XX-XXXX" maxLength={11} data-testid="input-ssn" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="personalEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Personal Email <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input {...field} type="email" placeholder="personal@email.com" data-testid="input-personal-email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="workEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Work Email</FormLabel>
                <FormControl>
                  <Input {...field} type="email" placeholder="work@hospital.com" data-testid="input-work-email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cellPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cell Phone <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input {...field} type="tel" placeholder="(555) 123-4567" data-testid="input-cell-phone" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="workPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Work Phone</FormLabel>
                <FormControl>
                  <Input {...field} type="tel" placeholder="(555) 123-4567" data-testid="input-work-phone" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    );
  }

  if (stepNumber === 2) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="jobTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Title <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter job title" data-testid="input-job-title" autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="workLocation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Work Location <span className="text-red-500">*</span></FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-work-location">
                      <SelectValue placeholder="Select work location" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Main Hospital">Main Hospital</SelectItem>
                    <SelectItem value="North Clinic">North Clinic</SelectItem>
                    <SelectItem value="South Clinic">South Clinic</SelectItem>
                    <SelectItem value="Emergency Department">Emergency Department</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employment Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="npiNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>NPI Number (Optional)</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Optional - 10 digit NPI number" maxLength={10} data-testid="input-npi-number" autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="enumerationDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Enumeration Date</FormLabel>
                <FormControl>
                  <Input {...field} type="date" data-testid="input-enumeration-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="qualification"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Qualifications</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Enter professional qualifications and certifications" rows={4} data-testid="textarea-qualification" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    );
  }

  if (stepNumber === 3) {
    const caqhEnabled = form.watch("caqhEnabled");
    
    useEffect(() => {
      if (caqhEnabled !== undefined) {
        form.trigger(["caqhProviderId"]);
      }
    }, [caqhEnabled]);

    return (
      <div className="space-y-6">
        {/* Address Information */}
        <div className="space-y-4">
          <h4 className="text-md font-semibold text-foreground">Home Address</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FormField
              control={form.control}
              name="homeAddress1"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Address Line 1</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="123 Main Street" data-testid="input-home-address1" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="homeAddress2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 2</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Apt, Suite, etc." data-testid="input-home-address2" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="homeCity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter city" data-testid="input-home-city" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="homeState"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter state" data-testid="input-home-state" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="homeZip"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ZIP Code</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="12345" data-testid="input-home-zip" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Medical Licenses */}
        <div className="space-y-4">
          <h4 className="text-md font-semibold text-foreground">
            Medical Licenses <span className="text-red-500">*</span>
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (At least one license number is required)
            </span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="medicalLicenseNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medical License Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter medical license number" data-testid="input-medical-license-number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="substanceUseLicenseNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Substance Use License Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter substance use license number" data-testid="input-substance-use-license-number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mentalHealthLicenseNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mental Health License Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter mental health license number" data-testid="input-mental-health-license-number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="substanceUseQualification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Substance Use Qualification</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Enter substance use qualifications" data-testid="textarea-substance-use-qualification" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mentalHealthQualification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mental Health Qualification</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Enter mental health qualifications" data-testid="textarea-mental-health-qualification" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Provider Numbers */}
        <div className="space-y-4">
          <h4 className="text-md font-semibold text-foreground">Provider Numbers</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="medicaidNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medicaid Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter Medicaid number" data-testid="input-medicaid-number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="medicarePtanNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medicare PTAN Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter Medicare PTAN number" data-testid="input-medicare-ptan-number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* CAQH Information */}
        <div className="space-y-4">
          <h4 className="text-md font-semibold text-foreground">CAQH Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="caqhProviderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    CAQH Provider ID
                    {caqhEnabled && <span className="text-red-500"> *</span>}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter CAQH Provider ID" data-testid="input-caqh-provider-id" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="caqhIssueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CAQH Issue Date</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" data-testid="input-caqh-issue-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="caqhLastAttestationDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Attestation Date</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" data-testid="input-caqh-last-attestation-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="caqhReattestationDueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Re-attestation Due Date</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" data-testid="input-caqh-reattestation-due-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="caqhEnabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-caqh-enabled"
                  />
                </FormControl>
                <FormLabel className="font-normal">CAQH Enabled</FormLabel>
              </FormItem>
            )}
          />
        </div>
      </div>
    );
  }

  if (stepNumber === 4) {
    const { fields, append, remove } = useFieldArray({
      control: form.control,
      name: "educations",
    });

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Education History <span className="text-red-500">*</span>
                </CardTitle>
                <CardDescription>At least one education entry is required</CardDescription>
              </div>
              <Button
                type="button"
                onClick={() => append({ educationType: "", schoolInstitution: "", degree: "", specialtyMajor: "", startDate: "", endDate: "" })}
                size="sm"
                data-testid="button-add-education"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Education
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fields.length === 0 ? (
              <p className="text-muted-foreground">No education records added</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Institution</TableHead>
                    <TableHead>Degree</TableHead>
                    <TableHead>Major</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id} data-testid={`row-education-${index}`}>
                      <TableCell>{form.watch(`educations.${index}.educationType`) || "-"}</TableCell>
                      <TableCell>{form.watch(`educations.${index}.schoolInstitution`) || "-"}</TableCell>
                      <TableCell>{form.watch(`educations.${index}.degree`) || "-"}</TableCell>
                      <TableCell>{form.watch(`educations.${index}.specialtyMajor`) || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => remove(index)}
                          data-testid={`button-delete-education-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {fields.map((field, index) => (
              <Card key={field.id} className="mt-4 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`educations.${index}.educationType`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Education Type <span className="text-red-500">*</span></FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid={`select-education-type-${index}`}>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="High School">High School</SelectItem>
                            <SelectItem value="Bachelor's">Bachelor's</SelectItem>
                            <SelectItem value="Master's">Master's</SelectItem>
                            <SelectItem value="Doctorate">Doctorate</SelectItem>
                            <SelectItem value="Certificate">Certificate</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`educations.${index}.schoolInstitution`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>School/Institution <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter school name" data-testid={`input-school-${index}`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`educations.${index}.degree`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Degree <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter degree" data-testid={`input-degree-${index}`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`educations.${index}.specialtyMajor`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Major/Specialty</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter major or specialty" data-testid={`input-major-${index}`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`educations.${index}.startDate`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid={`input-start-date-${index}`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`educations.${index}.endDate`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid={`input-end-date-${index}`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </Card>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stepNumber === 5) {
    const { fields, append, remove } = useFieldArray({
      control: form.control,
      name: "employments",
    });

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Employment History
                </CardTitle>
                <CardDescription>Add or manage work experience</CardDescription>
              </div>
              <Button
                type="button"
                onClick={() => append({ employer: "", position: "", startDate: "", endDate: "", description: "" })}
                size="sm"
                data-testid="button-add-employment"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Employment
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fields.length === 0 ? (
              <p className="text-muted-foreground">No employment records added</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employer</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id} data-testid={`row-employment-${index}`}>
                      <TableCell>{form.watch(`employments.${index}.employer`) || "-"}</TableCell>
                      <TableCell>{form.watch(`employments.${index}.position`) || "-"}</TableCell>
                      <TableCell>{form.watch(`employments.${index}.startDate`) || "-"}</TableCell>
                      <TableCell>{form.watch(`employments.${index}.endDate`) || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => remove(index)}
                          data-testid={`button-delete-employment-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {fields.map((field, index) => (
              <Card key={field.id} className="mt-4 p-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`employments.${index}.employer`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employer <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter employer name" data-testid={`input-employer-${index}`} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`employments.${index}.position`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Position <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter position" data-testid={`input-position-${index}`} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`employments.${index}.startDate`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" data-testid={`input-emp-start-date-${index}`} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`employments.${index}.endDate`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" data-testid={`input-emp-end-date-${index}`} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name={`employments.${index}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Describe responsibilities and achievements" data-testid={`input-description-${index}`} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </Card>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stepNumber === 6) {
    const { fields, append, remove } = useFieldArray({
      control: form.control,
      name: "stateLicenses",
    });

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  State Licenses
                </CardTitle>
                <CardDescription>Add or manage state professional licenses</CardDescription>
              </div>
              <Button
                type="button"
                onClick={() => append({ licenseNumber: "", state: "", issueDate: "", expirationDate: "", status: "" })}
                size="sm"
                data-testid="button-add-state-license"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add License
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fields.length === 0 ? (
              <p className="text-muted-foreground">No state licenses added</p>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium">License #{index + 1}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => remove(index)}
                        data-testid={`button-delete-state-license-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`stateLicenses.${index}.licenseNumber`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>License Number <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter license number" data-testid={`input-license-number-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`stateLicenses.${index}.state`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter state" data-testid={`input-state-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`stateLicenses.${index}.issueDate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issue Date</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" data-testid={`input-issue-date-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`stateLicenses.${index}.expirationDate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiration Date</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" data-testid={`input-expiration-date-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stepNumber === 7) {
    const { fields: deaFields, append: appendDea, remove: removeDea } = useFieldArray({
      control: form.control,
      name: "deaLicenses",
    });

    const { fields: certFields, append: appendCert, remove: removeCert } = useFieldArray({
      control: form.control,
      name: "boardCertifications",
    });

    return (
      <div className="space-y-6">
        {/* DEA Licenses */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  DEA Licenses
                </CardTitle>
                <CardDescription>Add or manage DEA licenses</CardDescription>
              </div>
              <Button
                type="button"
                onClick={() => appendDea({ licenseNumber: "", state: "", issueDate: "", expirationDate: "" })}
                size="sm"
                data-testid="button-add-dea"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add DEA
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {deaFields.length === 0 ? (
              <p className="text-muted-foreground">No DEA licenses added</p>
            ) : (
              <div className="space-y-4">
                {deaFields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium">DEA #{index + 1}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => removeDea(index)}
                        data-testid={`button-delete-dea-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`deaLicenses.${index}.licenseNumber`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>DEA Number <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter DEA number" data-testid={`input-dea-number-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`deaLicenses.${index}.state`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter state" data-testid={`input-dea-state-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`deaLicenses.${index}.issueDate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issue Date</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" data-testid={`input-dea-issue-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`deaLicenses.${index}.expirationDate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiration Date</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" data-testid={`input-dea-expiration-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Board Certifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Board Certifications
                </CardTitle>
                <CardDescription>Add or manage board certifications</CardDescription>
              </div>
              <Button
                type="button"
                onClick={() => appendCert({ certification: "", boardName: "", issueDate: "", expirationDate: "" })}
                size="sm"
                data-testid="button-add-certification"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Certification
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {certFields.length === 0 ? (
              <p className="text-muted-foreground">No board certifications added</p>
            ) : (
              <div className="space-y-4">
                {certFields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium">Certification #{index + 1}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => removeCert(index)}
                        data-testid={`button-delete-certification-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`boardCertifications.${index}.certification`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Certification Name <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter certification name" data-testid={`input-cert-name-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`boardCertifications.${index}.boardName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Board Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter board name" data-testid={`input-board-name-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`boardCertifications.${index}.issueDate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issue Date</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" data-testid={`input-cert-issue-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`boardCertifications.${index}.expirationDate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiration Date</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" data-testid={`input-cert-expiration-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stepNumber === 8) {
    const { fields: refFields, append: appendRef, remove: removeRef } = useFieldArray({
      control: form.control,
      name: "peerReferences",
    });

    const { fields: contactFields, append: appendContact, remove: removeContact } = useFieldArray({
      control: form.control,
      name: "emergencyContacts",
    });

    return (
      <div className="space-y-6">
        {/* Peer References */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Peer References
                </CardTitle>
                <CardDescription>Add or manage professional references</CardDescription>
              </div>
              <Button
                type="button"
                onClick={() => appendRef({ referenceName: "", contactInfo: "", relationship: "", comments: "" })}
                size="sm"
                data-testid="button-add-reference"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Reference
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {refFields.length === 0 ? (
              <p className="text-muted-foreground">No peer references added</p>
            ) : (
              <div className="space-y-4">
                {refFields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium">Reference #{index + 1}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => removeRef(index)}
                        data-testid={`button-delete-reference-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`peerReferences.${index}.referenceName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reference Name <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter reference name" data-testid={`input-ref-name-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`peerReferences.${index}.contactInfo`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Information <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Phone or email" data-testid={`input-ref-contact-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`peerReferences.${index}.relationship`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Relationship</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Supervisor, colleague, etc." data-testid={`input-ref-relationship-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`peerReferences.${index}.comments`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Comments</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Additional notes" data-testid={`input-ref-comments-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Emergency Contacts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Emergency Contacts
                </CardTitle>
                <CardDescription>Add or manage emergency contacts</CardDescription>
              </div>
              <Button
                type="button"
                onClick={() => appendContact({ name: "", relationship: "", phone: "", email: "" })}
                size="sm"
                data-testid="button-add-emergency-contact"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {contactFields.length === 0 ? (
              <p className="text-muted-foreground">No emergency contacts added</p>
            ) : (
              <div className="space-y-4">
                {contactFields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium">Contact #{index + 1}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => removeContact(index)}
                        data-testid={`button-delete-emergency-contact-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`emergencyContacts.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter contact name" data-testid={`input-contact-name-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`emergencyContacts.${index}.relationship`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Relationship <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Spouse, parent, etc." data-testid={`input-contact-relationship-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`emergencyContacts.${index}.phone`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input {...field} type="tel" placeholder="(555) 123-4567" data-testid={`input-contact-phone-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`emergencyContacts.${index}.email`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="contact@email.com" data-testid={`input-contact-email-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stepNumber === 9) {
    return (
      <EmployeeDocumentsSubmission
        data={formData}
        onChange={updateFormData}
        data-testid="step-documents-submission"
      />
    );
  }

  if (stepNumber === 10) {
    const { fields: trainingFields, append: appendTraining, remove: removeTraining } = useFieldArray({
      control: form.control,
      name: "trainings",
    });

    const { fields: payerFields, append: appendPayer, remove: removePayer } = useFieldArray({
      control: form.control,
      name: "payerEnrollments",
    });

    return (
      <div className="space-y-6">
        {/* Trainings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Training & Certifications
                </CardTitle>
                <CardDescription>Add or manage training records</CardDescription>
              </div>
              <Button
                type="button"
                onClick={() => appendTraining({ trainingName: "", provider: "", completionDate: "", expirationDate: "" })}
                size="sm"
                data-testid="button-add-training"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Training
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {trainingFields.length === 0 ? (
              <p className="text-muted-foreground">No training records added</p>
            ) : (
              <div className="space-y-4">
                {trainingFields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium">Training #{index + 1}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => removeTraining(index)}
                        data-testid={`button-delete-training-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`trainings.${index}.trainingName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Training Name <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter training name" data-testid={`input-training-name-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`trainings.${index}.provider`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Provider</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter provider name" data-testid={`input-training-provider-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`trainings.${index}.completionDate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Completion Date</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" data-testid={`input-training-completion-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`trainings.${index}.expirationDate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiration Date</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" data-testid={`input-training-expiration-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payer Enrollments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Payer Enrollments</CardTitle>
                <CardDescription>Add or manage payer enrollment records</CardDescription>
              </div>
              <Button
                type="button"
                onClick={() => appendPayer({ payerName: "", providerId: "", effectiveDate: "", enrollmentStatus: "" })}
                size="sm"
                data-testid="button-add-payer"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Enrollment
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {payerFields.length === 0 ? (
              <p className="text-muted-foreground">No payer enrollments added</p>
            ) : (
              <div className="space-y-4">
                {payerFields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium">Enrollment #{index + 1}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => removePayer(index)}
                        data-testid={`button-delete-payer-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`payerEnrollments.${index}.payerName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payer Name <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter payer name" data-testid={`input-payer-name-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`payerEnrollments.${index}.providerId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Provider ID</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter provider ID" data-testid={`input-provider-id-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`payerEnrollments.${index}.effectiveDate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Effective Date</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" data-testid={`input-effective-date-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`payerEnrollments.${index}.enrollmentStatus`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Enrollment Status</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Active, pending, etc." data-testid={`input-enrollment-status-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stepNumber === 11) {
    return (
      <EmployeeForms
        data={formData}
        onChange={updateFormData}
        onboardingId={onboardingId}
        data-testid="step-forms"
      />
    );
  }

  if (stepNumber === 12) {
    return (
      <EmployeeReview
        data={formData}
        data-testid="step-review"
      />
    );
  }

  return null;
}

/**
 * OnboardingPage - Main Onboarding Wizard Component
 * 
 * @component
 * @description
 * 12-step onboarding wizard for prospective healthcare employees.
 * Implements a sophisticated form management system with step-level validation,
 * auto-save drafts, transaction atomicity, and comprehensive error handling.
 * 
 * **Key Features:**
 * 
 * 1. **FormProvider Context (React Hook Form)**
 *    - Provides form state to all child components via context
 *    - Manages 50+ form fields + 9 nested entity arrays
 *    - Dynamic resolver: Changes validation schema based on current step
 *    - WHY: Centralizes form state management and enables step-level validation
 * 
 * 2. **Dual Validation Strategy**
 *    - **Save Draft**: Bypasses validation, allows incomplete data
 *      - Uses form.getValues() to get raw data without validation
 *      - WHY: Users should save progress anytime without field requirements
 *    - **Navigation**: Validates current step only before moving forward
 *      - Uses form.trigger() to validate specific step schema
 *      - Blocks navigation if validation fails
 *      - WHY: Prevents users from skipping required fields in completed steps
 *    - **Final Submit**: Requires all documents + forms complete
 *      - Checks allRequiredDocumentsUploaded flag
 *      - Checks allFormsCompleted flag
 *      - WHY: Ensures onboarding is fully complete before submission
 * 
 * 3. **Auto-Save on Navigation**
 *    - Automatically saves draft when user moves to next step
 *    - Only triggers if user has started filling data
 *    - WHY: Prevents data loss if user closes browser or loses connection
 * 
 * 4. **Step Configuration Array**
 *    - Defines all 12 steps with titles and progress indicators
 *    - Dynamic titles show completion status (e.g., "Documents ✓")
 *    - WHY: Makes it easy to add/remove/reorder steps in the future
 * 
 * 5. **Error Handling**
 *    - ErrorBoundary wraps entire component tree
 *    - Query error states for loading failures
 *    - Mutation error handling for save/submit failures
 *    - WHY: Provides graceful degradation and clear error messages
 * 
 * **Data Flow:**
 * ```
 * 1. User fills form fields → React Hook Form state
 * 2. User clicks Next → Validate current step schema
 * 3. If valid → Auto-save draft → Move to next step
 * 4. User clicks Save Draft → Bypass validation → Save to backend
 * 5. User clicks Submit → Validate completion → Submit for HR review
 * ```
 * 
 * **Transaction Atomicity:**
 * Backend save-draft endpoint wraps all operations in single transaction.
 * If any nested entity fails to save, entire operation rolls back.
 * WHY: Prevents partial data corruption across 10+ database tables.
 * 
 * @returns {JSX.Element} The complete onboarding wizard UI
 */
export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);

  // Check if user is prospective_employee
  useEffect(() => {
    if (user?.role !== "prospective_employee") {
      toast({
        title: "Access Denied",
        description: "This page is only accessible to prospective employees completing onboarding.",
        variant: "destructive"
      });
      navigate("/");
    }
  }, [user, navigate, toast]);

  // Fetch existing onboarding data
  const { data: existingOnboarding, isLoading: loadingOnboarding, error: onboardingError } = useQuery({
    queryKey: ["/api/onboarding/my-onboarding"],
    enabled: !!user && user.role === "prospective_employee",
    queryFn: async () => {
      const res = await fetch("/api/onboarding/my-onboarding", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) {
          return null;
        }
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch onboarding data' }));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }
      return res.json();
    },
    retry: (failureCount, error) => {
      if (error instanceof Error && 
          (error.message.includes('404') || error.message.includes('401'))) {
        return false;
      }
      return failureCount < 2;
    }
  });

  // Prepare default values from existing onboarding
  const defaultValues: FormData = {
    firstName: existingOnboarding?.firstName || "",
    lastName: existingOnboarding?.lastName || "",
    middleName: existingOnboarding?.middleName || "",
    dateOfBirth: existingOnboarding?.dateOfBirth ? existingOnboarding.dateOfBirth.split('T')[0] : "",
    gender: existingOnboarding?.gender || "",
    ssn: existingOnboarding?.ssn || "",
    personalEmail: existingOnboarding?.personalEmail || "",
    workEmail: existingOnboarding?.workEmail || user?.username || "",
    cellPhone: existingOnboarding?.cellPhone || "",
    workPhone: existingOnboarding?.workPhone || "",
    homeAddress1: existingOnboarding?.homeAddress1 || "",
    homeAddress2: existingOnboarding?.homeAddress2 || "",
    homeCity: existingOnboarding?.homeCity || "",
    homeState: existingOnboarding?.homeState || "",
    homeZip: existingOnboarding?.homeZip || "",
    jobTitle: existingOnboarding?.jobTitle || "",
    workLocation: existingOnboarding?.workLocation || "",
    status: existingOnboarding?.status || "active",
    npiNumber: existingOnboarding?.npiNumber || "",
    enumerationDate: existingOnboarding?.enumerationDate ? existingOnboarding.enumerationDate.split('T')[0] : "",
    qualification: existingOnboarding?.qualification || "",
    medicalLicenseNumber: existingOnboarding?.medicalLicenseNumber || "",
    substanceUseLicenseNumber: existingOnboarding?.substanceUseLicenseNumber || "",
    mentalHealthLicenseNumber: existingOnboarding?.mentalHealthLicenseNumber || "",
    substanceUseQualification: existingOnboarding?.substanceUseQualification || "",
    mentalHealthQualification: existingOnboarding?.mentalHealthQualification || "",
    medicaidNumber: existingOnboarding?.medicaidNumber || "",
    medicarePtanNumber: existingOnboarding?.medicarePtanNumber || "",
    caqhProviderId: existingOnboarding?.caqhProviderId || "",
    caqhIssueDate: existingOnboarding?.caqhIssueDate ? existingOnboarding.caqhIssueDate.split('T')[0] : "",
    caqhLastAttestationDate: existingOnboarding?.caqhLastAttestationDate ? existingOnboarding.caqhLastAttestationDate.split('T')[0] : "",
    caqhReattestationDueDate: existingOnboarding?.caqhReattestationDueDate ? existingOnboarding.caqhReattestationDueDate.split('T')[0] : "",
    caqhEnabled: existingOnboarding?.caqhEnabled || false,
    educations: existingOnboarding?.educations || [],
    employments: existingOnboarding?.employments || [],
    stateLicenses: existingOnboarding?.stateLicenses || [],
    deaLicenses: existingOnboarding?.deaLicenses || [],
    boardCertifications: existingOnboarding?.boardCertifications || [],
    peerReferences: existingOnboarding?.peerReferences || [],
    emergencyContacts: existingOnboarding?.emergencyContacts || [],
    trainings: existingOnboarding?.trainings || [],
    payerEnrollments: existingOnboarding?.payerEnrollments || [],
    documentUploads: existingOnboarding?.documentUploads || [],
    allRequiredDocumentsUploaded: existingOnboarding?.allRequiredDocumentsUploaded || false,
    uploadedRequiredCount: existingOnboarding?.uploadedRequiredCount || 0,
    requiredDocumentsCount: existingOnboarding?.requiredDocumentsCount || 0,
    allFormsCompleted: existingOnboarding?.allFormsCompleted || false,
    completedForms: existingOnboarding?.completedForms || 0,
    totalRequiredForms: existingOnboarding?.totalRequiredForms || 0,
    submissions: existingOnboarding?.submissions || [],
  };

  // Initialize react-hook-form with FormProvider
  const form = useForm<FormData>({
    resolver: zodResolver(
      currentStep === 1 ? step1Schema :
      currentStep === 2 ? step2Schema :
      currentStep === 3 ? step3Schema :
      currentStep === 4 ? step4Schema :
      currentStep === 5 ? step5Schema :
      currentStep === 6 ? step6Schema :
      currentStep === 7 ? step7Schema :
      currentStep === 8 ? step8Schema :
      currentStep === 10 ? step10Schema :
      z.object({}) // Steps 9, 11, 12 don't have validation (handled by child components)
    ),
    defaultValues,
    mode: "onChange",
  });

  // Track if form has been initialized to prevent overwrites on refetch
  const hasInitialized = useRef(false);
  
  // Reset form when onboarding data loads
  useEffect(() => {
    if (existingOnboarding && !loadingOnboarding && !hasInitialized.current) {
      hasInitialized.current = true;
      
      const values: FormData = {
        firstName: existingOnboarding.firstName || "",
        lastName: existingOnboarding.lastName || "",
        middleName: existingOnboarding.middleName || "",
        dateOfBirth: existingOnboarding.dateOfBirth ? existingOnboarding.dateOfBirth.split('T')[0] : "",
        gender: existingOnboarding.gender || "",
        ssn: existingOnboarding.ssn || "",
        personalEmail: existingOnboarding.personalEmail || "",
        workEmail: existingOnboarding.workEmail || user?.username || "",
        cellPhone: existingOnboarding.cellPhone || "",
        workPhone: existingOnboarding.workPhone || "",
        homeAddress1: existingOnboarding.homeAddress1 || "",
        homeAddress2: existingOnboarding.homeAddress2 || "",
        homeCity: existingOnboarding.homeCity || "",
        homeState: existingOnboarding.homeState || "",
        homeZip: existingOnboarding.homeZip || "",
        jobTitle: existingOnboarding.jobTitle || "",
        workLocation: existingOnboarding.workLocation || "",
        status: existingOnboarding.status || "active",
        npiNumber: existingOnboarding.npiNumber || "",
        enumerationDate: existingOnboarding.enumerationDate ? existingOnboarding.enumerationDate.split('T')[0] : "",
        qualification: existingOnboarding.qualification || "",
        medicalLicenseNumber: existingOnboarding.medicalLicenseNumber || "",
        substanceUseLicenseNumber: existingOnboarding.substanceUseLicenseNumber || "",
        mentalHealthLicenseNumber: existingOnboarding.mentalHealthLicenseNumber || "",
        substanceUseQualification: existingOnboarding.substanceUseQualification || "",
        mentalHealthQualification: existingOnboarding.mentalHealthQualification || "",
        medicaidNumber: existingOnboarding.medicaidNumber || "",
        medicarePtanNumber: existingOnboarding.medicarePtanNumber || "",
        caqhProviderId: existingOnboarding.caqhProviderId || "",
        caqhIssueDate: existingOnboarding.caqhIssueDate ? existingOnboarding.caqhIssueDate.split('T')[0] : "",
        caqhLastAttestationDate: existingOnboarding.caqhLastAttestationDate ? existingOnboarding.caqhLastAttestationDate.split('T')[0] : "",
        caqhReattestationDueDate: existingOnboarding.caqhReattestationDueDate ? existingOnboarding.caqhReattestationDueDate.split('T')[0] : "",
        caqhEnabled: existingOnboarding.caqhEnabled || false,
        educations: existingOnboarding.educations || [],
        employments: existingOnboarding.employments || [],
        stateLicenses: existingOnboarding.stateLicenses || [],
        deaLicenses: existingOnboarding.deaLicenses || [],
        boardCertifications: existingOnboarding.boardCertifications || [],
        peerReferences: existingOnboarding.peerReferences || [],
        emergencyContacts: existingOnboarding.emergencyContacts || [],
        trainings: existingOnboarding.trainings || [],
        payerEnrollments: existingOnboarding.payerEnrollments || [],
        documentUploads: existingOnboarding.documentUploads || [],
        allRequiredDocumentsUploaded: existingOnboarding.allRequiredDocumentsUploaded || false,
        uploadedRequiredCount: existingOnboarding.uploadedRequiredCount || 0,
        requiredDocumentsCount: existingOnboarding.requiredDocumentsCount || 0,
        allFormsCompleted: existingOnboarding.allFormsCompleted || false,
        completedForms: existingOnboarding.completedForms || 0,
        totalRequiredForms: existingOnboarding.totalRequiredForms || 0,
        submissions: existingOnboarding.submissions || [],
      };
      
      form.reset(values, { keepDefaultValues: false });
    }
  }, [existingOnboarding, loadingOnboarding, user, form]);

  // Update form data callback for child components (steps 9, 11, 12)
  const updateFormData = (data: Partial<FormData>) => {
    Object.keys(data).forEach((key) => {
      form.setValue(key as keyof FormData, data[key as keyof FormData]);
    });
  };

  const formData = form.watch();

  // Save Draft Mutation
  const saveDraftMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Filter out undefined/empty values and coerce types
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined && v !== "" && v !== null)
      );
      
      const response = await apiRequest("POST", "/api/onboarding/save-draft", cleanData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save draft');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Draft Saved",
        description: "Your progress has been saved. You can continue later."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Submit Onboarding Mutation
  const submitOnboardingMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const {
        educations, employments, stateLicenses, deaLicenses,
        boardCertifications, peerReferences, emergencyContacts,
        trainings, payerEnrollments,
        ...employeeData
      } = data;
      
      // Remove NPI if it's empty or the test value
      if (employeeData.npiNumber === '' || employeeData.npiNumber === '1234567890') {
        delete employeeData.npiNumber;
      }
      
      const response = await apiRequest("POST", "/api/onboarding/submit", {
        ...employeeData,
        educations,
        employments,
        stateLicenses,
        deaLicenses,
        boardCertifications,
        peerReferences,
        emergencyContacts,
        trainings,
        payerEnrollments
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          throw new Error(error.error || 'This information already exists in our system.');
        }
        throw new Error(error.error || 'Failed to submit onboarding');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Onboarding Submitted",
        description: "Your onboarding information has been submitted for review. HR will contact you soon.",
        duration: 10000
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      setTimeout(() => {
        navigate("/");
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit onboarding. Please try again or contact HR for assistance.",
        variant: "destructive",
        duration: 10000
      });
    }
  });

  // Handle Save Draft - bypass validation to allow partial saves
  const handleSaveDraft = () => {
    // Get current form data without triggering validation
    const currentData = form.getValues();
    saveDraftMutation.mutate(currentData);
  };

  // Handle Next with validation guard
  const handleNext = async () => {
    // For steps with validation (1-8, 10), trigger validation
    if ([1, 2, 3, 4, 5, 6, 7, 8, 10].includes(currentStep)) {
      const isValid = await form.trigger();
      if (!isValid) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields correctly before proceeding.",
          variant: "destructive",
          duration: 5000
        });
        return;
      }
    }

    // Step 9: Documents validation
    if (currentStep === 9) {
      if (!formData.allRequiredDocumentsUploaded) {
        const missingCount = (formData.requiredDocumentsCount || 0) - (formData.uploadedRequiredCount || 0);
        toast({
          title: "Cannot Proceed",
          description: `Please upload all required documents before continuing. You have ${missingCount} required document${missingCount > 1 ? 's' : ''} remaining.`,
          variant: "destructive",
          duration: 5000
        });
        return;
      }
    }
    
    // Step 11: Forms validation
    if (currentStep === 11) {
      if (!formData.allFormsCompleted) {
        const completedForms = formData.completedForms || 0;
        const totalRequiredForms = formData.totalRequiredForms || 0;
        toast({
          title: "Cannot Proceed",
          description: `Please complete all required forms. ${completedForms} of ${totalRequiredForms} forms signed.`,
          variant: "destructive",
          duration: 5000
        });
        return;
      }
    }
    
    if (currentStep < 12) {
      setCurrentStep(currentStep + 1);
      // Auto-save draft on step change
      if (existingOnboarding || formData.firstName) {
        saveDraftMutation.mutate(formData);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    // Validate all required documents are uploaded
    if (!formData.allRequiredDocumentsUploaded) {
      const missingCount = (formData.requiredDocumentsCount || 0) - (formData.uploadedRequiredCount || 0);
      toast({
        title: "Submission Blocked",
        description: `Please upload all required documents before submitting. You have ${missingCount} required document${missingCount > 1 ? 's' : ''} remaining. Navigate to Step 9 to upload documents.`,
        variant: "destructive",
        duration: 7000
      });
      return;
    }
    
    // Validate all required forms are signed
    if (!formData.allFormsCompleted) {
      const completedForms = formData.completedForms || 0;
      const totalRequiredForms = formData.totalRequiredForms || 0;
      const remaining = totalRequiredForms - completedForms;
      toast({
        title: "Submission Blocked",
        description: `Please complete all required forms before submitting. ${completedForms} of ${totalRequiredForms} forms are signed. Navigate to Step 11 to complete the remaining ${remaining} form${remaining > 1 ? 's' : ''}.`,
        variant: "destructive",
        duration: 7000
      });
      return;
    }
    
    submitOnboardingMutation.mutate(formData);
  };

  // Handle error boundary errors
  const handleErrorBoundary = (error: Error) => {
    console.error('[Onboarding ErrorBoundary]:', error);
    toast({
      title: "Application Error",
      description: "An unexpected error occurred. Please reload the page.",
      variant: "destructive",
    });
  };

  // Step configuration
  const steps = [
    { title: "Personal Information" },
    { title: "Professional Details" },
    { title: "Address & Credentials" },
    { title: "Education History" },
    { title: "Employment History" },
    { title: "State Licenses" },
    { title: "DEA & Certifications" },
    { title: "References & Emergency Contacts" },
    { 
      title: `Documents Submission${formData.allRequiredDocumentsUploaded ? ' ✓' : formData.uploadedRequiredCount ? ` (${formData.uploadedRequiredCount}/${formData.requiredDocumentsCount || 0})` : ''}`
    },
    { title: "Training & Payer Enrollment" },
    { 
      title: `Required Forms${formData.allFormsCompleted ? ' ✓' : formData.completedForms ? ` (${formData.completedForms}/${formData.totalRequiredForms || 0} signed)` : ''}`
    },
    { title: "Review & Submit" },
  ];

  // Loading state
  if (loadingOnboarding) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <ClipboardList className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading your onboarding information...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Error state
  if (onboardingError) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Error Loading Onboarding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {onboardingError instanceof Error 
                  ? onboardingError.message 
                  : 'Failed to load your onboarding information. Please try again or contact HR for assistance.'}
              </p>
              <Button 
                onClick={() => window.location.reload()} 
                variant="default"
                data-testid="button-reload-page"
              >
                <FileText className="w-4 h-4 mr-2" />
                Reload Page
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <ErrorBoundary onError={handleErrorBoundary}>
      <MainLayout>
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ClipboardList className="w-8 h-8" />
              Employee Onboarding
            </h1>
            <p className="text-muted-foreground">
              Complete your onboarding information to join our team
            </p>
          </div>

          {/* Progress Indicator */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Step {currentStep} of 12</span>
                <span className="text-sm text-muted-foreground">{Math.round((currentStep / 12) * 100)}% Complete</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentStep / 12) * 100}%` }}
                />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <h3 className="font-semibold">{steps[currentStep - 1].title}</h3>
                {existingOnboarding && (
                  <Badge variant="outline">Draft Available</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Form */}
          <FormProvider {...form}>
            <form className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <StepRenderer 
                    key={currentStep}
                    stepNumber={currentStep} 
                    updateFormData={updateFormData}
                    formData={formData}
                    onboardingId={existingOnboarding?.id}
                  />
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 1}
                  data-testid="button-previous"
                >
                  Previous
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={saveDraftMutation.isPending}
                    data-testid="button-save-draft"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saveDraftMutation.isPending ? "Saving..." : "Save Draft"}
                  </Button>

                  {currentStep === 12 ? (
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitOnboardingMutation.isPending}
                      data-testid="button-submit-onboarding"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {submitOnboardingMutation.isPending ? "Submitting..." : "Submit Onboarding"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleNext}
                      data-testid="button-next"
                    >
                      Next
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </FormProvider>
        </div>
      </MainLayout>
    </ErrorBoundary>
  );
}
