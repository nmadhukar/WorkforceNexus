import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchFilters } from "@/components/search-filters";
import { AlertTriangle, FileText, Users, Download, BarChart2 } from "lucide-react";

interface ExpiringItem {
  employeeId: number;
  employeeName: string;
  itemType: string;
  licenseNumber: string;
  expirationDate: string;
  daysRemaining: number;
}

interface ExpiringItemsResponse {
  items: ExpiringItem[];
  total: number;
}

export default function Reports() {
  const [selectedDays, setSelectedDays] = useState("30");
  const [filters, setFilters] = useState({
    search: "",
    itemType: "",
    priority: ""
  });

  const { data: expiringItems = [], isLoading: loadingExpiring } = useQuery<ExpiringItem[]>({
    queryKey: ["/api/reports/expiring"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`${queryKey[0]}?days=${selectedDays}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch expiring items');
      return res.json();
    }
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/reports/stats"]
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleExportCSV = async (reportType: string) => {
    try {
      const response = await fetch(`/api/export/${reportType}`, {
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error("Failed to export data");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${reportType}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

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
    if (filters.itemType && item.itemType !== filters.itemType) {
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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-reports-title">Reports</h1>
          <p className="text-muted-foreground">Generate and view comprehensive HR reports</p>
        </div>

        {/* Report Types */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid="card-expiring-report">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Expiring Items</h3>
                  <p className="text-sm text-muted-foreground">Licenses & Certifications</p>
                </div>
              </div>
              <Button 
                className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => handleExportCSV('expiring-items')}
                data-testid="button-generate-expiring-report"
              >
                Generate Report
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid="card-compliance-report">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Compliance</h3>
                  <p className="text-sm text-muted-foreground">Missing Documents</p>
                </div>
              </div>
              <Button 
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => handleExportCSV('compliance')}
                data-testid="button-generate-compliance-report"
              >
                Generate Report
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid="card-directory-report">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Employee Directory</h3>
                  <p className="text-sm text-muted-foreground">Complete Staff List</p>
                </div>
              </div>
              <Button 
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => handleExportCSV('employees')}
                data-testid="button-generate-directory-report"
              >
                Generate Report
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sample Report Display */}
        <Card>
          <CardHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <BarChart2 className="w-5 h-5 mr-2" />
                Expiring Items Report
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
                          {new Date(item.expirationDate).toLocaleDateString()}
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

        {/* Summary Stats */}
        {stats && (
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
        )}
      </div>
    </MainLayout>
  );
}
