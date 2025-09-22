import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Edit,
  Trash2,
  Printer,
  Download,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  Briefcase,
  GraduationCap,
  Shield,
  FileText,
  Users,
  AlertTriangle,
  CreditCard,
  UserCheck,
  Home,
  Clock,
  Building,
  Hash,
  BadgeIcon,
  Activity,
  IdCard,
  Stethoscope,
  User,
  MapPinned,
  FileCheck,
  UserPlus,
  FileSignature
} from "lucide-react";
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
import { FormsManager } from "@/components/entity-managers/forms-manager";

export default function EmployeeProfile() {
  const params = useParams();
  const [, navigate] = useLocation();
  const employeeId = parseInt(params.id || "0");
  const lastUpdated = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const { data: employee, isLoading, error } = useQuery<Employee>({
    queryKey: ["/api/employees", employeeId],
    enabled: !!employeeId
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3">
            <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="text-muted-foreground animate-pulse">Loading employee profile...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error || !employee) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to Load Profile</h3>
              <p className="text-muted-foreground mb-4">Unable to fetch employee information</p>
              <Button onClick={() => navigate("/employees")} variant="outline">
                Return to Employees
              </Button>
            </CardContent>
          </Card>
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
        return (
          <Badge className="bg-gradient-to-r from-secondary/20 to-secondary/10 text-secondary border-secondary/30 px-3 py-1">
            <Activity className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case 'inactive':
        return (
          <Badge className="bg-gradient-to-r from-destructive/20 to-destructive/10 text-destructive border-destructive/30 px-3 py-1">
            <Activity className="w-3 h-3 mr-1" />
            Inactive
          </Badge>
        );
      case 'on_leave':
        return (
          <Badge className="bg-gradient-to-r from-accent/20 to-accent/10 text-accent-foreground border-accent/30 px-3 py-1">
            <Clock className="w-3 h-3 mr-1" />
            On Leave
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "Not provided";
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatPhoneNumber = (phone: string | null | undefined) => {
    if (!phone) return "Not provided";
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // Export functionality placeholder
    console.log('Exporting employee data...');
  };

  return (
    <TooltipProvider>
      <MainLayout>
        <div className="space-y-6">
          {/* Breadcrumb Navigation */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/dashboard">
                    <Home className="h-4 w-4" />
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/employees">Employees</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {employee.firstName} {employee.lastName}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Hero Section */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border border-primary/10 shadow-sm">
            <div className="absolute inset-0 bg-grid-pattern opacity-5" />
            <div className="relative p-8">
              <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-6">
                <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
                  <Avatar className="h-32 w-32 border-4 border-background shadow-xl ring-4 ring-primary/10">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-4xl font-bold">
                      {getUserInitials(employee.firstName, employee.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center lg:text-left space-y-2">
                    <h1 className="text-4xl font-bold tracking-tight" data-testid="text-employee-name">
                      {employee.firstName} {employee.middleName ? `${employee.middleName} ` : ''}{employee.lastName}
                    </h1>
                    <div className="flex flex-col lg:flex-row items-center lg:items-start gap-3">
                      <p className="text-xl text-muted-foreground font-medium">
                        {employee.jobTitle || "Healthcare Professional"}
                      </p>
                      {employee.workLocation && (
                        <div className="flex items-center text-muted-foreground">
                          <MapPinned className="w-4 h-4 mr-1" />
                          <span>{employee.workLocation}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 pt-2">
                      {getStatusBadge(employee.status)}
                      <span className="text-sm text-muted-foreground">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Last updated: {lastUpdated}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => navigate(`/employees/${employeeId}/edit`)}
                        size="lg"
                        data-testid="button-edit"
                        className="shadow-sm"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Profile
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit employee information</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handlePrint}
                        variant="outline"
                        size="lg"
                        data-testid="button-print"
                        className="shadow-sm"
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Print
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Print profile</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleExport}
                        variant="outline"
                        size="lg"
                        data-testid="button-export"
                        className="shadow-sm"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export as PDF</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>

          {/* Information Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contact & Personal Information Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow border-muted/50">
              <CardHeader className="bg-gradient-to-br from-muted/30 to-muted/10 border-b">
                <CardTitle className="flex items-center text-lg">
                  <User className="w-5 h-5 mr-2 text-primary" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Work Email</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm font-medium" data-testid="text-work-email">
                            {employee.workEmail || "Not provided"}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>Primary work email</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Personal Email</p>
                      <p className="text-sm font-medium">
                        {employee.personalEmail || "Not provided"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</p>
                      <p className="text-sm font-medium">
                        {formatPhoneNumber(employee.cellPhone)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Home Address</p>
                      <p className="text-sm font-medium">
                        {employee.homeAddress1 || "Not provided"}
                        {employee.homeAddress2 && <><br />{employee.homeAddress2}</>}
                        {(employee.homeCity || employee.homeState || employee.homeZip) && (
                          <>
                            <br />
                            {[employee.homeCity, employee.homeState, employee.homeZip].filter(Boolean).join(", ")}
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date of Birth</p>
                      <p className="text-sm font-medium">
                        {formatDate(employee.dateOfBirth)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Professional Credentials Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow border-muted/50">
              <CardHeader className="bg-gradient-to-br from-primary/10 to-primary/5 border-b">
                <CardTitle className="flex items-center text-lg">
                  <Stethoscope className="w-5 h-5 mr-2 text-primary" />
                  Professional Credentials
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Hash className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">NPI Number</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm font-semibold text-primary">
                            {employee.npiNumber || "Not provided"}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>National Provider Identifier</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <FileCheck className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Medical License</p>
                      <p className="text-sm font-semibold text-primary">
                        {employee.medicalLicenseNumber || "Not provided"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <IdCard className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">SSN</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm font-medium">
                            {employee.ssn ? "***-**-" + employee.ssn.slice(-4) : "Not provided"}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>Social Security Number (Protected)</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="flex items-start gap-3">
                    <CreditCard className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Medicaid Number</p>
                      <p className="text-sm font-medium">
                        {employee.medicaidNumber || "Not provided"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CreditCard className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Medicare PTAN</p>
                      <p className="text-sm font-medium">
                        {employee.medicarePtanNumber || "Not provided"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CAQH & System Information Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow border-muted/50">
              <CardHeader className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-b">
                <CardTitle className="flex items-center text-lg">
                  <Shield className="w-5 h-5 mr-2 text-secondary" />
                  CAQH & System Info
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <BadgeIcon className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CAQH Provider ID</p>
                      <p className="text-sm font-semibold">
                        {employee.caqhProviderId || "Not provided"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Activity className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CAQH Status</p>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={employee.caqhEnabled ? "default" : "secondary"}
                          className={employee.caqhEnabled ? "bg-secondary/10 text-secondary border-secondary/30" : ""}
                        >
                          {employee.caqhEnabled ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {employee.caqhLastAttestationDate && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last Attestation: {formatDate(employee.caqhLastAttestationDate)}
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="flex items-start gap-3">
                    <Building className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Work Location</p>
                      <p className="text-sm font-medium">
                        {employee.workLocation || "Not assigned"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <UserPlus className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Account Created</p>
                      <p className="text-sm font-medium">
                        {formatDate(employee.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Hash className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Employee ID</p>
                      <p className="text-sm font-medium">
                        #{employee.id.toString().padStart(6, '0')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Tabs Section */}
          <Card className="shadow-sm border-muted/50">
            <CardHeader className="bg-gradient-to-r from-muted/20 to-transparent border-b">
              <CardTitle className="text-xl flex items-center">
                <FileText className="w-5 h-5 mr-2 text-primary" />
                Employee Records & Documentation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="education" className="w-full">
                <ScrollArea className="w-full border-b">
                  <TabsList className="w-full justify-start h-14 bg-transparent rounded-none p-0">
                    <TabsTrigger 
                      value="education"
                      className="data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-6"
                    >
                      <GraduationCap className="w-4 h-4 mr-2" />
                      Education
                    </TabsTrigger>
                    <TabsTrigger 
                      value="employment"
                      className="data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-6"
                    >
                      <Briefcase className="w-4 h-4 mr-2" />
                      Employment
                    </TabsTrigger>
                    <TabsTrigger 
                      value="state-licenses"
                      className="data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-6"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      State Licenses
                    </TabsTrigger>
                    <TabsTrigger 
                      value="dea-licenses"
                      className="data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-6"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      DEA Licenses
                    </TabsTrigger>
                    <TabsTrigger 
                      value="certifications"
                      className="data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-6"
                    >
                      <Award className="w-4 h-4 mr-2" />
                      Certifications
                    </TabsTrigger>
                    <TabsTrigger 
                      value="trainings"
                      className="data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-6"
                    >
                      <GraduationCap className="w-4 h-4 mr-2" />
                      Training
                    </TabsTrigger>
                    <TabsTrigger 
                      value="references"
                      className="data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-6"
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      References
                    </TabsTrigger>
                    <TabsTrigger 
                      value="emergency"
                      className="data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-6"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Emergency
                    </TabsTrigger>
                    <TabsTrigger 
                      value="tax"
                      className="data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-6"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Tax Forms
                    </TabsTrigger>
                    <TabsTrigger 
                      value="forms"
                      className="data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-6"
                      data-testid="tab-forms"
                    >
                      <FileSignature className="w-4 h-4 mr-2" />
                      Forms
                    </TabsTrigger>
                    <TabsTrigger 
                      value="payer"
                      className="data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-6"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Payer
                    </TabsTrigger>
                    <TabsTrigger 
                      value="incidents"
                      className="data-[state=active]:bg-primary/10 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-6"
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Incidents
                    </TabsTrigger>
                  </TabsList>
                </ScrollArea>
                
                <div className="p-6">
                  <TabsContent value="education" className="mt-0 animate-in fade-in-50 duration-300">
                    <EducationsManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="employment" className="mt-0 animate-in fade-in-50 duration-300">
                    <EmploymentsManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="state-licenses" className="mt-0 animate-in fade-in-50 duration-300">
                    <LicensesManager employeeId={employeeId} type="state" />
                  </TabsContent>
                  
                  <TabsContent value="dea-licenses" className="mt-0 animate-in fade-in-50 duration-300">
                    <LicensesManager employeeId={employeeId} type="dea" />
                  </TabsContent>
                  
                  <TabsContent value="certifications" className="mt-0 animate-in fade-in-50 duration-300">
                    <BoardCertificationsManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="trainings" className="mt-0 animate-in fade-in-50 duration-300">
                    <TrainingsManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="references" className="mt-0 animate-in fade-in-50 duration-300">
                    <PeerReferencesManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="emergency" className="mt-0 animate-in fade-in-50 duration-300">
                    <EmergencyContactsManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="tax" className="mt-0 animate-in fade-in-50 duration-300">
                    <TaxFormsManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="payer" className="mt-0 animate-in fade-in-50 duration-300">
                    <PayerEnrollmentsManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="incidents" className="mt-0 animate-in fade-in-50 duration-300">
                    <IncidentLogsManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="forms" className="mt-0 animate-in fade-in-50 duration-300">
                    <FormsManager employeeId={employeeId} />
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    </TooltipProvider>
  );
}