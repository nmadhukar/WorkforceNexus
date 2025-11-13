import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchFilters } from "@/components/search-filters";
import { AlertTriangle, FileText, Users, Download, BarChart2, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";

/**
 * Item with upcoming expiration date
 */
interface ExpiringItem {
  employeeId: number;
  employeeName: string;
  itemType: string;
  licenseNumber: string;
  expirationDate: string;
  daysRemaining: number;
}

/**
 * Dashboard statistics for reporting
 */
interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  expiringSoon: number;
  pendingDocs: number;
}

/**
 * Analytics data for dashboard reporting
 */
interface DashboardAnalytics {
  totalEmployees: number;
  activeLicenses: number;
  expiringSoon: number;
  complianceRate: number;
}

/**
 * Reports and analytics page for generating HR management system reports
 * @component
 * @returns {JSX.Element} Reports interface with multiple report types and data visualization
 * @example
 * <Reports />
 * 
 * @description
 * - Provides four main report types: Expiring Items, Compliance, Employee Directory, Analytics
 * - Interactive report cards with export functionality
 * - Detailed expiring items table with filtering and priority badges
 * - CSV export capabilities for all report types
 * - URL parameter support for deep linking to specific reports
 * - Dynamic time range selection for expiring items (30/60/90 days)
 * - Priority-based filtering (high/medium/low) for expiring items
 * - Summary statistics display with visual indicators
 * - Uses data-testid attributes for comprehensive testing
 * - Real-time data updates and responsive design
 */
