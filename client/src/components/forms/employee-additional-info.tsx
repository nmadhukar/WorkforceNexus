import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmployeeAdditionalInfoProps {
  data: any;
  onChange: (data: any) => void;
}

export function EmployeeAdditionalInfo({ data, onChange }: EmployeeAdditionalInfoProps) {
  const handleChange = (field: string, value: string) => {
    onChange({ [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Login Credentials */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-foreground">Login Credentials</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="caqhLoginId">CAQH Login ID</Label>
            <Input
              id="caqhLoginId"
              value={data.caqhLoginId || ""}
              onChange={(e) => handleChange("caqhLoginId", e.target.value)}
              placeholder="Enter CAQH login ID"
              data-testid="input-caqh-login-id"
            />
          </div>
          
          <div>
            <Label htmlFor="caqhPassword">CAQH Password</Label>
            <Input
              id="caqhPassword"
              type="password"
              value={data.caqhPassword || ""}
              onChange={(e) => handleChange("caqhPassword", e.target.value)}
              placeholder="Enter CAQH password"
              data-testid="input-caqh-password"
            />
          </div>
          
          <div>
            <Label htmlFor="nppesLoginId">NPPES Login ID</Label>
            <Input
              id="nppesLoginId"
              value={data.nppesLoginId || ""}
              onChange={(e) => handleChange("nppesLoginId", e.target.value)}
              placeholder="Enter NPPES login ID"
              data-testid="input-nppes-login-id"
            />
          </div>
          
          <div>
            <Label htmlFor="nppesPassword">NPPES Password</Label>
            <Input
              id="nppesPassword"
              type="password"
              value={data.nppesPassword || ""}
              onChange={(e) => handleChange("nppesPassword", e.target.value)}
              placeholder="Enter NPPES password"
              data-testid="input-nppes-password"
            />
          </div>
        </div>
      </div>

      {/* Birth Information */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-foreground">Birth Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Label htmlFor="birthCity">Birth City</Label>
            <Input
              id="birthCity"
              value={data.birthCity || ""}
              onChange={(e) => handleChange("birthCity", e.target.value)}
              placeholder="Enter birth city"
              data-testid="input-birth-city"
            />
          </div>
          
          <div>
            <Label htmlFor="birthState">Birth State</Label>
            <Input
              id="birthState"
              value={data.birthState || ""}
              onChange={(e) => handleChange("birthState", e.target.value)}
              placeholder="Enter birth state"
              data-testid="input-birth-state"
            />
          </div>
          
          <div>
            <Label htmlFor="birthCountry">Birth Country</Label>
            <Input
              id="birthCountry"
              value={data.birthCountry || ""}
              onChange={(e) => handleChange("birthCountry", e.target.value)}
              placeholder="Enter birth country"
              data-testid="input-birth-country"
            />
          </div>
        </div>
      </div>

      {/* Driver's License */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-foreground">Driver's License</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <Label htmlFor="driversLicenseNumber">License Number</Label>
            <Input
              id="driversLicenseNumber"
              value={data.driversLicenseNumber || ""}
              onChange={(e) => handleChange("driversLicenseNumber", e.target.value)}
              placeholder="Enter license number"
              data-testid="input-drivers-license-number"
            />
          </div>
          
          <div>
            <Label htmlFor="dlStateIssued">State Issued</Label>
            <Input
              id="dlStateIssued"
              value={data.dlStateIssued || ""}
              onChange={(e) => handleChange("dlStateIssued", e.target.value)}
              placeholder="Enter state"
              data-testid="input-dl-state-issued"
            />
          </div>
          
          <div>
            <Label htmlFor="dlIssueDate">Issue Date</Label>
            <Input
              id="dlIssueDate"
              type="date"
              value={data.dlIssueDate || ""}
              onChange={(e) => handleChange("dlIssueDate", e.target.value)}
              data-testid="input-dl-issue-date"
            />
          </div>
          
          <div>
            <Label htmlFor="dlExpirationDate">Expiration Date</Label>
            <Input
              id="dlExpirationDate"
              type="date"
              value={data.dlExpirationDate || ""}
              onChange={(e) => handleChange("dlExpirationDate", e.target.value)}
              data-testid="input-dl-expiration-date"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
