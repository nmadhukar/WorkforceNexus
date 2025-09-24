import { FormsManager } from "@/components/entity-managers/forms-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSignature } from "lucide-react";

interface EmployeeFormsProps {
  data: any;
  onChange?: (data: any) => void;
  employeeId?: number;
}

/**
 * Employee Forms Component - Wrapper for FormsManager
 * Provides access to DocuSeal forms within the employee form flow
 */
export function EmployeeForms({ data, onChange, employeeId }: EmployeeFormsProps) {
  // Only show forms manager when we have an employee ID (edit mode)
  if (!employeeId) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-muted-foreground" />
            <CardTitle>DocuSeal Forms</CardTitle>
          </div>
          <CardDescription>
            Forms will be available after the employee is created. Complete the initial setup and save the employee first.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <FormsManager employeeId={employeeId} />
    </div>
  );
}