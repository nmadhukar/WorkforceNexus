import { useEffect } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Validation schema
const professionalInfoSchema = z.object({
  jobTitle: z.string().min(1, "Job title is required"),
  workLocation: z.string().min(1, "Work location is required"),
  status: z.string().optional().default("active"),
  npiNumber: z.string().optional().refine(
    (val) => !val || val.length === 0 || /^\d{10}$/.test(val),
    "NPI number must be exactly 10 digits"
  ),
  enumerationDate: z.string().optional(),
  workPhone: z.string().optional(),
  qualification: z.string().optional(),
  caqhLoginId: z.string().optional(),
  caqhPassword: z.string().optional(),
  nppesLoginId: z.string().optional(),
  nppesPassword: z.string().optional(),
});

type ProfessionalInfoFormData = z.infer<typeof professionalInfoSchema>;

interface EmployeeProfessionalInfoProps {
  data: any;
  onChange: (data: any) => void;
  onValidationChange?: (isValid: boolean) => void;
  registerValidation?: (validationFn: () => Promise<boolean>) => void;
}

export function EmployeeProfessionalInfo({ data, onChange, onValidationChange, registerValidation }: EmployeeProfessionalInfoProps) {
  const form = useForm<ProfessionalInfoFormData>({
    resolver: zodResolver(professionalInfoSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      jobTitle: "",
      workLocation: "",
      status: "active",
      npiNumber: "",
      enumerationDate: "",
      workPhone: "",
      qualification: "",
      caqhLoginId: "",
      caqhPassword: "",
      nppesLoginId: "",
      nppesPassword: "",
    },
  });

  // Update form values when data changes
  useEffect(() => {
    if (data && (data.jobTitle || data.workLocation)) {
      form.reset({
        jobTitle: data.jobTitle || "",
        workLocation: data.workLocation || "",
        status: data.status || "active",
        npiNumber: data.npiNumber || "",
        enumerationDate: data.enumerationDate || "",
        workPhone: data.workPhone || "",
        qualification: data.qualification || "",
        caqhLoginId: data.caqhLoginId || "",
        caqhPassword: data.caqhPassword || "",
        nppesLoginId: data.nppesLoginId || "",
        nppesPassword: data.nppesPassword || "",
      });
    }
  }, [data, form]);

  // Watch and propagate changes to parent
  useEffect(() => {
    const subscription = form.watch((value) => {
      onChange(value);
    });
    return () => subscription.unsubscribe();
  }, [form, onChange]);

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="jobTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Job Title <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Enter job title"
                    data-testid="input-job-title"
                  />
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
                <FormLabel>
                  Work Location <span className="text-red-500">*</span>
                </FormLabel>
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
          
          {/* <FormField
            control={form.control}
            name="npiNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>NPI Number (Optional)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Optional - 10 digit NPI number"
                    maxLength={10}
                    data-testid="input-npi-number"
                  />
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
                  <Input
                    {...field}
                    type="date"
                    data-testid="input-enumeration-date"
                  />
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
                  <Input
                    {...field}
                    type="tel"
                    placeholder="(555) 123-4567"
                    data-testid="input-work-phone"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          /> */}
        </div>
        <FormField
          control={form.control}
          name="qualification"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Qualifications</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Enter professional qualifications and certifications"
                  rows={4}
                  data-testid="textarea-qualification"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <div className="space-y-4">
          <h4 className="text-md font-semibold text-foreground">Login Credentials</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="caqhLoginId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CAQH Login ID</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter CAQH login ID" data-testid="input-caqh-login-id" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="caqhPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CAQH Password</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" placeholder="Enter CAQH password" data-testid="input-caqh-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="nppesLoginId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NPPES Login ID</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter NPPES login ID" data-testid="input-nppes-login-id" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="nppesPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NPPES Password</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" placeholder="Enter NPPES password" data-testid="input-nppes-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>
    </Form>
  );
}