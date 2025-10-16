import { useEffect } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Validation schema with at least one license number required
const credentialsSchema = z.object({
  medicalLicenseNumber: z.string().optional(),
  substanceUseLicenseNumber: z.string().optional(),
  mentalHealthLicenseNumber: z.string().optional(),
  substanceUseQualification: z.string().min(1, "Substance use qualification is required"),
  mentalHealthQualification: z.string().min(1, "Mental health qualification is required"),
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
    mode: "onSubmit",
    reValidateMode: "onChange",
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

  // Register validation for Next click
  useEffect(() => {
    if (registerValidation) {
      registerValidation(async () => {
        return await form.trigger(undefined, { shouldFocus: true });
      });
    }
  }, [form, registerValidation]);

  // No live validation reporting

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
                  <FormLabel>Substance Use Qualification <span className="text-red-500">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-substance-use-qualification">
                        <SelectValue placeholder="Select substance use qualification" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="LPC - Licensed professional counselor">LPC - Licensed professional counselor</SelectItem>
                      <SelectItem value="LCDC III - Licensed chemical dependency counselor III">LCDC III - Licensed chemical dependency counselor III</SelectItem>
                      <SelectItem value="LCDC II - Licensed chemical dependency counselor II">LCDC II - Licensed chemical dependency counselor II</SelectItem>
                      <SelectItem value="LSW - Licensed social worker">LSW - Licensed social worker</SelectItem>
                      <SelectItem value="LMFT - Licensed marriage and family therapist">LMFT - Licensed marriage and family therapist</SelectItem>
                      <SelectItem value="LPN - Licensed practical nurse">LPN - Licensed practical nurse</SelectItem>
                      <SelectItem value="RN - Registered nurse">RN - Registered nurse</SelectItem>
                      <SelectItem value="PSY assistant - Psychology assistant, psychology intern, psychology trainee">PSY assistant - Psychology assistant, psychology intern, psychology trainee</SelectItem>
                      <SelectItem value="CDC-A - Chemical dependency counselor assistant">CDC-A - Chemical dependency counselor assistant</SelectItem>
                      <SelectItem value="C-T - Counselor trainee">C-T - Counselor trainee</SelectItem>
                      <SelectItem value="SW-A - Social worker assistant">SW-A - Social worker assistant</SelectItem>
                      <SelectItem value="SW-T - Social worker trainee">SW-T - Social worker trainee</SelectItem>
                      <SelectItem value="MFT-T - Marriage and family therapist trainee">MFT-T - Marriage and family therapist trainee</SelectItem>
                      <SelectItem value="CPS - Certified Peer Supporter – high school">CPS - Certified Peer Supporter – high school</SelectItem>
                      <SelectItem value="CPS - Certified Peer Supporter – Associate's">CPS - Certified Peer Supporter – Associate's</SelectItem>
                      <SelectItem value="CPS - Certified Peer Supporter – Bachelor's">CPS - Certified Peer Supporter – Bachelor's</SelectItem>
                      <SelectItem value="CPS - Certified Peer Supporter – Master's">CPS - Certified Peer Supporter – Master's</SelectItem>
                      <SelectItem value="MD/DO - Physician">MD/DO - Physician</SelectItem>
                      <SelectItem value="CNS - Clinical nurse specialist">CNS - Clinical nurse specialist</SelectItem>
                      <SelectItem value="CNP - Certified nurse practitioner">CNP - Certified nurse practitioner</SelectItem>
                      <SelectItem value="PA - Physician assistant">PA - Physician assistant</SelectItem>
                      <SelectItem value="LISW - Licensed independent social worker">LISW - Licensed independent social worker</SelectItem>
                      <SelectItem value="LIMFT - Licensed independent marriage and family therapist">LIMFT - Licensed independent marriage and family therapist</SelectItem>
                      <SelectItem value="LPCC - Licensed professional clinical counselor">LPCC - Licensed professional clinical counselor</SelectItem>
                      <SelectItem value="LICDC - Licensed independent chemical dependency counselor">LICDC - Licensed independent chemical dependency counselor</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="mentalHealthQualification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mental Health Qualification <span className="text-red-500">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-mental-health-qualification">
                        <SelectValue placeholder="Select mental health qualification" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="LPC - Licensed professional counselor">LPC - Licensed professional counselor</SelectItem>
                      <SelectItem value="LSW - Licensed social worker">LSW - Licensed social worker</SelectItem>
                      <SelectItem value="LMFT - Licensed marriage and family therapist">LMFT - Licensed marriage and family therapist</SelectItem>
                      <SelectItem value="LPN - Licensed practical nurse">LPN - Licensed practical nurse</SelectItem>
                      <SelectItem value="RN - Registered nurse">RN - Registered nurse</SelectItem>
                      <SelectItem value="PSY assistant - Psychology assistant, psychology intern, psychology trainee">PSY assistant - Psychology assistant, psychology intern, psychology trainee</SelectItem>
                      <SelectItem value="C-T - Counselor trainee">C-T - Counselor trainee</SelectItem>
                      <SelectItem value="SW-A - Social worker assistant">SW-A - Social worker assistant</SelectItem>
                      <SelectItem value="SW-T - Social worker trainee">SW-T - Social worker trainee</SelectItem>
                      <SelectItem value="MFT-T - Marriage and family therapist trainee">MFT-T - Marriage and family therapist trainee</SelectItem>
                      <SelectItem value="QMHS - QMHS – high school">QMHS - QMHS – high school</SelectItem>
                      <SelectItem value="QMHS - QMHS – Associate's">QMHS - QMHS – Associate's</SelectItem>
                      <SelectItem value="QMHS - QMHS – Bachelor's">QMHS - QMHS – Bachelor's</SelectItem>
                      <SelectItem value="QMHS - QMHS – Master's">QMHS - QMHS – Master's</SelectItem>
                      <SelectItem value="QMHS - QMHS – 3 years' experience">QMHS - QMHS – 3 years' experience</SelectItem>
                      <SelectItem value="CMS - Care management specialist – high school">CMS - Care management specialist – high school</SelectItem>
                      <SelectItem value="CMS - Care management specialist – Associate's">CMS - Care management specialist – Associate's</SelectItem>
                      <SelectItem value="CMS - Care management specialist – Bachelor's">CMS - Care management specialist – Bachelor's</SelectItem>
                      <SelectItem value="CMS - Care management specialist – Master's">CMS - Care management specialist – Master's</SelectItem>
                      <SelectItem value="MD/DO - Physician">MD/DO - Physician</SelectItem>
                      <SelectItem value="CNS - Clinical nurse specialist">CNS - Clinical nurse specialist</SelectItem>
                      <SelectItem value="CNP - Certified nurse practitioner">CNP - Certified nurse practitioner</SelectItem>
                      <SelectItem value="PA - Physician assistant">PA - Physician assistant</SelectItem>
                      <SelectItem value="LISW - Licensed independent social worker">LISW - Licensed independent social worker</SelectItem>
                      <SelectItem value="LIMFT - Licensed independent marriage and family therapist">LIMFT - Licensed independent marriage and family therapist</SelectItem>
                      <SelectItem value="LPCC - Licensed professional clinical counselor">LPCC - Licensed professional clinical counselor</SelectItem>
                    </SelectContent>
                  </Select>
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