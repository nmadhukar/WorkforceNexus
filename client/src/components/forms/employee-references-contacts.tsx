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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Users, Phone } from "lucide-react";

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

type ReferenceFormData = z.infer<typeof referenceSchema>;
type ContactFormData = z.infer<typeof contactSchema>;

interface EmployeeReferencesContactsProps {
  data: any;
  onChange: (data: any) => void;
  employeeId?: number;
  onValidationChange?: (isValid: boolean) => void;
  registerValidation?: (validationFn: () => Promise<boolean>) => void;
}

export function EmployeeReferencesContacts({ data, onChange, employeeId, onValidationChange, registerValidation }: EmployeeReferencesContactsProps) {
  const [isReferenceDialogOpen, setIsReferenceDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [selectedReference, setSelectedReference] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [localReferences, setLocalReferences] = useState<any[]>(data.peerReferences || []);
  const [localContacts, setLocalContacts] = useState<any[]>(data.emergencyContacts || []);

  const referenceForm = useForm<ReferenceFormData>({
    resolver: zodResolver(referenceSchema),
    defaultValues: {
      referenceName: "",
      contactInfo: "",
      relationship: "",
      comments: ""
    }
  });

  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      relationship: "",
      phone: "",
      email: ""
    }
  });

  // Fetch existing data if in update mode
  const { data: references = [] } = useQuery({
    queryKey: ["/api/employees", employeeId, "peer-references"],
    enabled: !!employeeId
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["/api/employees", employeeId, "emergency-contacts"],
    enabled: !!employeeId
  });

  useEffect(() => {
    if (employeeId) {
      setLocalReferences(references);
      setLocalContacts(contacts);
    }
  }, [references, contacts, employeeId]);

  // Register validation function with parent
  useEffect(() => {
    if (registerValidation) {
      registerValidation(async () => {
        // References and contacts are optional
        return true;
      });
    }
  }, [registerValidation]);

  // Report validation state - always valid as these are optional
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(true);
    }
  }, [onValidationChange]);

  useEffect(() => {
    onChange({ ...data, peerReferences: localReferences, emergencyContacts: localContacts });
  }, [localReferences, localContacts]);

  // Reference handlers
  const handleReferenceSubmit = (formData: ReferenceFormData) => {
    if (selectedReference) {
      const updated = localReferences.map(ref => 
        ref.id === selectedReference.id ? { ...ref, ...formData } : ref
      );
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

  // Contact handlers
  const handleContactSubmit = (formData: ContactFormData) => {
    if (selectedContact) {
      const updated = localContacts.map(contact => 
        contact.id === selectedContact.id ? { ...contact, ...formData } : contact
      );
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
      {/* Peer References Section */}
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

      {/* Emergency Contacts Section */}
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

      {/* Reference Dialog */}
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

      {/* Contact Dialog */}
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