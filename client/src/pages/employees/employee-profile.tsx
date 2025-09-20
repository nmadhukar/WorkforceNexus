import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Trash2, Plus } from "lucide-react";
import type { Employee } from "@/lib/types";

export default function EmployeeProfile() {
  const params = useParams();
  const [, navigate] = useLocation();
  const employeeId = parseInt(params.id || "0");

  const { data: employee, isLoading, error } = useQuery<Employee>({
    queryKey: ["/api/employees", employeeId],
    enabled: !!employeeId
  });

  const { data: educations = [] } = useQuery({
    queryKey: ["/api/employees", employeeId, "educations"],
    enabled: !!employeeId
  });

  const { data: stateLicenses = [] } = useQuery({
    queryKey: ["/api/employees", employeeId, "state-licenses"],
    enabled: !!employeeId
  });

  const { data: deaLicenses = [] } = useQuery({
    queryKey: ["/api/employees", employeeId, "dea-licenses"],
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
          <TabsList>
            <TabsTrigger value="education">Education</TabsTrigger>
            <TabsTrigger value="licenses">Licenses</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="training">Training</TabsTrigger>
          </TabsList>
          
          <TabsContent value="education">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Education History</CardTitle>
                <Button size="sm" data-testid="button-add-education">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Education
                </Button>
              </CardHeader>
              <CardContent>
                {educations.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No education records found
                  </p>
                ) : (
                  <div className="space-y-4">
                    {educations.map((education: any, index: number) => (
                      <div key={index} className="border border-border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h5 className="font-medium text-foreground">
                              {education.degree || "Degree not specified"}
                            </h5>
                            <p className="text-muted-foreground">
                              {education.schoolInstitution || "Institution not specified"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(education.startDate)} - {formatDate(education.endDate)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="licenses">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Licenses & Certifications</CardTitle>
                <Button size="sm" data-testid="button-add-license">
                  <Plus className="w-4 h-4 mr-2" />
                  Add License
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* State Licenses */}
                  <div>
                    <h6 className="font-medium text-foreground mb-3">State Licenses</h6>
                    {stateLicenses.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No state licenses found</p>
                    ) : (
                      <div className="space-y-2">
                        {stateLicenses.map((license: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-3 border border-border rounded">
                            <div>
                              <p className="font-medium">{license.licenseNumber}</p>
                              <p className="text-sm text-muted-foreground">
                                {license.state} • Expires: {formatDate(license.expirationDate)}
                              </p>
                            </div>
                            <Badge variant={license.status === 'active' ? 'default' : 'secondary'}>
                              {license.status || 'Active'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* DEA Licenses */}
                  <div>
                    <h6 className="font-medium text-foreground mb-3">DEA Licenses</h6>
                    {deaLicenses.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No DEA licenses found</p>
                    ) : (
                      <div className="space-y-2">
                        {deaLicenses.map((license: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-3 border border-border rounded">
                            <div>
                              <p className="font-medium">{license.licenseNumber}</p>
                              <p className="text-sm text-muted-foreground">
                                Expires: {formatDate(license.expirationDate)}
                              </p>
                            </div>
                            <Badge variant={license.status === 'active' ? 'default' : 'secondary'}>
                              {license.status || 'Active'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Documents management coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="training">
            <Card>
              <CardHeader>
                <CardTitle>Training & CEUs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Training records coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
