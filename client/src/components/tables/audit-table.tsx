import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Audit } from "@/lib/types";

interface AuditTableProps {
  audits: Audit[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}

export function AuditTable({
  audits,
  total,
  page,
  totalPages,
  onPageChange,
  isLoading
}: AuditTableProps) {
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <Badge className="bg-secondary/10 text-secondary">CREATE</Badge>;
      case 'UPDATE':
        return <Badge className="bg-accent/10 text-accent">UPDATE</Badge>;
      case 'DELETE':
        return <Badge className="bg-destructive/10 text-destructive">DELETE</Badge>;
      case 'LOGIN':
        return <Badge className="bg-primary/10 text-primary">LOGIN</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading audit entries...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
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
              {audits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No audit entries found
                  </td>
                </tr>
              ) : (
                audits.map((audit) => (
                  <tr 
                    key={audit.id} 
                    className="border-t border-border hover:bg-muted/50 table-row"
                    data-testid={`audit-row-${audit.id}`}
                  >
                    <td className="p-4 text-foreground">
                      {formatTimestamp(audit.changedAt)}
                    </td>
                    <td className="p-4 text-foreground">
                      {(audit as any).username || "System"}
                    </td>
                    <td className="p-4">{getActionBadge(audit.action)}</td>
                    <td className="p-4 text-foreground">{audit.tableName}</td>
                    <td className="p-4 text-foreground">{audit.recordId}</td>
                    <td className="p-4">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-primary hover:text-primary/80"
                        data-testid={`button-view-changes-${audit.id}`}
                      >
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
        {totalPages > 1 && (
          <div className="border-t border-border p-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground" data-testid="pagination-info">
              Showing {((page - 1) * 25) + 1}-{Math.min(page * 25, total)} of {total} audit entries
            </p>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                data-testid="button-previous-page"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => onPageChange(pageNum)}
                    data-testid={`button-page-${pageNum}`}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                data-testid="button-next-page"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
