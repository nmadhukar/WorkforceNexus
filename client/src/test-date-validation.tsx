// Test component to verify date validation functionality
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEmployeeSchema, insertStateLicenseSchema, insertEducationSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DateValidationTest() {
  // Test Driver's License Date Validation
  const driverLicenseForm = useForm({
    resolver: zodResolver(insertEmployeeSchema),
    defaultValues: {
      dlIssueDate: "2024-01-15",
      dlExpirationDate: "2023-12-01" // Invalid: expiration before issue
    }
  });

  // Test State License Date Validation  
  const stateLicenseForm = useForm({
    resolver: zodResolver(insertStateLicenseSchema),
    defaultValues: {
      issueDate: "2024-06-01",
      expirationDate: "2024-01-01" // Invalid: expiration before issue
    }
  });

  // Test Education Date Validation
  const educationForm = useForm({
    resolver: zodResolver(insertEducationSchema),
    defaultValues: {
      startDate: "2023-09-01",
      endDate: "2023-01-01" // Invalid: end before start
    }
  });

  const onSubmit = (data: any) => {
    console.log("Form submitted:", data);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-6">Date Validation Test Page</h1>
      
      {/* Driver's License Test */}
      <Card>
        <CardHeader>
          <CardTitle>Driver's License Date Validation Test</CardTitle>
          <p className="text-sm text-muted-foreground">
            Should show error: "Driver's license expiration date cannot be before issue date"
          </p>
        </CardHeader>
        <CardContent>
          <Form {...driverLicenseForm}>
            <form onSubmit={driverLicenseForm.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={driverLicenseForm.control}
                  name="dlIssueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="test-dl-issue-date" />
                      </FormControl>
                      <FormMessage data-testid="error-dl-issue-date" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={driverLicenseForm.control}
                  name="dlExpirationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="test-dl-expiration-date" />
                      </FormControl>
                      <FormMessage data-testid="error-dl-expiration-date" />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" data-testid="submit-driver-license">Test Driver License Validation</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* State License Test */}
      <Card>
        <CardHeader>
          <CardTitle>State License Date Validation Test</CardTitle>
          <p className="text-sm text-muted-foreground">
            Should show error: "Expiration date cannot be before issue date"
          </p>
        </CardHeader>
        <CardContent>
          <Form {...stateLicenseForm}>
            <form onSubmit={stateLicenseForm.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={stateLicenseForm.control}
                  name="issueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="test-state-issue-date" />
                      </FormControl>
                      <FormMessage data-testid="error-state-issue-date" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={stateLicenseForm.control}
                  name="expirationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="test-state-expiration-date" />
                      </FormControl>
                      <FormMessage data-testid="error-state-expiration-date" />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" data-testid="submit-state-license">Test State License Validation</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Education Test */}
      <Card>
        <CardHeader>
          <CardTitle>Education Date Validation Test</CardTitle>
          <p className="text-sm text-muted-foreground">
            Should show error: "End date cannot be before start date"
          </p>
        </CardHeader>
        <CardContent>
          <Form {...educationForm}>
            <form onSubmit={educationForm.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={educationForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="test-education-start-date" />
                      </FormControl>
                      <FormMessage data-testid="error-education-start-date" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={educationForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="test-education-end-date" />
                      </FormControl>
                      <FormMessage data-testid="error-education-end-date" />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" data-testid="submit-education">Test Education Validation</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}