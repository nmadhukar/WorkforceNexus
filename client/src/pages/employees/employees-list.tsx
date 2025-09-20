import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmployeesTable } from "@/components/tables/employees-table";
import { SearchFilters } from "@/components/search-filters";
import { Plus, Search } from "lucide-react";

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  workEmail: string;
  status: string;
  npiNumber?: string;
}

interface EmployeesResponse {
  employees: Employee[];
  total: number;
  page: number;
  totalPages: number;
}

export default function EmployeesList() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    department: "",
    status: "",
    location: ""
  });

  const { data, isLoading, error } = useQuery<EmployeesResponse>({
    queryKey: ["/api/employees", page, filters],
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
      if (!res.ok) throw new Error('Failed to fetch employees');
      return res.json();
    }
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filtering
  };

  if (error) {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <p className="text-destructive">Failed to load employees</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-employees-title">Employees</h1>
            <p className="text-muted-foreground">Manage medical staff employee records</p>
          </div>
          <Link href="/employees/new">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-add-employee">
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </Link>
        </div>

        {/* Search and Filters */}
        <SearchFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          filterOptions={{
            departments: [
              { value: "", label: "All Departments" },
              { value: "Emergency Medicine", label: "Emergency Medicine" },
              { value: "Internal Medicine", label: "Internal Medicine" },
              { value: "Pediatrics", label: "Pediatrics" },
              { value: "Surgery", label: "Surgery" }
            ],
            statuses: [
              { value: "", label: "All Statuses" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "on_leave", label: "On Leave" }
            ],
            locations: [
              { value: "", label: "All Locations" },
              { value: "Main Hospital", label: "Main Hospital" },
              { value: "North Clinic", label: "North Clinic" },
              { value: "South Clinic", label: "South Clinic" }
            ]
          }}
          data-testid="search-filters"
        />

        {/* Employees Table */}
        <EmployeesTable
          employees={data?.employees || []}
          total={data?.total || 0}
          page={page}
          totalPages={data?.totalPages || 0}
          onPageChange={setPage}
          isLoading={isLoading}
          data-testid="employees-table"
        />
      </div>
    </MainLayout>
  );
}
