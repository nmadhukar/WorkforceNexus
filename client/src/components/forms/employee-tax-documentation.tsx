import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, FileText } from "lucide-react";

const taxFormSchema = z.object({
  formType: z.string().min(1, "Form type is required"),
  year: z.coerce.number().min(1900).max(2100),
  status: z.string().optional()
});

type TaxFormData = z.infer<typeof taxFormSchema>;

interface EmployeeTaxDocumentationProps {
  data: any;
  onChange: (data: any) => void;
  employeeId?: number;
}

export function EmployeeTaxDocumentation({ data, onChange, employeeId }: EmployeeTaxDocumentationProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [localTaxForms, setLocalTaxForms] = useState<any[]>(data.taxForms || []);

  const form = useForm<TaxFormData>({
    resolver: zodResolver(taxFormSchema),
    defaultValues: {
      formType: "",
      year: new Date().getFullYear(),
      status: "pending"
    }
  });

  // Fetch existing data if in update mode
  const { data: taxForms = [] } = useQuery({
    queryKey: ["/api/employees", employeeId, "tax-forms"],
    enabled: !!employeeId
  });

  useEffect(() => {
    if (employeeId) {
      setLocalTaxForms(taxForms);
    }
  }, [taxForms, employeeId]);

  useEffect(() => {
    onChange({ ...data, taxForms: localTaxForms });
  }, [localTaxForms]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'filed':
        return <Badge className="bg-blue-100 text-blue-800">Filed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleSubmit = (formData: TaxFormData) => {
    if (selectedForm) {
      const updated = localTaxForms.map(tf => 
        tf.id === selectedForm.id ? { ...tf, ...formData } : tf
      );
      setLocalTaxForms(updated);
    } else {
      setLocalTaxForms([...localTaxForms, { ...formData, id: Date.now() }]);
    }
    setIsDialogOpen(false);
    setSelectedForm(null);
    form.reset();
  };

  const handleEdit = (taxForm: any) => {
    setSelectedForm(taxForm);
    form.reset({
      formType: taxForm.formType,
      year: taxForm.year,
      status: taxForm.status || "pending"
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setLocalTaxForms(localTaxForms.filter(tf => tf.id !== id));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Tax Forms & Documentation
              </CardTitle>
              <CardDescription>Manage tax forms and compliance documentation</CardDescription>
            </div>
            <Button
              onClick={() => {
                setSelectedForm(null);
                form.reset();
                setIsDialogOpen(true);
              }}
              size="sm"
              data-testid="button-add-tax-form"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Tax Form
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {localTaxForms.length === 0 ? (
            <p className="text-muted-foreground">No tax forms added</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form Type</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localTaxForms.map((taxForm: any) => (
                  <TableRow key={taxForm.id} data-testid={`row-tax-form-${taxForm.id}`}>
                    <TableCell>{taxForm.formType}</TableCell>
                    <TableCell>{taxForm.year}</TableCell>
                    <TableCell>{getStatusBadge(taxForm.status || "pending")}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(taxForm)}
                        data-testid={`button-edit-tax-form-${taxForm.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(taxForm.id)}
                        data-testid={`button-delete-tax-form-${taxForm.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedForm ? "Edit Tax Form" : "Add Tax Form"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="formType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Form Type *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-form-type">
                          <SelectValue placeholder="Select form type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="W-2">W-2</SelectItem>
                        <SelectItem value="W-4">W-4</SelectItem>
                        <SelectItem value="W-9">W-9</SelectItem>
                        <SelectItem value="1099">1099</SelectItem>
                        <SelectItem value="I-9">I-9</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        placeholder="Enter year" 
                        min={1900}
                        max={2100}
                        data-testid="input-year" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="filed">Filed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-submit">
                  {selectedForm ? "Update" : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}