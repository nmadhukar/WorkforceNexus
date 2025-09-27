import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Award } from "lucide-react";
import { insertBoardCertificationSchema } from "@shared/schema";

type CertificationFormData = z.infer<typeof insertBoardCertificationSchema>;

interface EmployeeCertificationsProps {
  data: any;
  onChange: (data: any) => void;
  employeeId?: number;
  onValidationChange?: (isValid: boolean) => void;
  registerValidation?: (validationFn: () => Promise<boolean>) => void;
}

export function EmployeeCertifications({ data, onChange, employeeId, onValidationChange, registerValidation }: EmployeeCertificationsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCertification, setSelectedCertification] = useState<any>(null);
  const [localCertifications, setLocalCertifications] = useState<any[]>(data.boardCertifications || []);

  const form = useForm<CertificationFormData>({
    resolver: zodResolver(insertBoardCertificationSchema),
    defaultValues: {
      boardName: "",
      certification: "",
      issueDate: "",
      expirationDate: ""
    }
  });

  // Fetch existing data if in update mode
  const { data: certifications = [] } = useQuery({
    queryKey: ["/api/employees", employeeId, "board-certifications"],
    enabled: !!employeeId
  });

  useEffect(() => {
    if (employeeId) {
      setLocalCertifications(certifications);
    }
  }, [certifications, employeeId]);

  useEffect(() => {
    onChange({ ...data, boardCertifications: localCertifications });
  }, [localCertifications]);

  // Register validation function with parent
  useEffect(() => {
    if (registerValidation) {
      registerValidation(async () => {
        // Certifications are optional, so always valid (even if empty)
        // But if certifications are added, they must have required fields filled via form validation
        return true;
      });
    }
  }, [registerValidation]);

  // Report validation state to parent - certifications are optional
  useEffect(() => {
    if (onValidationChange) {
      // Always valid since certifications are optional
      onValidationChange(true);
    }
  }, [onValidationChange]);

  const isExpiringSoon = (date: string) => {
    if (!date) return false;
    const expDate = new Date(date);
    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    return expDate.getTime() - now.getTime() < thirtyDays && expDate.getTime() > now.getTime();
  };

  const handleSubmit = (formData: CertificationFormData) => {
    if (selectedCertification) {
      const updated = localCertifications.map(cert => 
        cert.id === selectedCertification.id ? { ...cert, ...formData } : cert
      );
      setLocalCertifications(updated);
    } else {
      setLocalCertifications([...localCertifications, { ...formData, id: Date.now() }]);
    }
    setIsDialogOpen(false);
    setSelectedCertification(null);
    form.reset();
  };

  const handleEdit = (certification: any) => {
    setSelectedCertification(certification);
    form.reset({
      boardName: certification.boardName || "",
      certification: certification.certification || "",
      issueDate: certification.issueDate || "",
      expirationDate: certification.expirationDate || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setLocalCertifications(localCertifications.filter(cert => cert.id !== id));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Board Certifications
              </CardTitle>
              <CardDescription>Manage board certifications and credentials</CardDescription>
            </div>
            <Button
              onClick={() => {
                setSelectedCertification(null);
                form.reset();
                setIsDialogOpen(true);
              }}
              size="sm"
              data-testid="button-add-certification"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Certification
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {localCertifications.length === 0 ? (
            <p className="text-muted-foreground">No board certifications added</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Board Name</TableHead>
                  <TableHead>Certification</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Expiration Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localCertifications.map((cert: any) => (
                  <TableRow key={cert.id} data-testid={`row-certification-${cert.id}`}>
                    <TableCell>{cert.boardName || "-"}</TableCell>
                    <TableCell>{cert.certification || "-"}</TableCell>
                    <TableCell>{cert.issueDate || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {cert.expirationDate || "-"}
                        {isExpiringSoon(cert.expirationDate) && (
                          <Badge className="bg-orange-100 text-orange-800 text-xs">Expiring Soon</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(cert)}
                        data-testid={`button-edit-certification-${cert.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(cert.id)}
                        data-testid={`button-delete-certification-${cert.id}`}
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
              {selectedCertification ? "Edit Certification" : "Add Certification"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="boardName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Board Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., American Board of Internal Medicine" data-testid="input-board-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="certification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Certification</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter certification type" data-testid="input-certification" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="issueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-issue-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expirationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-expiration-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                  {selectedCertification ? "Update" : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}