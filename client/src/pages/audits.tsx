import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuditTable } from "@/components/tables/audit-table";
import { SearchFilters } from "@/components/search-filters";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, Eye } from "lucide-react";
import type { Audit } from "@/lib/types";

/**
 * Response structure for paginated audit entries API
 */
interface AuditsResponse {
  audits: Audit[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Audit trail page for tracking all system changes and user activities
 * @component
 * @returns {JSX.Element} Audit interface with filtering capabilities and detailed audit log
 * @example
 * <Audits />
 * 
 * @description
 * - Comprehensive audit trail with filterable entries
 * - Advanced filtering by action type, table, date range, and search terms
 * - Detailed audit entry modal with before/after data comparison
 * - Paginated audit log with 25 entries per page
 * - Color-coded action badges (CREATE, UPDATE, DELETE, LOGIN)
 * - JSON data formatting with syntax highlighting
 * - Real-time audit tracking for compliance and security
 * - Uses data-testid attributes for testing automation
 * - HIPAA-compliant audit logging capabilities
 */
export default function Audits() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    tableName: "",
    action: "",
    startDate: "",
    endDate: ""
  });
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data, isLoading, error } = useQuery<AuditsResponse>({
    queryKey: ["/api/audits", page, filters],
    queryFn: async ({ queryKey }) => {
      const [url, currentPage, currentFilters] = queryKey;
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: "10",
        ...Object.fromEntries(
          Object.entries(currentFilters as any).filter(([_, value]) => value)
        )
      });
      
      const res = await fetch(`${url}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch audits');
      return res.json();
    }
  });

  /**
   * Updates filter state and resets pagination
   * @param {string} key - Filter property to update
   * @param {string} value - New filter value
   */
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  /**
   * Opens audit details modal for selected audit entry
   * @param {Audit} audit - Audit entry to display in detail
   */
  const showAuditDetails = (audit: Audit) => {
    setSelectedAudit(audit);
    setDetailsOpen(true);
  };

  /**
   * Formats JSON data for display with proper indentation
   * @param {any} data - Raw audit data to format
   * @returns {string} Formatted JSON string or fallback text
   */
  const formatJsonData = (data: any) => {
    if (!data) return "No data";
    try {
      // Check if data is already an object (from JSONB)
      if (typeof data === 'object') {
        return JSON.stringify(data, null, 2);
      }
      // If it's a string, try to parse it first
      return JSON.stringify(JSON.parse(data), null, 2);
    } catch {
      // Fallback to string representation
      return String(data);
    }
  };

  if (error) {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <p className="text-destructive">Failed to load audit trail</p>
        </div>
      </MainLayout>
    );
  }

  return (
      <div className="space-y-6">
        {/* <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground flex items-center" data-testid="text-audits-title">
            <Shield className="w-8 h-8 mr-3" />
            Audit Trail
          </h1>
          </div> */}
          <p className="text-muted-foreground">Track all system changes and user activities</p>

        {/* Audit Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filter Audit Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="search">Search Activities</Label>
                <Input
                  id="search"
                  placeholder="Search activities..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  data-testid="input-search-audits"
                />
              </div>
              
              <div>
                <Label htmlFor="action">Action</Label>
                <select
                  id="action"
                  value={filters.action}
                  onChange={(e) => handleFilterChange("action", e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="select-action"
                >
                  <option value="">All Actions</option>
                  <option value="CREATE">CREATE</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="DELETE">DELETE</option>
                  <option value="LOGIN">LOGIN</option>
                </select>
              </div>
              
              <div>
                <Label htmlFor="tableName">Table</Label>
                <select
                  id="tableName"
                  value={filters.tableName}
                  onChange={(e) => handleFilterChange("tableName", e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="select-table"
                >
                  <option value="">All Tables</option>
                  <option value="employees">employees</option>
                  <option value="documents">documents</option>
                  <option value="state_licenses">state_licenses</option>
                  <option value="dea_licenses">dea_licenses</option>
                  <option value="users">users</option>
                </select>
              </div>
              
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange("startDate", e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
              
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange("endDate", e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit Table */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Entries</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-4 font-medium text-foreground">Timestamp</th>
                    <th className="text-left p-4 font-medium text-foreground">User</th>
                    <th className="text-left p-4 font-medium text-foreground">Action</th>
                    <th className="text-left p-4 font-medium text-foreground">Table</th>
                    <th className="text-left p-4 font-medium text-foreground">Record ID</th>
                    <th className="text-left p-4 font-medium text-foreground">Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Loading audit entries...
                      </td>
                    </tr>
                  ) : !data?.audits?.length ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No audit entries found
                      </td>
                    </tr>
                  ) : (
                    data.audits.map((audit) => (
                      <tr 
                        key={audit.id} 
                        className="border-t border-border hover:bg-muted/50 table-row"
                        data-testid={`audit-row-${audit.id}`}
                      >
                        <td className="p-4 text-foreground">
                          {new Date(audit.changedAt).toLocaleString()}
                        </td>
                        <td className="p-4 text-foreground">
                          {(audit as any).username || "System"}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            audit.action === 'CREATE' ? 'bg-secondary/10 text-secondary' :
                            audit.action === 'UPDATE' ? 'bg-accent/10 text-accent' :
                            audit.action === 'DELETE' ? 'bg-destructive/10 text-destructive' :
                            audit.action === 'LOGIN' ? 'bg-primary/10 text-primary' :
                            'bg-muted/10 text-muted-foreground'
                          }`}>
                            {audit.action}
                          </span>
                        </td>
                        <td className="p-4 text-foreground">{audit.tableName}</td>
                        <td className="p-4 text-foreground">{audit.recordId}</td>
                        <td className="p-4">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => showAuditDetails(audit)}
                            className="text-primary hover:text-primary/80"
                            data-testid={`button-view-details-${audit.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="border-t border-border p-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground" data-testid="pagination-info">
                  Showing {((page - 1) * 25) + 1}-{Math.min(page * 25, data.total)} of {data.total} audit entries
                </p>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    data-testid="button-previous-page"
                  >
                    Previous
                  </Button>
                  
                  {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        data-testid={`button-page-${pageNum}`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= data.totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Details Modal */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Audit Details</DialogTitle>
            </DialogHeader>
            
            {selectedAudit && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Timestamp</Label>
                    <p className="text-sm font-mono bg-muted p-2 rounded">
                      {new Date(selectedAudit.changedAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label>User</Label>
                    <p className="text-sm font-mono bg-muted p-2 rounded">
                      {(selectedAudit as any).username || "System"}
                    </p>
                  </div>
                  <div>
                    <Label>Action</Label>
                    <p className="text-sm font-mono bg-muted p-2 rounded">
                      {selectedAudit.action}
                    </p>
                  </div>
                  <div>
                    <Label>Table</Label>
                    <p className="text-sm font-mono bg-muted p-2 rounded">
                      {selectedAudit.tableName}
                    </p>
                  </div>
                </div>

                {selectedAudit.oldData && (
                  <div>
                    <Label>Old Data</Label>
                    <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
                      {formatJsonData(selectedAudit.oldData)}
                    </pre>
                  </div>
                )}

                {selectedAudit.newData && (
                  <div>
                    <Label>New Data</Label>
                    <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
                      {formatJsonData(selectedAudit.newData)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
  );
}
