import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
}

interface SearchFiltersProps {
  filters: {
    search: string;
    department?: string;
    status?: string;
    location?: string;
    type?: string;
    action?: string;
    tableName?: string;
  };
  onFilterChange: (key: string, value: string) => void;
  filterOptions?: {
    departments?: FilterOption[];
    statuses?: FilterOption[];
    locations?: FilterOption[];
    types?: FilterOption[];
    actions?: FilterOption[];
    tableNames?: FilterOption[];
  };
}

export function SearchFilters({ filters, onFilterChange, filterOptions = {} }: SearchFiltersProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => onFilterChange("search", e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          
          {filterOptions.departments && (
            <Select 
              value={filters.department || ""} 
              onValueChange={(value) => onFilterChange("department", value)}
            >
              <SelectTrigger data-testid="select-department">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.departments.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {filterOptions.statuses && (
            <Select 
              value={filters.status || ""} 
              onValueChange={(value) => onFilterChange("status", value)}
            >
              <SelectTrigger data-testid="select-status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.statuses.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {filterOptions.locations && (
            <Select 
              value={filters.location || ""} 
              onValueChange={(value) => onFilterChange("location", value)}
            >
              <SelectTrigger data-testid="select-location">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.locations.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {filterOptions.types && (
            <Select 
              value={filters.type || ""} 
              onValueChange={(value) => onFilterChange("type", value)}
            >
              <SelectTrigger data-testid="select-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.types.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {filterOptions.actions && (
            <Select 
              value={filters.action || ""} 
              onValueChange={(value) => onFilterChange("action", value)}
            >
              <SelectTrigger data-testid="select-action">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.actions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {filterOptions.tableNames && (
            <Select 
              value={filters.tableName || ""} 
              onValueChange={(value) => onFilterChange("tableName", value)}
            >
              <SelectTrigger data-testid="select-table-name">
                <SelectValue placeholder="All Tables" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.tableNames.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
