import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import type { Employee } from "@/lib/types";
import { EducationsManager } from "@/components/entity-managers/educations-manager";
import { EmploymentsManager } from "@/components/entity-managers/employments-manager";
import { LicensesManager } from "@/components/entity-managers/licenses-manager";
import { PeerReferencesManager } from "@/components/entity-managers/peer-references-manager";
import { BoardCertificationsManager } from "@/components/entity-managers/board-certifications-manager";
import { EmergencyContactsManager } from "@/components/entity-managers/emergency-contacts-manager";
import { TaxFormsManager } from "@/components/entity-managers/tax-forms-manager";
import { TrainingsManager } from "@/components/entity-managers/trainings-manager";
import { PayerEnrollmentsManager } from "@/components/entity-managers/payer-enrollments-manager";
import { IncidentLogsManager } from "@/components/entity-managers/incident-logs-manager";

export default function EmployeeProfile() {
  const params = useParams();
  const [, navigate] = useLocation();
  const employeeId = parseInt(params.id || "0");

  const { data: employee, isLoading, error } = useQuery<Employee>({
    queryKey: ["/api/employees", employeeId],
    enabled: !!employeeId
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading employee profile...</p>
        </div>
      </MainLayout>
    );
  }

  if (error || !employee) {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <p className="text-destructive">Failed to load employee profile</p>
        </div>
      </MainLayout>
    );
  }

  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-secondary/10 text-secondary">Active</Badge>;
      case 'inactive':
        return <Badge className="bg-destructive/10 text-destructive">Inactive</Badge>;
      case 'on_leave':
        return <Badge className="bg-accent/10 text-accent">On Leave</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "Not provided";
    return new Date(date).toLocaleDateString();
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/employees")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground" data-testid="text-profile-title">
                Employee Profile
              </h1>
              <p className="text-muted-foreground">
                {employee.firstName} {employee.lastName}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              onClick={() => navigate(`/employees/${employeeId}/edit`)}
              data-testid="button-edit"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button 
              variant="destructive"
              data-testid="button-delete"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <Avatar className="w-20 h-20 mx-auto mb-2">
                    <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
                      {getUserInitials(employee.firstName, employee.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <h4 className="font-semibold text-foreground" data-testid="text-employee-name">
                    {employee.firstName} {employee.lastName}
                  </h4>
                  <p className="text-sm text-muted-foreground">{employee.jobTitle}</p>
                  {getStatusBadge(employee.status)}
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="text-foreground" data-testid="text-work-email">{employee.workEmail}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="text-foreground">{employee.cellPhone || "Not provided"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">NPI Number</label>
                    <p className="text-foreground">{employee.npiNumber || "Not provided"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">SSN</label>
                    <p className="text-foreground">{employee.ssn || "Not provided"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Professional Information */}
          <Card>
            <CardHeader>
              <CardTitle>Professional Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Medical License</label>
                  <p className="text-foreground">{employee.medicalLicenseNumber || "Not provided"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Work Location</label>
                  <p className="text-foreground">{employee.workLocation || "Not provided"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Medicaid Number</label>
                  <p className="text-foreground">{employee.medicaidNumber || "Not provided"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Medicare PTAN</label>
                  <p className="text-foreground">{employee.medicarePtanNumber || "Not provided"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">CAQH Provider ID</label>
                  <p className="text-foreground">{employee.caqhProviderId || "Not provided"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">CAQH Status</label>
                  <Badge variant={employee.caqhEnabled ? "default" : "secondary"}>
                    {employee.caqhEnabled ? "Active" : "Inactive"}
                  </Badge>
                  {employee.caqhLastAttestationDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last Attestation: {formatDate(employee.caqhLastAttestationDate)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Home Address</label>
                  <p className="text-foreground">
                    {[
                      employee.homeAddress1,
                      employee.homeAddress2,
                      employee.homeCity && employee.homeState && `${employee.homeCity}, ${employee.homeState}`,
                      employee.homeZip
                    ].filter(Boolean).join(", ") || "Not provided"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Personal Email</label>
                  <p className="text-foreground">{employee.personalEmail || "Not provided"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                  <p className="text-foreground">{formatDate(employee.dateOfBirth)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Information Tabs */}
        <Tabs defaultValue="education" className="space-y-4">
          <ScrollArea className="w-full">
            <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground">
              <TabsTrigger value="education">Education</TabsTrigger>
              <TabsTrigger value="employment">Employment</TabsTrigger>
              <TabsTrigger value="state-licenses">State Licenses</TabsTrigger>
              <TabsTrigger value="dea-licenses">DEA Licenses</TabsTrigger>
              <TabsTrigger value="certifications">Board Certifications</TabsTrigger>
              <TabsTrigger value="trainings">Training</TabsTrigger>
              <TabsTrigger value="references">References</TabsTrigger>
              <TabsTrigger value="emergency">Emergency Contacts</TabsTrigger>
              <TabsTrigger value="tax">Tax Forms</TabsTrigger>
              <TabsTrigger value="payer">Payer Enrollments</TabsTrigger>
              <TabsTrigger value="incidents">Incident Logs</TabsTrigger>
            </TabsList>
          </ScrollArea>
          
          <TabsContent value="education">
            <EducationsManager employeeId={employeeId} />
          </TabsContent>
          
          <TabsContent value="employment">
            <EmploymentsManager employeeId={employeeId} />
          </TabsContent>
          
          <TabsContent value="state-licenses">
            <LicensesManager employeeId={employeeId} type="state" />
          </TabsContent>
          
          <TabsContent value="dea-licenses">
            <LicensesManager employeeId={employeeId} type="dea" />
          </TabsContent>
          
          <TabsContent value="certifications">
            <BoardCertificationsManager employeeId={employeeId} />
          </TabsContent>
          
          <TabsContent value="trainings">
            <TrainingsManager employeeId={employeeId} />
          </TabsContent>
          
          <TabsContent value="references">
            <PeerReferencesManager employeeId={employeeId} />
          </TabsContent>
          
          <TabsContent value="emergency">
            <EmergencyContactsManager employeeId={employeeId} />
          </TabsContent>
          
          <TabsContent value="tax">
            <TaxFormsManager employeeId={employeeId} />
          </TabsContent>
          
          <TabsContent value="payer">
            <PayerEnrollmentsManager employeeId={employeeId} />
          </TabsContent>
          
          <TabsContent value="incidents">
            <IncidentLogsManager employeeId={employeeId} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
