import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EmployeePersonalInfoProps {
  data: any;
  onChange: (data: any) => void;
}

export function EmployeePersonalInfo({ data, onChange }: EmployeePersonalInfoProps) {
  const handleChange = (field: string, value: string) => {
    onChange({ [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            value={data.firstName || ""}
            onChange={(e) => handleChange("firstName", e.target.value)}
            placeholder="Enter first name"
            required
            data-testid="input-first-name"
          />
        </div>
        
        <div>
          <Label htmlFor="middleName">Middle Name</Label>
          <Input
            id="middleName"
            value={data.middleName || ""}
            onChange={(e) => handleChange("middleName", e.target.value)}
            placeholder="Enter middle name"
            data-testid="input-middle-name"
          />
        </div>
        
        <div>
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            value={data.lastName || ""}
            onChange={(e) => handleChange("lastName", e.target.value)}
            placeholder="Enter last name"
            required
            data-testid="input-last-name"
          />
        </div>
        
        <div>
          <Label htmlFor="dateOfBirth">Date of Birth *</Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={data.dateOfBirth || ""}
            onChange={(e) => handleChange("dateOfBirth", e.target.value)}
            data-testid="input-date-of-birth"
          />
        </div>
        
        <div>
          <Label htmlFor="gender">Gender</Label>
          <Select value={data.gender || ""} onValueChange={(value) => handleChange("gender", value)}>
            <SelectTrigger data-testid="select-gender">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="ssn">SSN *</Label>
          <Input
            id="ssn"
            value={data.ssn || ""}
            onChange={(e) => handleChange("ssn", e.target.value)}
            placeholder="XXX-XX-XXXX"
            maxLength={11}
            data-testid="input-ssn"
          />
        </div>
        
        <div>
          <Label htmlFor="personalEmail">Personal Email</Label>
          <Input
            id="personalEmail"
            type="email"
            value={data.personalEmail || ""}
            onChange={(e) => handleChange("personalEmail", e.target.value)}
            placeholder="personal@email.com"
            data-testid="input-personal-email"
          />
        </div>
        
        <div>
          <Label htmlFor="workEmail">Work Email *</Label>
          <Input
            id="workEmail"
            type="email"
            value={data.workEmail || ""}
            onChange={(e) => handleChange("workEmail", e.target.value)}
            placeholder="work@hospital.com"
            required
            data-testid="input-work-email"
          />
        </div>
        
        <div>
          <Label htmlFor="cellPhone">Cell Phone</Label>
          <Input
            id="cellPhone"
            type="tel"
            value={data.cellPhone || ""}
            onChange={(e) => handleChange("cellPhone", e.target.value)}
            placeholder="(555) 123-4567"
            data-testid="input-cell-phone"
          />
        </div>
      </div>

      {/* Address Information */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-foreground">Home Address</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Label htmlFor="homeAddress1">Address Line 1</Label>
            <Input
              id="homeAddress1"
              value={data.homeAddress1 || ""}
              onChange={(e) => handleChange("homeAddress1", e.target.value)}
              placeholder="123 Main Street"
              data-testid="input-home-address1"
            />
          </div>
          
          <div>
            <Label htmlFor="homeAddress2">Address Line 2</Label>
            <Input
              id="homeAddress2"
              value={data.homeAddress2 || ""}
              onChange={(e) => handleChange("homeAddress2", e.target.value)}
              placeholder="Apt, Suite, etc."
              data-testid="input-home-address2"
            />
          </div>
          
          <div>
            <Label htmlFor="homeCity">City</Label>
            <Input
              id="homeCity"
              value={data.homeCity || ""}
              onChange={(e) => handleChange("homeCity", e.target.value)}
              placeholder="Enter city"
              data-testid="input-home-city"
            />
          </div>
          
          <div>
            <Label htmlFor="homeState">State</Label>
            <Input
              id="homeState"
              value={data.homeState || ""}
              onChange={(e) => handleChange("homeState", e.target.value)}
              placeholder="Enter state"
              data-testid="input-home-state"
            />
          </div>
          
          <div>
            <Label htmlFor="homeZip">ZIP Code</Label>
            <Input
              id="homeZip"
              value={data.homeZip || ""}
              onChange={(e) => handleChange("homeZip", e.target.value)}
              placeholder="12345"
              data-testid="input-home-zip"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
