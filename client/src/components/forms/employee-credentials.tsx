import { useEffect } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Validation schema with at least one license number required
const credentialsSchema = z.object({
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
}).refine(
  (data) => {
    // At least one license number must be provided
    return !!(
      data.medicalLicenseNumber ||
      data.substanceUseLicenseNumber ||
      data.mentalHealthLicenseNumber
    );
  },
  {
    message: "At least one license number is required",
    path: ["medicalLicenseNumber"], // Show error on first license field
  }
).refine(
  (data) => {
    // If CAQH is enabled, CAQH Provider ID is required
    if (data.caqhEnabled && !data.caqhProviderId) {
      return false;
    }
    return true;
  },
  {
    message: "CAQH Provider ID is required when CAQH is enabled",
    path: ["caqhProviderId"],
  }
);

type CredentialsFormData = z.infer<typeof credentialsSchema>;

interface EmployeeCredentialsProps {
  data: any;
  onChange: (data: any) => void;
  onValidationChange?: (isValid: boolean) => void;
  registerValidation?: (validationFn: () => Promise<boolean>) => void;
}

export function EmployeeCredentials({ data, onChange, onValidationChange, registerValidation }: EmployeeCredentialsProps) {
  const form = useForm<CredentialsFormData>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: {
      medicalLicenseNumber: data.medicalLicenseNumber || "",
      substanceUseLicenseNumber: data.substanceUseLicenseNumber || "",
      mentalHealthLicenseNumber: data.mentalHealthLicenseNumber || "",
      substanceUseQualification: data.substanceUseQualification || "",
      mentalHealthQualification: data.mentalHealthQualification || "",
      medicaidNumber: data.medicaidNumber || "",
      medicarePtanNumber: data.medicarePtanNumber || "",
      caqhProviderId: data.caqhProviderId || "",
      caqhIssueDate: data.caqhIssueDate || "",
      caqhLastAttestationDate: data.caqhLastAttestationDate || "",
      caqhReattestationDueDate: data.caqhReattestationDueDate || "",
      caqhEnabled: data.caqhEnabled || false,
    },
  });

  // Watch form values and update parent on valid changes
  useEffect(() => {
    const subscription = form.watch((value) => {
      // Update parent with current form values to maintain backward compatibility
      onChange(value);
    });
    return () => subscription.unsubscribe();
  }, [form, onChange]);

  // Re-validate when CAQH enabled changes
  const caqhEnabled = form.watch("caqhEnabled");
  useEffect(() => {
    form.trigger(["caqhProviderId"]);
  }, [caqhEnabled, form]);

  // Register validation function with parent
  useEffect(() => {
    if (registerValidation) {
      registerValidation(async () => {
        // Trigger validation on all fields
        const isValid = await form.trigger();
        // Return validation result
        return isValid;
      });
    }
  }, [form, registerValidation]);

  // Report validation state changes to parent
  useEffect(() => {
    if (onValidationChange) {
      const subscription = form.watch(() => {
        // Trigger validation and report state
        form.trigger().then((isValid) => {
          onValidationChange(isValid);
        });
      });
      
      // Initial validation check
      form.trigger().then((isValid) => {
        onValidationChange(isValid);
      });
      
      return () => subscription.unsubscribe();
    }
  }, [form, onValidationChange]);

  return (
    <Form {...form}>
      <div className="space-y-6">
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
                    <Input
                      {...field}
                      placeholder="Enter medical license number"
                      data-testid="input-medical-license-number"
                    />
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
                    <Input
                      {...field}
                      placeholder="Enter substance use license number"
                      data-testid="input-substance-use-license-number"
                    />
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
                    <Input
                      {...field}
                      placeholder="Enter mental health license number"
                      data-testid="input-mental-health-license-number"
                    />
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
                    <Textarea
                      {...field}
                      placeholder="Enter substance use qualifications"
                      data-testid="textarea-substance-use-qualification"
                    />
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
                    <Textarea
                      {...field}
                      placeholder="Enter mental health qualifications"
                      data-testid="textarea-mental-health-qualification"
                    />
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
                    <Input
                      {...field}
                      placeholder="Enter Medicaid number"
                      data-testid="input-medicaid-number"
                    />
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
                    <Input
                      {...field}
                      placeholder="Enter Medicare PTAN number"
                      data-testid="input-medicare-ptan-number"
                    />
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
                    {form.watch("caqhEnabled") && <span className="text-red-500"> *</span>}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter CAQH Provider ID"
                      data-testid="input-caqh-provider-id"
                    />
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
                    <Input
                      {...field}
                      type="date"
                      data-testid="input-caqh-issue-date"
                    />
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
                    <Input
                      {...field}
                      type="date"
                      data-testid="input-caqh-last-attestation-date"
                    />
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
                    <Input
                      {...field}
                      type="date"
                      data-testid="input-caqh-reattestation-due-date"
                    />
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
                <FormLabel className="font-normal">
                  CAQH Enabled
                </FormLabel>
              </FormItem>
            )}
          />
        </div>
      </div>
    </Form>
  );
}