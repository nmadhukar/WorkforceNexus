import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MainLayout } from "@/components/layout/main-layout";
import { 
  Building2, 
  Award, 
  FileCheck, 
  AlertTriangle, 
  Clock, 
  Users, 
  FileText, 
  Download, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Eye,
  FileDown
} from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { format } from "date-fns";
// Charts removed - keeping only data statistics
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ComplianceDashboardData {
  totalLocations: number;
  activeLocations: number;
  totalLicenses: number;
  activeLicenses: number;
  expiringIn30Days: number;
  expiringIn60Days: number;
  expiringIn90Days: number;
  expiredLicenses: number;
  documentsCount: number;
  nonCompliantCount: number;
}

interface ComplianceAlert {
  id: number;
  type: string;
  severity: string;
  message: string;
  entityId: number;
  entityType: string;
  createdAt: string;
}

interface LocationSummary {
  locationId: number;
  locationName: string;
  totalLicenses: number;
  activeLicenses: number;
  expiringLicenses: number;
  expiredLicenses: number;
  complianceStatus: string;
}

interface ExpiringLicense {
  id: number;
  licenseNumber: string;
  licenseType: string;
  locationName: string;
  responsiblePerson: string;
  expirationDate: string;
  daysUntilExpiration: number;
}

export default function ComplianceDashboard() {
  const { toast } = useToast();
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [dateRange, setDateRange] = useState('30');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [selectedLocation, setSelectedLocation] = useState<string>('all');

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery<ComplianceDashboardData>({
    queryKey: ["/api/compliance/dashboard"],
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  });

  // Fetch compliance alerts
  const { data: alerts = [], refetch: refetchAlerts } = useQuery<ComplianceAlert[]>({
    queryKey: ["/api/compliance/alerts"],
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch location summaries
  const { data: locationSummaries = [], refetch: refetchSummaries } = useQuery<LocationSummary[]>({
    queryKey: ["/api/compliance/summary"],
  });

  // Fetch expiring licenses
  const { data: expiringLicenses = [] } = useQuery<ExpiringLicense[]>({
    queryKey: ["/api/clinic-licenses/expiring", { days: dateRange }],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`/api/clinic-licenses/expiring?days=${dateRange}`, { 
        credentials: "include" 
      });
      if (!res.ok) throw new Error('Failed to fetch expiring licenses');
      return res.json();
    }
  });

  // Fetch all locations for filter
  const { data: locations = [] } = useQuery({
    queryKey: ["/api/locations"],
    queryFn: async () => {
      const res = await fetch("/api/locations", { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch locations');
      const data = await res.json();
      return data.locations || [];
    }
  });

  // Manual refresh function
  const handleManualRefresh = async () => {
    setLastUpdated(new Date());
    await Promise.all([
      refetchDashboard(),
      refetchAlerts(),
      refetchSummaries()
    ]);
    queryClient.invalidateQueries({ queryKey: ["/api/clinic-licenses"] });
    toast({
      title: "Dashboard Refreshed",
      description: "All metrics have been updated.",
    });
  };

  // Export compliance report
  const exportMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({
        format: exportFormat,
        location: selectedLocation !== 'all' ? selectedLocation : '',
        days: dateRange
      });
      const res = await fetch(`/api/compliance/export?${params}`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${format(new Date(), 'yyyy-MM-dd')}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Export Successful",
        description: `Compliance report exported as ${exportFormat.toUpperCase()}.`,
      });
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "Could not export compliance report.",
        variant: "destructive"
      });
    }
  });

  // Calculate compliance score
  const complianceScore = dashboardData 
    ? Math.round((dashboardData.activeLicenses / Math.max(dashboardData.totalLicenses, 1)) * 100)
    : 0;

  // Chart data removed - no longer needed

  // Get alert icon based on severity
  const getAlertIcon = (severity: string) => {
    switch(severity) {
      case 'high': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'medium': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default: return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-compliance-dashboard-title">
              Compliance Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor license compliance and regulatory requirements
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleManualRefresh}
              data-testid="button-refresh-dashboard"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <div className="text-xs text-muted-foreground">
              Last updated: {format(lastUpdated, 'HH:mm:ss')}
            </div>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card data-testid="card-total-locations">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Locations</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-locations">
                    {dashboardData?.totalLocations || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dashboardData?.activeLocations || 0} active
                  </p>
                </div>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-active-licenses">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Active Licenses</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-active-licenses">
                    {dashboardData?.activeLicenses || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    of {dashboardData?.totalLicenses || 0} total
                  </p>
                </div>
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Award className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-expiring-30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Expiring (30d)</p>
                  <p className="text-2xl font-bold text-yellow-600" data-testid="text-expiring-30">
                    {dashboardData?.expiringIn30Days || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Need renewal
                  </p>
                </div>
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-expired">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Expired</p>
                  <p className="text-2xl font-bold text-destructive" data-testid="text-expired">
                    {dashboardData?.expiredLicenses || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Action required
                  </p>
                </div>
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-documents">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Documents</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-documents">
                    {dashboardData?.documentsCount || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Uploaded
                  </p>
                </div>
                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-compliance-score">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Compliance</p>
                  <p className="text-2xl font-bold" data-testid="text-compliance-score">
                    <span className={complianceScore >= 90 ? "text-green-600" : complianceScore >= 70 ? "text-yellow-600" : "text-destructive"}>
                      {complianceScore}%
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Score
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  {complianceScore >= 90 ? (
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts removed - keeping only statistics and data tables */}

        {/* Compliance Alerts & Location Summaries */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Alerts</CardTitle>
              <CardDescription>Recent compliance notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                {alerts.slice(0, 5).map((alert) => (
                  <Alert 
                    key={alert.id} 
                    variant={alert.severity === 'high' ? 'destructive' : 'default'}
                    data-testid={`alert-${alert.id}`}
                  >
                    <div className="flex items-start gap-2">
                      {getAlertIcon(alert.severity)}
                      <div className="flex-1">
                        <AlertTitle className="text-sm font-medium">
                          {alert.type}
                        </AlertTitle>
                        <AlertDescription className="text-xs">
                          {alert.message}
                        </AlertDescription>
                        <p className="text-xs text-muted-foreground mt-1">
                          {alert.createdAt ? format(new Date(alert.createdAt), 'MMM dd, yyyy') : 'Recent'}
                        </p>
                      </div>
                    </div>
                  </Alert>
                ))}
                
                {alerts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No active alerts
                  </p>
                )}
                
                {alerts.length > 5 && (
                  <Link href="/compliance/alerts">
                    <Button variant="outline" size="sm" className="w-full">
                      View All {alerts.length} Alerts
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Location Summaries Table */}
          <Card>
            <CardHeader>
              <CardTitle>Location Compliance Summary</CardTitle>
              <CardDescription>License status by location</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-[250px] overflow-y-auto">
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="text-left p-2 text-xs font-medium">Location</th>
                      <th className="text-right p-2 text-xs font-medium">Active</th>
                      <th className="text-right p-2 text-xs font-medium">Expiring</th>
                      <th className="text-right p-2 text-xs font-medium">Expired</th>
                      <th className="text-left p-2 text-xs font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locationSummaries.map((location, index) => (
                      <tr key={location.locationId} className="border-b" data-testid={`location-summary-${index}`}>
                        <td className="p-2 text-xs font-medium">{location.locationName}</td>
                        <td className="p-2 text-xs text-right">
                          <span className="text-green-600 font-semibold">{location.activeLicenses}</span>
                        </td>
                        <td className="p-2 text-xs text-right">
                          <span className="text-yellow-600 font-semibold">{location.expiringLicenses}</span>
                        </td>
                        <td className="p-2 text-xs text-right">
                          <span className="text-destructive font-semibold">{location.expiredLicenses}</span>
                        </td>
                        <td className="p-2">
                          <Badge 
                            variant={
                              location.complianceStatus === 'compliant' ? 'default' :
                              location.complianceStatus === 'warning' ? 'secondary' :
                              'destructive'
                            }
                            className="text-xs"
                          >
                            {location.complianceStatus === 'non_compliant' ? 'Non-Compliant' :
                             location.complianceStatus === 'warning' ? 'Warning' :
                             'Compliant'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {locationSummaries.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-xs text-muted-foreground">
                          No location data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expiring Licenses Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Expiring Licenses</CardTitle>
                <CardDescription>Licenses requiring renewal attention</CardDescription>
              </div>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-32" data-testid="select-date-range">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 Days</SelectItem>
                  <SelectItem value="60">60 Days</SelectItem>
                  <SelectItem value="90">90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 text-sm font-medium">License</th>
                    <th className="text-left p-2 text-sm font-medium">Type</th>
                    <th className="text-left p-2 text-sm font-medium">Location</th>
                    <th className="text-left p-2 text-sm font-medium">Responsible</th>
                    <th className="text-left p-2 text-sm font-medium">Expires</th>
                    <th className="text-left p-2 text-sm font-medium">Status</th>
                    <th className="text-left p-2 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringLicenses.slice(0, 10).map((license, index) => (
                    <tr key={license.id} className="border-b" data-testid={`expiring-license-${index}`}>
                      <td className="p-2 text-sm">{license.licenseNumber}</td>
                      <td className="p-2 text-sm">{license.licenseType}</td>
                      <td className="p-2 text-sm">{license.locationName}</td>
                      <td className="p-2 text-sm">{license.responsiblePerson}</td>
                      <td className="p-2 text-sm">
                        {format(new Date(license.expirationDate), 'MMM dd, yyyy')}
                      </td>
                      <td className="p-2">
                        <Badge 
                          variant={
                            license.daysUntilExpiration <= 0 ? "destructive" :
                            license.daysUntilExpiration <= 30 ? "secondary" :
                            "default"
                          }
                        >
                          {license.daysUntilExpiration <= 0 ? 'Expired' :
                           `${license.daysUntilExpiration} days`}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            data-testid={`button-renew-${index}`}
                          >
                            Renew
                          </Button>
                          <Link href={`/licenses/${license.id}`}>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              data-testid={`button-view-${index}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {expiringLicenses.length > 10 && (
              <div className="mt-4">
                <Link href="/licenses?filter=expiring">
                  <Button variant="outline" size="sm" data-testid="button-view-all-expiring">
                    View All {expiringLicenses.length} Expiring Licenses
                  </Button>
                </Link>
              </div>
            )}
            
            {expiringLicenses.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No licenses expiring in the next {dateRange} days
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions and Export */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common compliance tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link href="/licenses/new">
                  <Button className="w-full" variant="default" data-testid="button-add-license">
                    <Plus className="w-4 h-4 mr-2" />
                    Add License
                  </Button>
                </Link>
                
                <Link href="/licenses?filter=expiring">
                  <Button className="w-full" variant="outline" data-testid="button-view-expiring">
                    <Eye className="w-4 h-4 mr-2" />
                    View Expiring
                  </Button>
                </Link>
                
                <Link href="/compliance-documents/upload">
                  <Button className="w-full" variant="outline" data-testid="button-upload-document">
                    <FileText className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                </Link>
                
                <Link href="/responsible-persons">
                  <Button className="w-full" variant="outline" data-testid="button-manage-persons">
                    <Users className="w-4 h-4 mr-2" />
                    Manage Persons
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Export Report */}
          <Card>
            <CardHeader>
              <CardTitle>Export Compliance Report</CardTitle>
              <CardDescription>Generate comprehensive compliance data export</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Format</label>
                    <Select value={exportFormat} onValueChange={(value: 'csv' | 'json') => setExportFormat(value)}>
                      <SelectTrigger data-testid="select-export-format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Location</label>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                      <SelectTrigger data-testid="select-location-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
                        {locations.map((loc: any) => (
                          <SelectItem key={loc.id} value={loc.id.toString()}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button 
                  className="w-full" 
                  onClick={() => exportMutation.mutate()}
                  disabled={exportMutation.isPending}
                  data-testid="button-export-report"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  {exportMutation.isPending ? 'Exporting...' : 'Export Report'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}