import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FileUpload } from "@/components/file-upload";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Upload,
  FileText,
  Award,
  GraduationCap,
  Briefcase,
  AlertTriangle,
  UserPlus,
  Edit,
  Plus,
  Shield,
  Heart,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Home,
  CreditCard
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Link } from "wouter";

// Type definitions for API responses
interface EmployeeProfile {
  id: number;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth?: string | null;
  personalEmail?: string | null;
  workEmail: string;
  cellPhone?: string | null;
  workPhone?: string | null;
  homeAddress1?: string | null;
  homeAddress2?: string | null;
  homeCity?: string | null;
  homeState?: string | null;
  homeZip?: string | null;
  gender?: string | null;
  birthCity?: string | null;
  birthState?: string | null;
  birthCountry?: string | null;
  driversLicenseNumber?: string | null;
  dlStateIssued?: string | null;
  dlIssueDate?: string | null;
  dlExpirationDate?: string | null;
  ssn?: string | null;
  npiNumber?: string | null;
  enumerationDate?: string | null;
  jobTitle?: string | null;
  workLocation?: string | null;
  qualification?: string | null;
  medicalLicenseNumber?: string | null;
  substanceUseLicenseNumber?: string | null;
  substanceUseQualification?: string | null;
  mentalHealthLicenseNumber?: string | null;
  mentalHealthQualification?: string | null;
  userId?: number | null;
  status?: string | null;
  onboardingStatus?: string | null;
  onboardingCompletedAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: number | null;
  caqhProviderId?: string | null;
  caqhAttestationDate?: string | null;
  caqhLastAttestationDate?: string | null;
  caqhReattestationDueDate?: string | null;
}

interface EmergencyContact {
  id: number;
  employeeId: number;
  name: string;
  relationship?: string | null;
  phone?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  isPrimary?: boolean;
}

interface Document {
  id: number;
  employeeId: number;
  documentType: string;
  documentNumber?: string | null;
  fileName: string;
  filePath?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  signedDate?: string | null;
  expirationDate?: string | null;
  uploadDate?: string | null;
  verifiedBy?: string | null;
  verificationDate?: string | null;
  notes?: string | null;
  s3Etag?: string | null;
  s3VersionId?: string | null;
  createdAt?: string | null;
}

interface StateLicense {
  id: number;
  employeeId: number;
  licenseNumber: string;
  state: string;
  issueDate?: string | null;
  expirationDate?: string | null;
  status?: string | null;
}

interface DEALicense {
  id: number;
  employeeId: number;
  licenseNumber: string;
  issueDate?: string | null;
  expirationDate?: string | null;
  status?: string | null;
}

interface BoardCertification {
  id: number;
  employeeId: number;
  boardName?: string | null;
  certification?: string | null;
  issueDate?: string | null;
  expirationDate?: string | null;
  status?: string | null;
}

interface LicensesResponse {
  stateLicenses: StateLicense[];
  deaLicenses: DEALicense[];
  boardCertifications: BoardCertification[];
}

interface Training {
  id: number;
  employeeId: number;
  trainingType?: string | null;
  provider?: string | null;
  completionDate?: string | null;
  expirationDate?: string | null;
  credits?: string | null;
  certificatePath?: string | null;
}

interface Education {
  id: number;
  employeeId: number;
  educationType?: string | null;
  schoolInstitution?: string | null;
  degree?: string | null;
  specialtyMajor?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface Employment {
  id: number;
  employeeId: number;
  employer?: string | null;
  position?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
}

// Form schemas
const profileUpdateSchema = z.object({
  personalEmail: z.string().email().optional().nullable(),
  cellPhone: z.string().optional().nullable(),
  homeAddress1: z.string().optional().nullable(),
  homeAddress2: z.string().optional().nullable(),
  homeCity: z.string().optional().nullable(),
  homeState: z.string().optional().nullable(),
  homeZip: z.string().optional().nullable()
});

const emergencyContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  relationship: z.string().min(1, "Relationship is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  email: z.string().email().optional().nullable(),
  isPrimary: z.boolean()
});

type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;
type EmergencyContactData = z.infer<typeof emergencyContactSchema>;

/**
 * Employee Self-Service Portal
 * Comprehensive dashboard for employees to manage their own information
 */
