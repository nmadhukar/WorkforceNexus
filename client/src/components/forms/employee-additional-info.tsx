import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertEmployeeSchema } from "@shared/schema";
import { useEffect } from "react";

// Use the full insertEmployeeSchema since it already has all the date validation rules
const additionalInfoSchema = insertEmployeeSchema;

type AdditionalInfoFormData = z.infer<typeof additionalInfoSchema>;

interface EmployeeAdditionalInfoProps {
  data: any;
  onChange: (data: any) => void;
}

export function EmployeeAdditionalInfo({ data, onChange }: EmployeeAdditionalInfoProps) {
  const form = useForm<AdditionalInfoFormData>({
    resolver: zodResolver(additionalInfoSchema),
    defaultValues: {
      caqhLoginId: data.caqhLoginId || "",
      caqhPassword: data.caqhPassword || "",
      nppesLoginId: data.nppesLoginId || "",
      nppesPassword: data.nppesPassword || "",
      birthCity: data.birthCity || "",
      birthState: data.birthState || "",
      birthCountry: data.birthCountry || "",
      driversLicenseNumber: data.driversLicenseNumber || "",
      dlStateIssued: data.dlStateIssued || "",
      dlIssueDate: data.dlIssueDate || "",
      dlExpirationDate: data.dlExpirationDate || ""
    }
  });

  // Watch form values and update parent when they change
  const watchedValues = form.watch();
  useEffect(() => {
    onChange(watchedValues);
  }, [watchedValues, onChange]);

  return (
    <Form {...form}>
      <div className="space-y-6">
        {/* Login Credentials */}
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
