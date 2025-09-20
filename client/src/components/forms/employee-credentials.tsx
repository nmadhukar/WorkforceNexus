import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

interface EmployeeCredentialsProps {
  data: any;
  onChange: (data: any) => void;
}

export function EmployeeCredentials({ data, onChange }: EmployeeCredentialsProps) {
  const handleChange = (field: string, value: string | boolean) => {
    onChange({ [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Medical Licenses */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-foreground">Medical Licenses</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="medicalLicenseNumber">Medical License Number</Label>
            <Input
              id="medicalLicenseNumber"
              value={data.medicalLicenseNumber || ""}
              onChange={(e) => handleChange("medicalLicenseNumber", e.target.value)}
              placeholder="Enter medical license number"
              data-testid="input-medical-license-number"
            />
          </div>
          
          <div>
            <Label htmlFor="substanceUseLicenseNumber">Substance Use License Number</Label>
            <Input
              id="substanceUseLicenseNumber"
              value={data.substanceUseLicenseNumber || ""}
              onChange={(e) => handleChange("substanceUseLicenseNumber", e.target.value)}
              placeholder="Enter substance use license number"
              data-testid="input-substance-use-license-number"
            />
          </div>
          
          <div>
            <Label htmlFor="mentalHealthLicenseNumber">Mental Health License Number</Label>
            <Input
              id="mentalHealthLicenseNumber"
              value={data.mentalHealthLicenseNumber || ""}
              onChange={(e) => handleChange("mentalHealthLicenseNumber", e.target.value)}
              placeholder="Enter mental health license number"
              data-testid="input-mental-health-license-number"
            />
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="substanceUseQualification">Substance Use Qualification</Label>
            <Textarea
              id="substanceUseQualification"
              value={data.substanceUseQualification || ""}
              onChange={(e) => handleChange("substanceUseQualification", e.target.value)}
              placeholder="Enter substance use qualifications"
              data-testid="textarea-substance-use-qualification"
            />
          </div>
          
          <div>
            <Label htmlFor="mentalHealthQualification">Mental Health Qualification</Label>
            <Textarea
              id="mentalHealthQualification"
              value={data.mentalHealthQualification || ""}
              onChange={(e) => handleChange("mentalHealthQualification", e.target.value)}
              placeholder="Enter mental health qualifications"
              data-testid="textarea-mental-health-qualification"
            />
          </div>
        </div>
      </div>

      {/* Provider Numbers */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-foreground">Provider Numbers</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="medicaidNumber">Medicaid Number</Label>
            <Input
              id="medicaidNumber"
              value={data.medicaidNumber || ""}
              onChange={(e) => handleChange("medicaidNumber", e.target.value)}
              placeholder="Enter Medicaid number"
              data-testid="input-medicaid-number"
            />
          </div>
          
          <div>
            <Label htmlFor="medicarePtanNumber">Medicare PTAN Number</Label>
            <Input
              id="medicarePtanNumber"
              value={data.medicarePtanNumber || ""}
              onChange={(e) => handleChange("medicarePtanNumber", e.target.value)}
              placeholder="Enter Medicare PTAN number"
              data-testid="input-medicare-ptan-number"
            />
          </div>
        </div>
      </div>

      {/* CAQH Information */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-foreground">CAQH Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="caqhProviderId">CAQH Provider ID</Label>
            <Input
              id="caqhProviderId"
              value={data.caqhProviderId || ""}
              onChange={(e) => handleChange("caqhProviderId", e.target.value)}
              placeholder="Enter CAQH Provider ID"
              data-testid="input-caqh-provider-id"
            />
          </div>
          
          <div>
            <Label htmlFor="caqhIssueDate">CAQH Issue Date</Label>
            <Input
              id="caqhIssueDate"
              type="date"
              value={data.caqhIssueDate || ""}
              onChange={(e) => handleChange("caqhIssueDate", e.target.value)}
              data-testid="input-caqh-issue-date"
            />
          </div>
          
          <div>
            <Label htmlFor="caqhLastAttestationDate">Last Attestation Date</Label>
            <Input
              id="caqhLastAttestationDate"
              type="date"
              value={data.caqhLastAttestationDate || ""}
              onChange={(e) => handleChange("caqhLastAttestationDate", e.target.value)}
              data-testid="input-caqh-last-attestation-date"
            />
          </div>
          
          <div>
            <Label htmlFor="caqhReattestationDueDate">Re-attestation Due Date</Label>
            <Input
              id="caqhReattestationDueDate"
              type="date"
              value={data.caqhReattestationDueDate || ""}
              onChange={(e) => handleChange("caqhReattestationDueDate", e.target.value)}
              data-testid="input-caqh-reattestation-due-date"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="caqhEnabled"
            checked={data.caqhEnabled || false}
            onCheckedChange={(checked) => handleChange("caqhEnabled", checked)}
            data-testid="checkbox-caqh-enabled"
          />
          <Label htmlFor="caqhEnabled">CAQH Enabled</Label>
        </div>
      </div>
    </div>
  );
}
