import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, File, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onUpload: (formData: FormData) => void;
  isUploading: boolean;
  employeeId?: number;
}

const documentTypes = [
  "Medical License",
  "DEA License",
  "Board Certification",
  "I-9 Form",
  "W-4 Form",
  "State License",
  "Training Certificate",
  "Insurance Document",
  "Other"
];

export function FileUpload({ onUpload, isUploading, employeeId }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [documentType, setDocumentType] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employeeId?.toString() || "");
  const [notes, setNotes] = useState("");
  const [signedDate, setSignedDate] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch employees for selection if no employeeId provided
  const { data: employeesData } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees?limit=100", { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch employees');
      return res.json();
    },
    enabled: !employeeId // Only fetch if employeeId not provided
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !documentType || !selectedEmployeeId) return;

    const formData = new FormData();
    formData.append("document", selectedFile);
    formData.append("documentType", documentType);
    formData.append("employeeId", selectedEmployeeId);
    if (signedDate) {
      formData.append("signedDate", signedDate);
    }
    if (notes) {
      formData.append("notes", notes);
    }

    onUpload(formData);
    
    // Reset form
    setSelectedFile(null);
    setDocumentType("");
    setSelectedEmployeeId(employeeId?.toString() || "");
    setNotes("");
    setSignedDate("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        {/* File Upload Zone */}
        <div
          className={cn(
            "upload-zone",
            dragOver && "dragover"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          data-testid="file-upload-zone"
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={handleFileSelect}
            data-testid="file-input"
          />
          
          {selectedFile ? (
            <div className="flex items-center justify-center space-x-3">
              <File className="w-8 h-8 text-primary" />
              <div className="text-center">
                <p className="font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile();
                }}
                data-testid="button-remove-file"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">
                Drop files here or click to browse
              </p>
              <p className="text-sm text-muted-foreground">
                Supports PDF, DOC, DOCX, JPG, PNG (max 10MB)
              </p>
            </div>
          )}
        </div>

        {/* Document Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="documentType">Document Type *</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger data-testid="select-document-type">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!employeeId && (
            <div>
              <Label htmlFor="employee">Employee *</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger data-testid="select-employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employeesData?.employees.map((employee: any) => (
                    <SelectItem key={employee.id} value={employee.id.toString()}>
                      {employee.firstName} {employee.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div>
            <Label htmlFor="signedDate">Signed Date</Label>
            <Input
              id="signedDate"
              type="date"
              value={signedDate}
              onChange={(e) => setSignedDate(e.target.value)}
              data-testid="input-signed-date"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this document..."
            data-testid="textarea-notes"
          />
        </div>

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || !documentType || isUploading}
          className="w-full"
          data-testid="button-upload"
        >
          {isUploading ? "Uploading..." : "Upload Document"}
        </Button>
      </CardContent>
    </Card>
  );
}
