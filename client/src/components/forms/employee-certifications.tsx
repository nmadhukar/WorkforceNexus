import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Award, Users, Phone } from "lucide-react";
import { insertBoardCertificationSchema } from "@shared/schema";

type CertificationFormData = z.infer<typeof insertBoardCertificationSchema>;

// References & Contacts schemas (moved from EmployeeReferencesContacts)
const referenceSchema = z.object({
  referenceName: z.string().optional(),
  contactInfo: z.string().optional(),
  relationship: z.string().optional(),
  comments: z.string().optional()
});

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  relationship: z.string().min(1, "Relationship is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email().optional().or(z.literal(""))
});

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
  const [stepError, setStepError] = useState<string | null>(null);

  // Local state moved from EmployeeReferencesContacts
  const [isReferenceDialogOpen, setIsReferenceDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [selectedReference, setSelectedReference] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [localReferences, setLocalReferences] = useState<any[]>(data.peerReferences || []);
  const [localContacts, setLocalContacts] = useState<any[]>(data.emergencyContacts || []);

  const formatDateInput = (value: unknown): string => {
    if (!value) return "";
    if (value instanceof Date) return value.toISOString().split("T")[0];
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const d = new Date(str);
    return isNaN(d.getTime()) ? str : d.toISOString().split("T")[0];
  };
  const formatDateDisplay = (value: unknown): string => {
    if (!value) return "-";
    if (value instanceof Date) return value.toISOString().split("T")[0];
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.split("T")[0];
    const d = new Date(str);
    return isNaN(d.getTime()) ? str : d.toISOString().split("T")[0];
  };

  const form = useForm<any>({
    resolver: zodResolver(insertBoardCertificationSchema),
    defaultValues: {
      boardName: "",
      certification: "",
      issueDate: "",
      expirationDate: ""
    }
  });

  // Fetch existing data if in update mode
  const { data: certifications = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", employeeId, "board-certifications"],
    enabled: !!employeeId
  });

  // Fetch existing references & contacts when in update mode
  const { data: references = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", employeeId, "peer-references"],
    enabled: !!employeeId
  });
  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", employeeId, "emergency-contacts"],
    enabled: !!employeeId
  });

  useEffect(() => {
    if (employeeId) {
      setLocalCertifications(certifications);
    }
  }, [certifications, employeeId]);

  useEffect(() => {
    if (employeeId) {
      setLocalReferences(references);
      setLocalContacts(contacts);
    }
  }, [references, contacts, employeeId]);

  useEffect(() => {
    onChange({ ...data, boardCertifications: localCertifications });
  }, [localCertifications]);

  // Sync moved fields into parent form data
  useEffect(() => {
    onChange({ ...data, peerReferences: localReferences, emergencyContacts: localContacts });
  }, [localReferences, localContacts]);

  // Register validation function with parent: require at least one certification
  useEffect(() => {
    if (registerValidation) {
      registerValidation(async () => {
        const hasOne = localCertifications.length > 0;
        if (!hasOne) {
          setStepError("Please add at least one board certification.");
        } else {
          setStepError(null);
        }
        if (onValidationChange) {
          onValidationChange(hasOne);
        }
        return hasOne;
      });
    }
  }, [registerValidation, localCertifications, onValidationChange]);

  // Report validation state to parent and clear banner when valid
  useEffect(() => {
    const hasOne = localCertifications.length > 0;
    if (hasOne) setStepError(null);
    if (onValidationChange) {
      onValidationChange(hasOne);
    }
  }, [localCertifications, onValidationChange]);

  const isExpiringSoon = (date: unknown) => {
    if (!date) return false;
    const expDate = new Date(date as any);
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
      issueDate: formatDateInput(certification.issueDate),
      expirationDate: formatDateInput(certification.expirationDate)
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setLocalCertifications(localCertifications.filter(cert => cert.id !== id));
  };

  // Reference handlers (moved)
  const referenceForm = useForm<any>({
    resolver: zodResolver(referenceSchema),
    defaultValues: { referenceName: "", contactInfo: "", relationship: "", comments: "" }
  });
  const handleReferenceSubmit = (formData: z.infer<typeof referenceSchema>) => {
    if (selectedReference) {
      const updated = localReferences.map(ref => ref.id === selectedReference.id ? { ...ref, ...formData } : ref);
      setLocalReferences(updated);
    } else {
      setLocalReferences([...localReferences, { ...formData, id: Date.now() }]);
    }
    setIsReferenceDialogOpen(false);
    setSelectedReference(null);
    referenceForm.reset();
  };
  const handleEditReference = (reference: any) => {
    setSelectedReference(reference);
    referenceForm.reset({
      referenceName: reference.referenceName || "",
      contactInfo: reference.contactInfo || "",
      relationship: reference.relationship || "",
      comments: reference.comments || ""
    });
    setIsReferenceDialogOpen(true);
  };
  const handleDeleteReference = (id: number) => {
    setLocalReferences(localReferences.filter(ref => ref.id !== id));
  };

  // Contact handlers (moved)
  const contactForm = useForm<any>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", relationship: "", phone: "", email: "" }
  });
  const handleContactSubmit = (formData: z.infer<typeof contactSchema>) => {
    if (selectedContact) {
      const updated = localContacts.map(contact => contact.id === selectedContact.id ? { ...contact, ...formData } : contact);
      setLocalContacts(updated);
    } else {
      setLocalContacts([...localContacts, { ...formData, id: Date.now() }]);
    }
    setIsContactDialogOpen(false);
    setSelectedContact(null);
    contactForm.reset();
  };
  const handleEditContact = (contact: any) => {
    setSelectedContact(contact);
    contactForm.reset({
      name: contact.name || "",
      relationship: contact.relationship || "",
      phone: contact.phone || "",
      email: contact.email || ""
    });
    setIsContactDialogOpen(true);
  };
  const handleDeleteContact = (id: number) => {
    setLocalContacts(localContacts.filter(contact => contact.id !== id));
  };

  return (
    <div className="space-y-6">
      {stepError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid="certifications-error">
          {stepError}
        </div>
      )}
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
                    <TableCell>{formatDateDisplay(cert.issueDate)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {formatDateDisplay(cert.expirationDate)}
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

      {/* Step 7 now includes References & Contacts (tab removed) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Peer References
              </CardTitle>
              <CardDescription>Professional references and recommendations</CardDescription>
            </div>
            <Button
              onClick={() => {
                setSelectedReference(null);
                referenceForm.reset();
                setIsReferenceDialogOpen(true);
              }}
              size="sm"
              data-testid="button-add-reference"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Reference
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {localReferences.length === 0 ? (
            <p className="text-muted-foreground">No peer references added</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localReferences.map((reference: any) => (
                  <TableRow key={reference.id} data-testid={`row-reference-${reference.id}`}>
                    <TableCell>{reference.referenceName || "-"}</TableCell>
                    <TableCell>{reference.contactInfo || "-"}</TableCell>
                    <TableCell>{reference.relationship || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditReference(reference)}
                        data-testid={`button-edit-reference-${reference.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteReference(reference.id)}
                        data-testid={`button-delete-reference-${reference.id}`}
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Emergency Contacts
              </CardTitle>
              <CardDescription>Contact information for emergencies</CardDescription>
            </div>
            <Button
              onClick={() => {
                setSelectedContact(null);
                contactForm.reset();
                setIsContactDialogOpen(true);
              }}
              size="sm"
              data-testid="button-add-contact"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {localContacts.length === 0 ? (
            <p className="text-muted-foreground">No emergency contacts added</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localContacts.map((contact: any) => (
                  <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                    <TableCell>{contact.name}</TableCell>
                    <TableCell>{contact.relationship}</TableCell>
                    <TableCell>{contact.phone}</TableCell>
                    <TableCell>{contact.email || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditContact(contact)}
                        data-testid={`button-edit-contact-${contact.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteContact(contact.id)}
                        data-testid={`button-delete-contact-${contact.id}`}
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

      {/* Peer Reference Dialog */}
      <Dialog open={isReferenceDialogOpen} onOpenChange={setIsReferenceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedReference ? "Edit Reference" : "Add Reference"}
            </DialogTitle>
          </DialogHeader>
          <Form {...referenceForm}>
            <form onSubmit={referenceForm.handleSubmit(handleReferenceSubmit)} className="space-y-4">
              <FormField
                control={referenceForm.control}
                name="referenceName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter reference name" data-testid="input-reference-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={referenceForm.control}
                name="contactInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Information</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter phone or email" data-testid="input-contact-info" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={referenceForm.control}
                name="relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Colleague, Supervisor" data-testid="input-relationship" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={referenceForm.control}
                name="comments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comments</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional comments" data-testid="input-comments" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsReferenceDialogOpen(false)}
                  data-testid="button-cancel-ref"
                >
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-submit-ref">
                  {selectedReference ? "Update" : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Emergency Contact Dialog */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedContact ? "Edit Emergency Contact" : "Add Emergency Contact"}
            </DialogTitle>
          </DialogHeader>
          <Form {...contactForm}>
            <form onSubmit={contactForm.handleSubmit(handleContactSubmit)} className="space-y-4">
              <FormField
                control={contactForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter contact name" data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-relationship">
                          <SelectValue placeholder="Select relationship" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Spouse">Spouse</SelectItem>
                        <SelectItem value="Parent">Parent</SelectItem>
                        <SelectItem value="Child">Child</SelectItem>
                        <SelectItem value="Sibling">Sibling</SelectItem>
                        <SelectItem value="Friend">Friend</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter phone number" type="tel" data-testid="input-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter email address" type="email" data-testid="input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsContactDialogOpen(false)}
                  data-testid="button-cancel-contact"
                >
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-submit-contact">
                  {selectedContact ? "Update" : "Add"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}