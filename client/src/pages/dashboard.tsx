import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MainLayout } from "@/components/layout/main-layout";
import { useAuth } from "@/hooks/use-auth";
import { Users, UserCheck, AlertTriangle, UserPlus, Download, Upload, TrendingUp, Award, Clock, FileText, AlertCircle, CheckCircle, Building2, ClipboardList, User, Lock, Calendar, CheckSquare, ArrowRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";

/**
 * Statistical data for dashboard overview cards
 */
interface DashboardStats {
  totalEmployees: number;
  activeLicenses: number;
  expiringSoon: number;
  complianceRate: number;
}

interface ComplianceMetrics {
  totalLocations: number;
  totalLicenses: number;
  activeLicenses: number;
  expiringIn30Days: number;
  expiringIn60Days: number;
  expiringIn90Days: number;
  expiredLicenses: number;
  documentsCount: number;
}

interface ComplianceAlert {
  id: number;
  type: string;
  severity: string;
  message: string;
  entityId: number;
  entityType: string;
  responsiblePerson?: string;
  daysUntilExpiration?: number;
}

/**
 * Recent activity entry for the activity feed
 */
interface RecentActivity {
  id: number;
  type: string;
  description: string;
  timestamp: string;
  entityType?: string;
  entityId?: number;
}

/**
 * Main dashboard page displaying HR management system overview with statistics,
 * recent activity feed, quick actions, and upcoming expirations
 * @component
 * @returns {JSX.Element} Dashboard interface with stats cards, activity feed, and quick action buttons
 * @example
 * <Dashboard />
 * 
 * @description
 * - Displays key metrics: total employees, active licenses, expiring items, compliance rate
 * - Shows recent system activity with icon-coded activity types
 * - Provides quick action buttons for common tasks (add employee, generate reports, upload documents)
 * - Lists upcoming license/certification expirations with priority badges
 * - All stats cards are clickable and navigate to relevant detailed views
 * - Uses data-testid attributes for testing automation
 */
export default function Dashboard() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const userRole = user?.role || "viewer";
  
  // Only fetch admin/hr data for authorized roles
  const shouldFetchAdminData = userRole === "admin" || userRole === "hr";
  
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    enabled: shouldFetchAdminData,
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats", { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch dashboard stats');
      return res.json();
    }
  });

  const { data: activities = [] } = useQuery<RecentActivity[]>({
    queryKey: ["/api/dashboard/activities"],
    enabled: shouldFetchAdminData,
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`${queryKey[0]}?limit=5`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch activities');
      return res.json();
    }
  });

  const { data: expiringItems = [] } = useQuery({
    queryKey: ["/api/dashboard/expirations"],
    enabled: shouldFetchAdminData,
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`${queryKey[0]}?days=30`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch expiring items');
      return res.json();
    }
  });

  // Fetch compliance dashboard data
  const { data: complianceData } = useQuery<ComplianceMetrics>({
    queryKey: ["/api/compliance/dashboard"],
    enabled: shouldFetchAdminData
  });

  // Fetch compliance alerts
  const { data: complianceAlerts = [] } = useQuery<ComplianceAlert[]>({
    queryKey: ["/api/compliance/alerts"],
    enabled: shouldFetchAdminData
  });

  // Fetch tasks due soon for the widget
  const { data: tasksDueSoon, isLoading: isTasksLoading } = useQuery({
    queryKey: ["/api/tasks", { dueInDays: 7 }],
    enabled: shouldFetchAdminData,
    queryFn: async () => {
      const response = await fetch("/api/tasks?dueInDays=7", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch tasks");
      const tasks = await response.json();
      return {
        count: tasks.filter((t: any) => t.status !== "completed").length,
        tasks: tasks.filter((t: any) => t.status !== "completed").slice(0, 5)
      };
    }
  });

  // Calculate compliance score
  const complianceScore = complianceData 
    ? Math.round((complianceData.activeLicenses / Math.max(complianceData.totalLicenses, 1)) * 100)
    : 0;

  // Render different dashboards based on user role
  if (userRole === "prospective_employee") {
    // Limited onboarding dashboard for prospective employees
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-dashboard-title">Welcome</h1>
            <p className="text-muted-foreground">Complete your onboarding to get started</p>
          </div>

          {/* Onboarding Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                Onboarding Status
              </CardTitle>
              <CardDescription>Track your onboarding progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Action Required</AlertTitle>
                  <AlertDescription>
                    Please complete your onboarding forms to gain full access to the system.
                  </AlertDescription>
                </Alert>
                
                <div className="pt-4">
                  <Link href="/onboarding">
                    <Button className="w-full" data-testid="button-continue-onboarding">
                      <ClipboardList className="w-4 h-4 mr-2" />
                      Continue Onboarding
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions for Prospective Employees */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Link href="/onboarding">
                  <Button className="w-full" data-testid="button-continue-onboarding">
                    <ClipboardList className="w-5 h-5 mr-3" />
                    Continue Onboarding
                  </Button>
                </Link>
                
                <Button 
                  className="w-full" 
                  variant="outline" 
                  onClick={() => {
                    const element = document.querySelector('[data-testid="card-required-documents"]');
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  data-testid="button-view-required-documents"
                >
                  <FileText className="w-5 h-5 mr-3" />
                  View Required Documents
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Required Documents Card */}
          <Card data-testid="card-required-documents">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Required Documents
              </CardTitle>
              <CardDescription>Documents needed to complete your onboarding</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    Please prepare the following documents for your onboarding:
                  </AlertDescription>
                </Alert>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span>Valid government-issued ID</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span>Social Security card</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span>Professional licenses and certifications</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span>Education transcripts or diplomas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span>Employment verification letters</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span>Professional references</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span>Emergency contact information</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span>Tax forms (W-4, state tax forms)</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (userRole === "employee") {
    // Self-service dashboard for regular employees
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-dashboard-title">My Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {user?.username}</p>
          </div>

          {/* Employee Self-Service Portal Link - Prominent */}
          <Card className="border-2 border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">My Self-Service Portal</h2>
                  <p className="text-muted-foreground">
                    Manage your personal information, documents, emergency contacts, licenses, and more in one central location
                  </p>
                </div>
                <User className="w-12 h-12 text-primary" />
              </div>
              <div className="mt-6">
                <Link href="/employee-portal">
                  <Button size="lg" className="w-full" data-testid="link-my-portal">
                    <User className="w-5 h-5 mr-2" />
                    Access My Portal
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Employee Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Quick Access</p>
                    <p className="text-lg font-semibold">View your complete profile</p>
                  </div>
                  <User className="w-8 h-8 text-primary" />
                </div>
                <div className="mt-4">
                  <Link href="/employee-portal">
                    <Button variant="outline" size="sm" className="w-full">
                      View Profile
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">My Documents</p>
                    <p className="text-lg font-semibold">Access your documents</p>
                  </div>
                  <FileText className="w-8 h-8 text-secondary" />
                </div>
                <div className="mt-4">
                  <Link href="/employee-portal?tab=documents">
                    <Button variant="outline" size="sm" className="w-full">
                      View Documents
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Employee Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Link href="/employee-portal">
                  <Button className="w-full" data-testid="button-view-profile">
                    <User className="w-5 h-5 mr-3" />
                    Access My Portal
                  </Button>
                </Link>
                
                <Link href="/employee-portal?tab=documents">
                  <Button className="w-full" variant="outline" data-testid="button-upload-documents">
                    <Upload className="w-5 h-5 mr-3" />
                    Upload Documents
                  </Button>
                </Link>
                
                <Button 
                  className="w-full" 
                  variant="outline" 
                  onClick={() => {
                    // Request Time Off functionality to be implemented
                    alert('Time off request feature coming soon!');
                  }}
                  data-testid="button-request-time-off"
                >
                  <Calendar className="w-5 h-5 mr-3" />
                  Request Time Off
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Full dashboard for admin/hr users
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your HR management dashboard</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href="/employees">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" data-testid="card-total-employees">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-total-employees">
                      {stats?.totalEmployees || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/employees?filter=licenses">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" data-testid="card-active-licenses">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Licenses</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-active-licenses">
                      {stats?.activeLicenses || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                    <UserCheck className="w-6 h-6 text-secondary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/reports?filter=expiring">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" data-testid="card-expiring-soon">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Expiring Soon</p>
                    <p className="text-2xl font-bold text-destructive" data-testid="text-expiring-soon">
                      {stats?.expiringSoon || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/reports">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" data-testid="card-compliance-rate">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Compliance Rate</p>
                    <p className="text-2xl font-bold text-accent" data-testid="text-compliance-rate">
                      {stats?.complianceRate || 0}%
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Compliance Overview Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Compliance Overview Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-primary" />
                    Compliance Overview
                  </CardTitle>
                  <CardDescription>Real-time compliance status and metrics</CardDescription>
                </div>
                <Link href="/compliance-dashboard">
                  <Button variant="outline" size="sm" data-testid="button-view-compliance-dashboard">
                    View Full Dashboard
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Compliance Score</p>
                  <p className="text-2xl font-bold">
                    <span className={complianceScore >= 90 ? "text-green-600" : complianceScore >= 70 ? "text-yellow-600" : "text-destructive"}>
                      {complianceScore}%
                    </span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Active Licenses</p>
                  <p className="text-2xl font-bold text-green-600">{complianceData?.activeLicenses || 0}</p>
                  <p className="text-xs text-muted-foreground">of {complianceData?.totalLicenses || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Expiring (30d)</p>
                  <p className="text-2xl font-bold text-yellow-600">{complianceData?.expiringIn30Days || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Expired</p>
                  <p className="text-2xl font-bold text-destructive">{complianceData?.expiredLicenses || 0}</p>
                </div>
              </div>

              {/* Compliance Alerts */}
              {complianceAlerts.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium mb-2">Recent Compliance Alerts</p>
                  {complianceAlerts.slice(0, 3).map((alert) => (
                    <Alert 
                      key={alert.id} 
                      variant={alert.severity === 'high' ? 'destructive' : 'default'}
                      className="py-2"
                    >
                      <div className="flex items-center gap-2">
                        {alert.severity === 'high' ? (
                          <AlertCircle className="w-4 h-4" />
                        ) : (
                          <Clock className="w-4 h-4" />
                        )}
                        <AlertDescription className="text-sm">
                          {alert.message}
                          {alert.responsiblePerson && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({alert.responsiblePerson})
                            </span>
                          )}
                        </AlertDescription>
                      </div>
                    </Alert>
                  ))}
                </div>
              )}

              {/* Expiration Breakdown */}
              <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium">30 Days</span>
                  </div>
                  <p className="text-xl font-bold text-yellow-600 mt-1">
                    {complianceData?.expiringIn30Days || 0}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-medium">60 Days</span>
                  </div>
                  <p className="text-xl font-bold text-orange-600 mt-1">
                    {(complianceData?.expiringIn60Days || 0) - (complianceData?.expiringIn30Days || 0)}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">90 Days</span>
                  </div>
                  <p className="text-xl font-bold text-blue-600 mt-1">
                    {(complianceData?.expiringIn90Days || 0) - (complianceData?.expiringIn60Days || 0)}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-4 pt-4 border-t flex gap-2">
                <Link href="/licenses/new">
                  <Button variant="outline" size="sm" data-testid="button-add-license">
                    <Award className="w-4 h-4 mr-2" />
                    Add License
                  </Button>
                </Link>
                <Link href="/compliance-documents/upload">
                  <Button variant="outline" size="sm" data-testid="button-upload-compliance-doc">
                    <FileText className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                </Link>
                <Link href="/licenses?filter=expiring">
                  <Button variant="outline" size="sm" data-testid="button-view-expiring-licenses">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    View Expiring
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Tasks Widget */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5" />
                  <span>Tasks Due Soon</span>
                </div>
                <Link href="/tasks/dashboard">
                  <Button variant="outline" size="sm" data-testid="button-view-all-tasks">
                    View All
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isTasksLoading ? (
                <div className="text-center py-4">Loading tasks...</div>
              ) : (
                <>
                  <div className="mb-4 p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Tasks Due in 7 Days</p>
                        <p className="text-3xl font-bold">{tasksDueSoon?.count || 0}</p>
                      </div>
                      <Clock className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </div>

                  {tasksDueSoon?.tasks && tasksDueSoon.tasks.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Upcoming Tasks</p>
                      {tasksDueSoon.tasks.slice(0, 5).map((task: any) => (
                        <div key={task.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{task.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                Due {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                              {task.assignedToName && (
                                <>
                                  <span className="text-xs text-muted-foreground">•</span>
                                  <span className="text-xs text-muted-foreground">{task.assignedToName}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Link href={`/tasks/${task.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground mb-4">No upcoming tasks</p>
                      <Link href="/tasks/new">
                        <Button variant="outline" size="sm" data-testid="button-create-task">
                          Create Task
                        </Button>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity and Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities.slice(0, 5).map((activity: RecentActivity, index: number) => {
                  /**
                   * Returns appropriate icon for activity type
                   * @param {string} activityType - The type of activity (CREATE, UPDATE, DELETE, etc.)
                   * @returns {JSX.Element} Icon component with appropriate styling
                   */
                  const getActivityIcon = () => {
                    if (activity.type?.includes('CREATE')) return <UserPlus className="w-4 h-4 text-primary" />;
                    if (activity.type?.includes('UPDATE')) return <Download className="w-4 h-4 text-secondary" />;
                    if (activity.type?.includes('DELETE')) return <AlertTriangle className="w-4 h-4 text-destructive" />;
                    return <Upload className="w-4 h-4 text-accent" />;
                  };
                  
                  /**
                   * Returns appropriate background class for activity icon
                   * @param {string} activityType - The type of activity
                   * @returns {string} CSS class for background styling
                   */
                  const getIconBg = () => {
                    if (activity.type?.includes('CREATE')) return 'bg-primary/10';
                    if (activity.type?.includes('UPDATE')) return 'bg-secondary/10';
                    if (activity.type?.includes('DELETE')) return 'bg-destructive/10';
                    return 'bg-accent/10';
                  };
                  
                  return (
                    <div key={activity.id} className="flex items-center space-x-3" data-testid={`activity-item-${index}`}>
                      <div className={`w-8 h-8 ${getIconBg()} rounded-full flex items-center justify-center`}>
                        {getActivityIcon()}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground">
                          {activity.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'Recent'}
                        </p>
                      </div>
                    </div>
                  );
                })}
                
                {activities.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent activity to display
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Link href="/employees/new">
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-add-employee">
                    <UserPlus className="w-5 h-5 mr-3" />
                    Add New Employee
                  </Button>
                </Link>
                
                <Link href="/reports">
                  <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" data-testid="button-generate-report">
                    <Download className="w-5 h-5 mr-3" />
                    Generate Report
                  </Button>
                </Link>
                
                <Link href="/documents">
                  <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" data-testid="button-upload-documents">
                    <Upload className="w-5 h-5 mr-3" />
                    Upload Documents
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Expirations */}
        {expiringItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Expirations</CardTitle>
              <CardDescription>Licenses and certifications expiring within 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expiringItems.slice(0, 5).map((item: any, index: number) => (
                  <div key={index} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors" data-testid={`expiration-item-${index}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{item.employeeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.itemType} - {item.licenseNumber}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{item.expirationDate}</p>
                        <Badge variant={item.daysRemaining <= 15 ? "destructive" : "secondary"}>
                          {item.daysRemaining} days
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {expiringItems.length > 5 && (
                <div className="mt-4">
                  <Link href="/reports?filter=expiring">
                    <Button variant="outline" size="sm" data-testid="button-view-all-expiring">
                      View All {expiringItems.length} Items
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}