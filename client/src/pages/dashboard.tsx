import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MainLayout } from "@/components/layout/main-layout";
import { Users, UserCheck, AlertTriangle, UserPlus, Download, Upload, TrendingUp } from "lucide-react";
import { Link, useLocation } from "wouter";

/**
 * Statistical data for dashboard overview cards
 */
interface DashboardStats {
  totalEmployees: number;
  activeLicenses: number;
  expiringSoon: number;
  complianceRate: number;
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
  
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats", { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch dashboard stats');
      return res.json();
    }
  });

  const { data: activities = [] } = useQuery<RecentActivity[]>({
    queryKey: ["/api/dashboard/activities"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`${queryKey[0]}?limit=5`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch activities');
      return res.json();
    }
  });

  const { data: expiringItems = [] } = useQuery({
    queryKey: ["/api/dashboard/expirations"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`${queryKey[0]}?days=30`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch expiring items');
      return res.json();
    }
  });

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