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
    defaultValues: {
      jobTitle: data.jobTitle || "",
      workLocation: data.workLocation || "",
      status: data.status || "active",
      npiNumber: data.npiNumber || "",
      enumerationDate: data.enumerationDate || "",
      workPhone: data.workPhone || "",
      qualification: data.qualification || "",
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
          
          <FormField
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
          />
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
      </div>
    </Form>
  );
}