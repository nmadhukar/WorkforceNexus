import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MainLayout } from "@/components/layout/main-layout";
import { Users, UserCheck, AlertTriangle, FileText, UserPlus, Download, Upload } from "lucide-react";
import { Link } from "wouter";

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  expiringSoon: number;
  pendingDocs: number;
}

interface RecentActivity {
  id: number;
  type: string;
  description: string;
  timestamp: string;
}

export default function Dashboard() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/reports/stats"]
  });

  const { data: expiringItems = [] } = useQuery({
    queryKey: ["/api/reports/expiring"],
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
          <Card data-testid="card-total-employees">
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

          <Card data-testid="card-active-employees">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Employees</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-active-employees">
                    {stats?.activeEmployees || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-expiring-soon">
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

          <Card data-testid="card-pending-docs">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Documents</p>
                  <p className="text-2xl font-bold text-accent" data-testid="text-pending-docs">
                    {stats?.pendingDocs || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-accent" />
                </div>
              </div>
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
                {expiringItems.slice(0, 3).map((item: any, index: number) => (
                  <div key={index} className="flex items-center space-x-3" data-testid={`activity-item-${index}`}>
                    <div className="w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground">
                        {item.employeeName}: {item.itemType} expires soon
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.daysRemaining} days remaining
                      </p>
                    </div>
                  </div>
                ))}
                
                {expiringItems.length === 0 && (
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

        {/* Expiring Items Alert */}
        {expiringItems.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Items Expiring Soon
              </CardTitle>
              <CardDescription>
                {expiringItems.length} items are expiring within the next 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expiringItems.slice(0, 5).map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-card rounded-lg" data-testid={`expiring-item-${index}`}>
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
                ))}
              </div>
              {expiringItems.length > 5 && (
                <div className="mt-4">
                  <Link href="/reports">
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
