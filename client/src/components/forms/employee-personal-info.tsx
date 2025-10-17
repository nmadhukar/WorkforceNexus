import { useEffect, useRef } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Validation schema
const personalInfoSchema = z.object({
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
  homeAddress1: z.string().optional(),
  homeAddress2: z.string().optional(),
  homeCity: z.string().optional(),
  homeState: z.string().optional(),
  homeZip: z.string().optional(),
  birthCity: z.string().optional(),
  birthState: z.string().optional(),
  birthCountry: z.string().optional(),
  driversLicenseNumber: z.string().optional(),
  dlStateIssued: z.string().optional(),
  dlIssueDate: z.string().optional(),
  dlExpirationDate: z.string().optional(),
});

type PersonalInfoFormData = z.infer<typeof personalInfoSchema>;

interface EmployeePersonalInfoProps {
  data: any;
  onChange: (data: any) => void;
  onValidationChange?: (isValid: boolean) => void;
  registerValidation?: (validationFn: () => Promise<boolean>) => void;
}

export function EmployeePersonalInfo({ data, onChange, onValidationChange, registerValidation }: EmployeePersonalInfoProps) {
  const form = useForm<PersonalInfoFormData>({
    resolver: zodResolver(personalInfoSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      firstName: data.firstName || "",
      middleName: data.middleName || "",
      lastName: data.lastName || "",
      dateOfBirth: data.dateOfBirth || "",
      gender: data.gender || "",
      ssn: data.ssn || "",
      personalEmail: data.personalEmail || "",
      workEmail: data.workEmail || "",
      cellPhone: data.cellPhone || "",
      homeAddress1: data.homeAddress1 || "",
      homeAddress2: data.homeAddress2 || "",
      homeCity: data.homeCity || "",
      homeState: data.homeState || "",
      homeZip: data.homeZip || "",
      birthCity: data.birthCity || "",
      birthState: data.birthState || "",
      birthCountry: data.birthCountry || "",
      driversLicenseNumber: data.driversLicenseNumber || "",
      dlStateIssued: data.dlStateIssued || "",
      dlIssueDate: data.dlIssueDate || "",
      dlExpirationDate: data.dlExpirationDate || "",
    },
  });

  // Debounced propagation of only the changed field to the parent to avoid thrash
  const debounceTimerRef = useRef<number | undefined>(undefined);
  const pendingDeltaRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    const subscription = form.watch((values, { name }) => {
      if (!name) return;
      const delta: Record<string, unknown> = { [name]: (values as any)[name] };
      pendingDeltaRef.current = { ...(pendingDeltaRef.current || {}), ...delta };
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        if (pendingDeltaRef.current) {
          onChange(pendingDeltaRef.current);
          pendingDeltaRef.current = null;
        }
      }, 150);
    });
    return () => {
      subscription.unsubscribe();
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
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

  // Expose validation function to parent; do not show messages until asked
  useEffect(() => {
    if (registerValidation) {
      registerValidation(async () => {
        const isValid = await form.trigger(undefined, { shouldFocus: true });
        return isValid;
      });
    }
  }, [form, registerValidation]);

  return (
    <Form {...form}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  First Name <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Enter first name"
                    data-testid="input-first-name"
                  />
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
                  <Input
                    {...field}
                    placeholder="Enter middle name"
                    data-testid="input-middle-name"
                  />
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
                <FormLabel>
                  Last Name <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Enter last name"
                    data-testid="input-last-name"
                  />
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
                <FormLabel>
                  Date of Birth <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="date"
                    data-testid="input-date-of-birth"
                  />
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
                <FormLabel>
                  SSN <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="XXX-XX-XXXX"
                    maxLength={11}
                    data-testid="input-ssn"
                  />
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
                <FormLabel>
                  Personal Email <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    placeholder="personal@email.com"
                    data-testid="input-personal-email"
                  />
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
                  <Input
                    {...field}
                    type="email"
                    placeholder="work@hospital.com"
                    data-testid="input-work-email"
                  />
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
                <FormLabel>
                  Cell Phone <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="tel"
                    placeholder="(555) 123-4567"
                    data-testid="input-cell-phone"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
                    <Input
                      {...field}
                      placeholder="123 Main Street"
                      data-testid="input-home-address1"
                    />
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
                    <Input
                      {...field}
                      placeholder="Apt, Suite, etc."
                      data-testid="input-home-address2"
                    />
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
                    <Input
                      {...field}
                      placeholder="Enter city"
                      data-testid="input-home-city"
                    />
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
                    <Input
                      {...field}
                      placeholder="Enter state"
                      data-testid="input-home-state"
                    />
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
                    <Input
                      {...field}
                      placeholder="12345"
                      data-testid="input-home-zip"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        {/* Birth Information */}
        <div className="space-y-4">
          <h4 className="text-md font-semibold text-foreground">Birth Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField
              control={form.control}
              name="birthCity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Birth City</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter birth city" data-testid="input-birth-city" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="birthState"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Birth State</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter birth state" data-testid="input-birth-state" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="birthCountry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Birth Country</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter birth country" data-testid="input-birth-country" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        {/* Driver's License */}
        <div className="space-y-4">
          <h4 className="text-md font-semibold text-foreground">Driver's License</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FormField
              control={form.control}
              name="driversLicenseNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter license number" data-testid="input-drivers-license-number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dlStateIssued"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State Issued</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter state" data-testid="input-dl-state-issued" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dlIssueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Date</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" data-testid="input-dl-issue-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dlExpirationDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiration Date</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" data-testid="input-dl-expiration-date" />
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