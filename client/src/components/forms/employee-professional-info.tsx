import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EmployeeProfessionalInfoProps {
  data: any;
  onChange: (data: any) => void;
}

export function EmployeeProfessionalInfo({ data, onChange }: EmployeeProfessionalInfoProps) {
  const handleChange = (field: string, value: string) => {
    onChange({ [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <Label htmlFor="jobTitle">Job Title</Label>
          <Input
            id="jobTitle"
            value={data.jobTitle || ""}
            onChange={(e) => handleChange("jobTitle", e.target.value)}
            placeholder="Enter job title"
            data-testid="input-job-title"
          />
        </div>
        
        <div>
          <Label htmlFor="workLocation">Work Location</Label>
          <Select value={data.workLocation || ""} onValueChange={(value) => handleChange("workLocation", value)}>
            <SelectTrigger data-testid="select-work-location">
              <SelectValue placeholder="Select work location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Main Hospital">Main Hospital</SelectItem>
              <SelectItem value="North Clinic">North Clinic</SelectItem>
              <SelectItem value="South Clinic">South Clinic</SelectItem>
              <SelectItem value="Emergency Department">Emergency Department</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="status">Employment Status</Label>
          <Select value={data.status || "active"} onValueChange={(value) => handleChange("status", value)}>
            <SelectTrigger data-testid="select-status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="on_leave">On Leave</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="npiNumber">NPI Number</Label>
          <Input
            id="npiNumber"
            value={data.npiNumber || ""}
            onChange={(e) => handleChange("npiNumber", e.target.value)}
            placeholder="Enter NPI number"
            data-testid="input-npi-number"
          />
        </div>
        
        <div>
          <Label htmlFor="enumerationDate">Enumeration Date</Label>
          <Input
            id="enumerationDate"
            type="date"
            value={data.enumerationDate || ""}
            onChange={(e) => handleChange("enumerationDate", e.target.value)}
            data-testid="input-enumeration-date"
          />
        </div>
        
        <div>
          <Label htmlFor="workPhone">Work Phone</Label>
          <Input
            id="workPhone"
            type="tel"
            value={data.workPhone || ""}
            onChange={(e) => handleChange("workPhone", e.target.value)}
            placeholder="(555) 123-4567"
            data-testid="input-work-phone"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="qualification">Qualifications</Label>
        <Textarea
          id="qualification"
          value={data.qualification || ""}
          onChange={(e) => handleChange("qualification", e.target.value)}
          placeholder="Enter professional qualifications and certifications"
          rows={4}
          data-testid="textarea-qualification"
        />
      </div>
    </div>
  );
}