export default function Reports() {
  const [location, setLocation] = useLocation();
  const [selectedReport, setSelectedReport] = useState("expiring");
  const [selectedDays, setSelectedDays] = useState("30");
  const [complianceDays, setComplianceDays] = useState("30");
  const [filters, setFilters] = useState({
    search: "",
    type: "",
    priority: ""
  });
  const [complianceFilters, setComplianceFilters] = useState({
    search: "",
    type: "",
    action: ""
  });

  // Parse URL parameters for initial filter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get('filter');
    if (filterParam === 'expiring') {
      setSelectedReport('expiring');
    } else if (filterParam === 'compliance') {
      setSelectedReport('compliance');
    }
  }, []);

  const { data: expiringItems = [], isLoading: loadingExpiring, refetch: refetchExpiring } = useQuery<ExpiringItem[]>({
    queryKey: ["/api/reports/expiring", selectedDays],
    queryFn: async ({ queryKey }) => {
      const [url, days] = queryKey;
      const res = await fetch(`${url}?days=${days}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch expiring items');
      return res.json();
    }
  });

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/reports/stats"]
  });

  const { data: dashboardStats } = useQuery<DashboardAnalytics>({
    queryKey: ["/api/dashboard/stats"]
  });

  // Fetch compliance expiring licenses
  const { data: complianceExpiringData, isLoading: loadingCompliance } = useQuery<{ licenses: any[]; count: number; withinDays: number }>({
    queryKey: ["/api/clinic-licenses/expiring", complianceDays],
    queryFn: async ({ queryKey }) => {
      const [, days] = queryKey;
      const res = await fetch(`/api/clinic-licenses/expiring?days=${days}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch compliance expiring licenses');
      return res.json();
    },
    enabled: selectedReport === 'compliance'
  });
  
  const complianceExpiringLicenses = complianceExpiringData?.licenses || [];

  /**
   * Updates filter state for report data
   * @param {string} key - Filter property to update
   * @param {string} value - New filter value
   */
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  /**
   * Handles report card selection and data fetching
   * @param {string} reportType - Type of report to display
   */
  const handleReportClick = (reportType: string) => {
    setSelectedReport(reportType);
    if (reportType === 'expiring') {
      refetchExpiring();
    }
  };

  /**
   * Updates compliance filter state
   * @param {string} key - Filter property to update
   * @param {string} value - New filter value
   */
  const handleComplianceFilterChange = (key: string, value: string) => {
    setComplianceFilters(prev => ({ ...prev, [key]: value }));
  };

  /**
   * Exports report data as CSV file
   * @param {string} reportType - Type of report to export
   * @description Downloads CSV file with timestamped filename
   */
  const handleExportCSV = async (reportType: string) => {
    try {
      let query = '';
      let url = '';
      
      if (reportType === 'expiring-items') {
        query = `?days=${selectedDays}`;
        url = `/api/export/${reportType}${query}`;
      } else if (reportType === 'compliance') {
        query = `?days=${complianceDays}`;
        url = `/api/clinic-licenses/expiring${query}`;
      } else {
        query = '';
        url = `/api/export/${reportType}${query}`;
      }
      
      const response = await fetch(url, {
        credentials: "include",
        headers: {
          Accept: 'text/csv,application/octet-stream'
        }
      });
      if (!response.ok) {
        throw new Error("Failed to export data");
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/csv') && !contentType.includes('octet-stream')) {
        const text = await response.text();
        throw new Error(`Unexpected content-type: ${contentType}. Body preview: ${text.slice(0, 120)}...`);
      }
      const blob = await response.blob();
      const urlObj = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = urlObj;

      const disposition = response.headers.get('content-disposition');
      const fallbackName = `${reportType}-${new Date().toISOString().split('T')[0]}.csv`;
      let filename = fallbackName;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
        if (match) {
          filename = decodeURIComponent(match[1] || match[2]);
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(urlObj);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  /**
   * Returns priority badge based on days remaining until expiration
   * @param {number} daysRemaining - Number of days until expiration
   * @returns {JSX.Element} Styled priority badge component
   */
  const getPriorityBadge = (daysRemaining: number) => {
    if (daysRemaining <= 15) {
      return <Badge className="bg-destructive/10 text-destructive priority-high">High</Badge>;
    } else if (daysRemaining <= 45) {
      return <Badge className="bg-accent/10 text-accent priority-medium">Medium</Badge>;
    } else {
      return <Badge className="bg-secondary/10 text-secondary priority-low">Low</Badge>;
    }
  };

  const filteredItems = expiringItems.filter(item => {
    if (filters.search && !item.employeeName.toLowerCase().includes(filters.search.toLowerCase()) &&
        !item.licenseNumber.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.type && item.itemType !== filters.type) {
      return false;
    }
    if (filters.priority) {
      const priority = item.daysRemaining <= 15 ? 'high' : 
                      item.daysRemaining <= 45 ? 'medium' : 'low';
      if (priority !== filters.priority) {
        return false;
      }
    }
    return true;
  });

  // Filter compliance expiring licenses
  const filteredComplianceLicenses = complianceExpiringLicenses.filter(license => {
    if (complianceFilters.search && 
        !license.licenseNumber?.toLowerCase().includes(complianceFilters.search.toLowerCase()) &&
        !license.licenseType?.toLowerCase().includes(complianceFilters.search.toLowerCase()) &&
        !license.locationName?.toLowerCase().includes(complianceFilters.search.toLowerCase()) &&
        !license.responsiblePerson?.toLowerCase().includes(complianceFilters.search.toLowerCase())) {
      return false;
    }
    if (complianceFilters.type && license.licenseType !== complianceFilters.type) {
      return false;
    }
    if (complianceFilters.action) {
      const priority = license.daysUntilExpiration <= 0 ? 'expired' :
                      license.daysUntilExpiration <= 15 ? 'high' : 
                      license.daysUntilExpiration <= 45 ? 'medium' : 'low';
      if (priority !== complianceFilters.action) {
        return false;
      }
    }
    return true;
  });

  // Get unique license types for compliance filter
  const uniqueComplianceLicenseTypes = Array.from(new Set(complianceExpiringLicenses.map(l => l.licenseType)));

  // Get priority badge for compliance licenses
  const getCompliancePriorityBadge = (daysRemaining: number) => {
    if (daysRemaining <= 0) {
      return <Badge variant="destructive">Expired</Badge>;
    } else if (daysRemaining <= 15) {
      return <Badge className="bg-destructive/10 text-destructive">High</Badge>;
    } else if (daysRemaining <= 45) {
      return <Badge className="bg-accent/10 text-accent">Medium</Badge>;
    } else {
      return <Badge className="bg-secondary/10 text-secondary">Low</Badge>;
    }
  };

  // Calculate missing documents (employees without required licenses)
  const missingDocs = stats ? Math.max(0, stats.totalEmployees - Math.floor(stats.activeEmployees * 0.8)) : 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-reports-title">Reports</h1>
          <p className="text-muted-foreground">Generate and view comprehensive HR reports</p>
        </div>

        {/* Report Types */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6">
          <Card 
            className={`hover:shadow-md transition-shadow cursor-pointer ${selectedReport === 'expiring' ? 'ring-2 ring-primary' : ''}`}
            data-testid="card-expiring-report"
            onClick={() => handleReportClick('expiring')}
          >
            <CardContent className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Employees Expiring Report</h3>
                  <p className="text-sm text-muted-foreground">{expiringItems.length} items</p>
                </div>
              </div>
              <Button 
                className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExportCSV('expiring-items');
                }}
                data-testid="button-generate-expiring-report"
              >
                Export Report
              </Button>
            </CardContent>
          </Card>

          <Card 
            className={`hover:shadow-md transition-shadow cursor-pointer ${selectedReport === 'compliance' ? 'ring-2 ring-primary' : ''}`}
            data-testid="card-compliance-report"
            onClick={() => handleReportClick('compliance')}
          >
            <CardContent className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Locations Expiring Report</h3>
                  <p className="text-sm text-muted-foreground">{filteredComplianceLicenses?.length} items</p>
                </div>
              </div>
              <Button 
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExportCSV('compliance');
                }}
                data-testid="button-generate-compliance-report"
              >
                Export Report
              </Button>
            </CardContent>
          </Card>

          <Card 
            className={`hover:shadow-md transition-shadow cursor-pointer ${selectedReport === 'directory' ? 'ring-2 ring-primary' : ''}`}
            data-testid="card-directory-report"
            onClick={() => handleReportClick('directory')}
          >
            <CardContent className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Employee Directory</h3>
                  <p className="text-sm text-muted-foreground">{stats?.totalEmployees || 0} employees</p>
                </div>
              </div>
              <Button 
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExportCSV('employees');
                }}
                data-testid="button-generate-directory-report"
              >
                Export Report
              </Button>
            </CardContent>
          </Card>

          {/* <Card 
            className={`hover:shadow-md transition-shadow cursor-pointer ${selectedReport === 'analytics' ? 'ring-2 ring-primary' : ''}`}
            data-testid="card-analytics-report"
            onClick={() => handleReportClick('analytics')}
          >
            <CardContent className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Analytics</h3>
                  <p className="text-sm text-muted-foreground">
                    {dashboardStats?.complianceRate || 0}% compliance
                  </p>
                </div>
              </div>
              <Button 
                className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExportCSV('analytics');
                }}
                data-testid="button-generate-analytics-report"
              >
                Export Report
              </Button>
            </CardContent>
          </Card> */}
        </div>

        {/* Report Display based on selected report */}
        {selectedReport === 'expiring' && (
          <Card>
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <BarChart2 className="w-5 h-5 mr-2" />
                  Employees Expiring Report
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Select value={selectedDays} onValueChange={setSelectedDays}>
                    <SelectTrigger className="w-40" data-testid="select-expiring-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">Next 30 days</SelectItem>
                      <SelectItem value="60">Next 60 days</SelectItem>
                      <SelectItem value="90">Next 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline"
                    onClick={() => handleExportCSV('expiring-items')}
                    data-testid="button-export-csv"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {/* Filters */}
              <SearchFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                filterOptions={{
                  types: [
                    { value: "", label: "All Types" },
                    { value: "State License", label: "State License" },
                    { value: "DEA License", label: "DEA License" },
                    { value: "Board Certification", label: "Board Certification" }
                  ]
                }}
                data-testid="expiring-filters"
              />

              {/* Report Table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-4 font-medium text-foreground">Employee</th>
                      <th className="text-left p-4 font-medium text-foreground">Item Type</th>
                      <th className="text-left p-4 font-medium text-foreground">License/Cert Number</th>
                      <th className="text-left p-4 font-medium text-foreground">Expiration Date</th>
                      <th className="text-left p-4 font-medium text-foreground">Days Remaining</th>
                      <th className="text-left p-4 font-medium text-foreground">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingExpiring ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          Loading expiring items...
                        </td>
                      </tr>
                    ) : filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No expiring items found
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item, index) => (
                        <tr 
                          key={`${item.employeeId}-${item.itemType}-${index}`} 
                          className="border-t border-border hover:bg-muted/50 table-row"
                          data-testid={`expiring-item-${index}`}
                        >
                          <td className="p-4 text-foreground">{item.employeeName}</td>
                          <td className="p-4 text-foreground">{item.itemType}</td>
                          <td className="p-4 text-foreground">{item.licenseNumber}</td>
                          <td className="p-4 text-foreground">
                            {format(new Date(item.expirationDate), 'MMM dd, yyyy')}
                          </td>
                          <td className="p-4 text-foreground">{item.daysRemaining}</td>
                          <td className="p-4">{getPriorityBadge(item.daysRemaining)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedReport === 'compliance' && (
          <Card>
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <BarChart2 className="w-5 h-5 mr-2" />
                  Locations Expiring Report
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Select value={complianceDays} onValueChange={setComplianceDays}>
                    <SelectTrigger className="w-40" data-testid="select-compliance-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">Next 30 days</SelectItem>
                      <SelectItem value="60">Next 60 days</SelectItem>
                      <SelectItem value="90">Next 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline"
                    onClick={() => handleExportCSV('compliance')}
                    data-testid="button-export-compliance-csv"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {/* Filters */}
              <SearchFilters
                filters={complianceFilters}
                onFilterChange={handleComplianceFilterChange}
                filterOptions={{
                  types: [
                    { value: "", label: "All Types" },
                    ...uniqueComplianceLicenseTypes.map(type => ({ value: type, label: type }))
                  ],
                  actions: [
                    { value: "", label: "All Priorities" },
                    { value: "high", label: "High (≤15 days)" },
                    { value: "medium", label: "Medium (16-45 days)" },
                    { value: "low", label: "Low (>45 days)" },
                    { value: "expired", label: "Expired" }
                  ]
                }}
                data-testid="compliance-filters"
              />

              {/* Report Table */}
              <div className="mt-4 overflow-x-auto">
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-4 font-medium text-foreground">License Number</th>
                        <th className="text-left p-4 font-medium text-foreground">Type</th>
                        <th className="text-left p-4 font-medium text-foreground">Location</th>
                        <th className="text-left p-4 font-medium text-foreground">Responsible Person</th>
                        <th className="text-left p-4 font-medium text-foreground">Expiration Date</th>
                        <th className="text-left p-4 font-medium text-foreground">Days Remaining</th>
                        <th className="text-left p-4 font-medium text-foreground">Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingCompliance ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            Loading compliance licenses...
                          </td>
                        </tr>
                      ) : filteredComplianceLicenses.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            {complianceExpiringLicenses.length === 0 
                              ? `No compliance licenses expiring in the next ${complianceDays} days`
                              : "No licenses match the current filters"}
                          </td>
                        </tr>
                      ) : (
                        filteredComplianceLicenses?.map((license, index) => (
                          <tr 
                            key={license.id} 
                            className="border-t border-border hover:bg-muted/50"
                            data-testid={`compliance-license-${index}`}
                          >
                            <td className="p-4 text-foreground font-medium">{license.licenseNumber || '-'}</td>
                            <td className="p-4 text-foreground">{license.licenseType || '-'}</td>
                            <td className="p-4 text-foreground">{license.locationName || '-'}</td>
                            <td className="p-4 text-foreground">{license.responsiblePerson === 'N/A' ? '-' : license.responsiblePerson}</td>
                            <td className="p-4 text-foreground">
                              {license.expirationDate 
                                ? format(new Date(license.expirationDate), 'MMM dd, yyyy')
                                : '-'}
                            </td>
                            <td className="p-4 text-foreground">
                              {license.daysUntilExpiration <= 0 
                                ? <span className="text-destructive font-semibold">Expired</span>
                                : `${license.daysUntilExpiration} days`}
                            </td>
                            <td className="p-4">{getCompliancePriorityBadge(license.daysUntilExpiration || 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {filteredComplianceLicenses.length > 0 && filteredComplianceLicenses.length < complianceExpiringLicenses.length && (
                <div className="mt-4 text-sm text-muted-foreground text-center">
                  Showing {filteredComplianceLicenses.length} of {complianceExpiringLicenses.length} expiring licenses
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {selectedReport === 'directory' && (
          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle>Employee Directory Report</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center py-8 border rounded-lg bg-muted/30">
                <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-lg font-medium">
                  {stats?.totalEmployees || 0} total employees
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {stats?.activeEmployees || 0} active • {Math.max(0, (stats?.totalEmployees || 0) - (stats?.activeEmployees || 0))} inactive
                </p>
                <Button 
                  className="mt-4"
                  onClick={() => setLocation('/employees')}
                  data-testid="button-view-directory"
                >
                  View Employee List
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedReport === 'analytics' && (
          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle>Analytics Report</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-foreground">
                    {dashboardStats?.complianceRate || 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">Compliance Rate</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-primary">
                    {dashboardStats?.activeLicenses || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Active Licenses</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-destructive">
                    {dashboardStats?.expiringSoon || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Expiring Soon</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-accent">
                    {stats?.pendingDocs || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Pending Docs</p>
                </div>
              </div>
              <div className="text-center py-4 border rounded-lg bg-muted/30">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click Export Report to download detailed analytics
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        {/* {stats && (
          <Card>
            <CardHeader>
              <CardTitle>Summary Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground" data-testid="stat-total-employees">
                    {stats.totalEmployees}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Employees</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-secondary" data-testid="stat-active-employees">
                    {stats.activeEmployees}
                  </p>
                  <p className="text-sm text-muted-foreground">Active Employees</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-destructive" data-testid="stat-expiring-soon">
                    {stats.expiringSoon}
                  </p>
                  <p className="text-sm text-muted-foreground">Items Expiring Soon</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-accent" data-testid="stat-pending-docs">
                    {stats.pendingDocs}
                  </p>
                  <p className="text-sm text-muted-foreground">Pending Documents</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )} */}
      </div>
    </MainLayout>
  );
}