export default function EmployeePortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Fetch employee profile
  const { data: profile, isLoading: profileLoading } = useQuery<EmployeeProfile>({
    queryKey: ["/api/employee/profile"],
    enabled: user?.role === 'employee'
  });

  // Fetch documents
  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ["/api/employee/documents"],
    enabled: user?.role === 'employee'
  });

  // Fetch emergency contacts
  const { data: emergencyContacts = [] } = useQuery<EmergencyContact[]>({
    queryKey: ["/api/employee/emergency-contacts"],
    enabled: user?.role === 'employee'
  });

  // Fetch licenses and certifications
  const { data: licenses } = useQuery<LicensesResponse>({
    queryKey: ["/api/employee/licenses"],
    enabled: user?.role === 'employee'
  });

  // Fetch trainings
  const { data: trainings = [] } = useQuery<Training[]>({
    queryKey: ["/api/employee/trainings"],
    enabled: user?.role === 'employee'
  });

  // Fetch education
  const { data: education = [] } = useQuery<Education[]>({
    queryKey: ["/api/employee/education"],
    enabled: user?.role === 'employee'
  });

  // Fetch employment history
  const { data: employmentHistory = [] } = useQuery<Employment[]>({
    queryKey: ["/api/employee/employment"],
    enabled: user?.role === 'employee'
  });

  // Profile update form
  const profileForm = useForm<ProfileUpdateData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      personalEmail: profile?.personalEmail || "",
      cellPhone: profile?.cellPhone || "",
      homeAddress1: profile?.homeAddress1 || "",
      homeAddress2: profile?.homeAddress2 || "",
      homeCity: profile?.homeCity || "",
      homeState: profile?.homeState || "",
      homeZip: profile?.homeZip || ""
    }
  });

  // Emergency contact form
  const contactForm = useForm<EmergencyContactData>({
    resolver: zodResolver(emergencyContactSchema),
    defaultValues: {
      name: "",
      relationship: "",
      phoneNumber: "",
      email: "",
      isPrimary: false
    }
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileUpdateData) => 
      apiRequest("PUT", "/api/employee/profile", data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Profile updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/profile"] });
      setIsEditingProfile(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive"
      });
    }
  });

  // Update emergency contacts mutation
  const updateContactsMutation = useMutation({
    mutationFn: (contacts: any[]) => 
      apiRequest("PUT", "/api/employee/emergency-contacts", { contacts }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Emergency contacts updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/emergency-contacts"] });
      setIsAddingContact(false);
      contactForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update emergency contacts",
        variant: "destructive"
      });
    }
  });

  // Handle profile update
  const handleProfileUpdate = (data: ProfileUpdateData) => {
    updateProfileMutation.mutate(data);
  };

  // Handle adding emergency contact
  const handleAddContact = (data: EmergencyContactData) => {
    // Map form data to match API expected format
    const mappedContact: any = {
      name: data.name,
      relationship: data.relationship,
      phone: data.phoneNumber, // API uses 'phone' field
      email: data.email,
      isPrimary: data.isPrimary
    };
    const newContacts: any[] = [...emergencyContacts, mappedContact];
    updateContactsMutation.mutate(newContacts);
  };

  // Handle removing emergency contact
  const handleRemoveContact = (index: number) => {
    const newContacts = emergencyContacts.filter((_: EmergencyContact, i: number) => i !== index) as any[];
    updateContactsMutation.mutate(newContacts);
  };

  // Format date
  const formatDate = (date: string | null | undefined) => {
    if (!date) return "N/A";
    return format(new Date(date), "MMM dd, yyyy");
  };

  // Format phone number
  const formatPhoneNumber = (phone: string | null | undefined) => {
    if (!phone) return "N/A";
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Check if license is expiring
  const isExpiring = (date: string | null | undefined) => {
    if (!date) return false;
    const daysUntil = Math.floor((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil <= 30 && daysUntil > 0;
  };

  // Check if license is expired
  const isExpired = (date: string | null | undefined) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  if (profileLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3">
            <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
            <p className="text-muted-foreground">Loading your portal...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (user?.role !== 'employee') {
    return (
      <MainLayout>
        <Alert className="m-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            The Employee Self-Service Portal is only accessible to employees.
          </AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">
                  <Home className="h-4 w-4" />
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>My Portal</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Self-Service Portal</h1>
          <p className="text-muted-foreground mt-2">
            Manage your personal information, documents, and professional credentials
          </p>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => setIsEditingProfile(true)}
                data-testid="button-edit-profile"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
              <Button 
                variant="outline"
                onClick={() => setUploadDialogOpen(true)}
                data-testid="button-upload-document"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
              <Button 
                variant="outline"
                onClick={() => setIsAddingContact(true)}
                data-testid="button-add-emergency-contact"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Emergency Contact
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="personal" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 lg:w-[600px]">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="licenses">Licenses</TabsTrigger>
            <TabsTrigger value="training">Training</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Personal Information Tab */}
          <TabsContent value="personal" className="space-y-6">
            {/* Profile Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Personal Information
                  </span>
                  {!isEditingProfile && (
                    <Button 
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditingProfile(true)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditingProfile ? (
                  <Form {...profileForm}>
                    <form 
                      onSubmit={profileForm.handleSubmit(handleProfileUpdate)} 
                      className="space-y-4"
                      data-testid="form-edit-profile"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={profileForm.control}
                          name="personalEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Personal Email</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={profileForm.control}
                          name="cellPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cell Phone</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-4">
                        <FormField
                          control={profileForm.control}
                          name="homeAddress1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Address Line 1</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={profileForm.control}
                          name="homeAddress2"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Address Line 2</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={profileForm.control}
                            name="homeCity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>City</FormLabel>
                                <FormControl>
                                  <Input {...field} value={field.value || ""} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={profileForm.control}
                            name="homeState"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>State</FormLabel>
                                <FormControl>
                                  <Input {...field} value={field.value || ""} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={profileForm.control}
                            name="homeZip"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>ZIP Code</FormLabel>
                                <FormControl>
                                  <Input {...field} value={field.value || ""} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button type="submit" disabled={updateProfileMutation.isPending}>
                          {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => {
                            setIsEditingProfile(false);
                            profileForm.reset();
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Name</p>
                        <p className="text-sm font-semibold" data-testid="text-employee-name">
                          {profile?.firstName} {profile?.middleName} {profile?.lastName}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Job Title</p>
                        <p className="text-sm font-semibold">{profile?.jobTitle || "N/A"}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Work Email</p>
                        <p className="text-sm font-semibold">{profile?.workEmail}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Personal Email</p>
                        <p className="text-sm font-semibold">{profile?.personalEmail || "Not provided"}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Cell Phone</p>
                        <p className="text-sm font-semibold">{formatPhoneNumber(profile?.cellPhone)}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Date of Birth</p>
                        <p className="text-sm font-semibold">{formatDate(profile?.dateOfBirth)}</p>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Home Address</p>
                      <p className="text-sm font-semibold">
                        {profile?.homeAddress1 || "Not provided"}
                        {profile?.homeAddress2 && <><br />{profile.homeAddress2}</>}
                        {(profile?.homeCity || profile?.homeState || profile?.homeZip) && (
                          <>
                            <br />
                            {[profile?.homeCity, profile?.homeState, profile?.homeZip].filter(Boolean).join(", ")}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Emergency Contacts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Heart className="w-5 h-5" />
                    Emergency Contacts
                  </span>
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAddingContact(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Contact
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {emergencyContacts.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No emergency contacts added. Please add at least one emergency contact.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {emergencyContacts.map((contact: any, index: number) => (
                      <div key={index} className="flex items-start justify-between p-3 border rounded-lg">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{contact.name}</p>
                            {contact.isPrimary && (
                              <Badge variant="secondary" className="text-xs">Primary</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{contact.relationship}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {contact.phoneNumber}
                            </span>
                            {contact.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {contact.email}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveContact(index)}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    My Documents
                  </span>
                  <Button 
                    size="sm"
                    onClick={() => setUploadDialogOpen(true)}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No documents uploaded yet. Click "Upload" to add documents.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {documents.map((doc: Document) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{doc.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {doc.documentType} • Uploaded {formatDate(doc.uploadDate)}
                              </p>
                            </div>
                          </div>
                          {doc.expirationDate && (
                            <Badge 
                              variant={isExpired(doc.expirationDate) ? "destructive" : 
                                      isExpiring(doc.expirationDate) ? "secondary" : "secondary"}
                            >
                              {isExpired(doc.expirationDate) ? "Expired" : 
                               `Expires ${formatDate(doc.expirationDate)}`}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Licenses Tab */}
          <TabsContent value="licenses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Licenses & Certifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* State Licenses */}
                  {licenses?.stateLicenses && licenses.stateLicenses.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        State Licenses
                      </h3>
                      <div className="space-y-2">
                        {licenses.stateLicenses.map((license) => (
                          <div key={license.id} className="p-3 border rounded-lg">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">State License</p>
                                <p className="text-sm text-muted-foreground">
                                  License #{license.licenseNumber} • {license.state}
                                </p>
                              </div>
                              <Badge 
                                variant={isExpired(license.expirationDate) ? "destructive" : 
                                        isExpiring(license.expirationDate) ? "secondary" : "secondary"}
                              >
                                {isExpired(license.expirationDate) ? "Expired" : 
                                 `Expires ${formatDate(license.expirationDate)}`}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* DEA Licenses */}
                  {licenses?.deaLicenses && licenses.deaLicenses.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        DEA Licenses
                      </h3>
                      <div className="space-y-2">
                        {licenses.deaLicenses.map((license) => (
                          <div key={license.id} className="p-3 border rounded-lg">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">DEA Registration</p>
                                <p className="text-sm text-muted-foreground">
                                  Registration #{license.licenseNumber}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Status: {license.status || "Active"}
                                </p>
                              </div>
                              <Badge 
                                variant={isExpired(license.expirationDate) ? "destructive" : 
                                        isExpiring(license.expirationDate) ? "secondary" : "secondary"}
                              >
                                {isExpired(license.expirationDate) ? "Expired" : 
                                 `Expires ${formatDate(license.expirationDate)}`}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Board Certifications */}
                  {licenses?.boardCertifications && licenses.boardCertifications.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Award className="w-4 h-4" />
                        Board Certifications
                      </h3>
                      <div className="space-y-2">
                        {licenses.boardCertifications.map((cert) => (
                          <div key={cert.id} className="p-3 border rounded-lg">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">{cert.boardName}</p>
                                <p className="text-sm text-muted-foreground">
                                  {cert.certification}
                                </p>
                              </div>
                              <Badge 
                                variant={isExpired(cert.expirationDate) ? "destructive" : 
                                        isExpiring(cert.expirationDate) ? "secondary" : "secondary"}
                              >
                                {isExpired(cert.expirationDate) ? "Expired" : 
                                 `Expires ${formatDate(cert.expirationDate)}`}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!licenses?.stateLicenses?.length && 
                    !licenses?.deaLicenses?.length && 
                    !licenses?.boardCertifications?.length) && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No licenses or certifications on file. Please contact HR to add your credentials.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Training Tab */}
          <TabsContent value="training" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  Training Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trainings.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No training records found.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {trainings.map((training: any) => (
                        <div key={training.id} className="p-3 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{training.trainingType}</p>
                              <p className="text-sm text-muted-foreground">
                                {training.provider}
                                {training.credits != null ? ` • ${training.credits} credits` : ''}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Completed: {formatDate(training.completionDate)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Expires: {training.expirationDate ? formatDate(training.expirationDate) : '—'}
                              </p>
                            </div>
                            {training.certificatePath && (
                              <Badge variant="secondary">
                                Cert: {training.certificatePath}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            {/* Education History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  Education History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {education.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No education history on file.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {education.map((edu: any) => (
                      <div key={edu.id} className="p-3 border rounded-lg">
                        <p className="font-medium">{edu.schoolInstitution}</p>
                        <p className="text-sm text-muted-foreground">
                          {edu.educationType} · {edu.degree}
                          {edu.specialtyMajor ? ` in ${edu.specialtyMajor}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(edu.startDate)} - {edu.endDate ? formatDate(edu.endDate) : 'Present'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Employment History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Employment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {employmentHistory.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No employment history on file.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {employmentHistory.map((emp: any) => (
                      <div key={emp.id} className="p-3 border rounded-lg">
                        <p className="font-medium">{emp.employer}</p>
                        <p className="text-sm text-muted-foreground">{emp.position}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(emp.startDate)} - {emp.endDate ? formatDate(emp.endDate) : "Present"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Emergency Contact Dialog */}
        <Dialog open={isAddingContact} onOpenChange={setIsAddingContact}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Emergency Contact</DialogTitle>
              <DialogDescription>
                Add a new emergency contact to your profile
              </DialogDescription>
            </DialogHeader>
            <Form {...contactForm}>
              <form onSubmit={contactForm.handleSubmit(handleAddContact)} className="space-y-4">
                <FormField
                  control={contactForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Relationship</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Spouse, Parent, Friend" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} type="email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      setIsAddingContact(false);
                      contactForm.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateContactsMutation.isPending}>
                    {updateContactsMutation.isPending ? "Adding..." : "Add Contact"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Document Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Upload a document to your profile
              </DialogDescription>
            </DialogHeader>
            <FileUpload
              onUpload={(formData: FormData) => {
                fetch('/api/employee/documents', {
                  method: 'POST',
                  body: formData,
                  credentials: 'include'
                }).then(() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/employee/documents"] });
                  setUploadDialogOpen(false);
                  toast({
                    title: "Success",
                    description: "Document uploaded successfully"
                  });
                }).catch((error) => {
                  toast({
                    title: "Error",
                    description: "Failed to upload document",
                    variant: "destructive"
                  });
                });
              }}
              isUploading={false}
              employeeId={profile?.id}
            />
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}