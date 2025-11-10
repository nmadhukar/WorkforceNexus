import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useParams } from "wouter";
import { z } from "zod";
import { format } from "date-fns";
import { 
  Save, 
  ArrowLeft, 
  User, 
  Building2,
  Calendar,
  AlertCircle
} from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Form schema
const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  dueDate: z.string().min(1, "Due date is required"),
  assignedToId: z.coerce.number().positive("Please select an assignee"),
  relatedType: z.enum(["employee", "location"]),
  relatedEmployeeId: z.coerce.number().optional(),
  relatedLocationId: z.coerce.number().optional(),
  category: z.enum(["inspection", "review", "compliance", "training", "other"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["open", "in_progress", "completed", "cancelled"]).default("open"),
  isRecurring: z.boolean().default(false),
  recurrencePattern: z.enum(["annual", "quarterly", "monthly", "weekly"]).optional()
}).refine(data => {
  if (data.relatedType === "employee") {
    return data.relatedEmployeeId && data.relatedEmployeeId > 0;
  } else {
    return data.relatedLocationId && data.relatedLocationId > 0;
  }
}, {
  message: "Please select an employee or location",
  path: ["relatedEmployeeId"]
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
}

interface Location {
  id: number;
  name: string;
}

interface User {
  id: number;
  username: string;
  role: string;
}

export default function TaskForm() {
  const [location, setLocation] = useLocation();
  const { id } = useParams();
  const isEditMode = !!id;
  const { toast } = useToast();
  const [relatedType, setRelatedType] = useState<"employee" | "location">("employee");

  // Fetch employees for dropdowns
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const response = await fetch("/api/employees?active=true", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch employees");
      const data = await response.json();
      // Handle paginated response
      return data.employees || data;
    }
  });

  // Fetch locations for dropdown
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
    queryFn: async () => {
      const response = await fetch("/api/locations", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch locations");
      const data = await response.json();
      // Handle array or paginated response
      return Array.isArray(data) ? data : (data.locations || data);
    }
  });

  // Note: We don't need users anymore since tasks are assigned to employees

  // Fetch existing task if in edit mode
  const { data: existingTask, isLoading: isLoadingTask } = useQuery({
    queryKey: ["/api/tasks", id],
    queryFn: async () => {
      const response = await fetch(`/api/tasks/${id}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch task");
      return response.json();
    },
    enabled: isEditMode
  });

  // Form setup
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      dueDate: format(new Date(), "yyyy-MM-dd"),
      assignedToId: 0,
      relatedType: "employee",
      relatedEmployeeId: undefined,
      relatedLocationId: undefined,
      category: undefined,
      priority: "medium",
      status: "open",
      isRecurring: false,
      recurrencePattern: undefined
    }
  });

  // Update form when existing task loads
  useEffect(() => {
    if (existingTask) {
      const relType = existingTask.relatedEmployeeId ? "employee" : "location";
      setRelatedType(relType);
      form.reset({
        title: existingTask.title,
        description: existingTask.description || "",
        dueDate: existingTask.dueDate,
        assignedToId: existingTask.assignedToId,
        relatedType: relType,
        relatedEmployeeId: existingTask.relatedEmployeeId || undefined,
        relatedLocationId: existingTask.relatedLocationId || undefined,
        category: existingTask.category || undefined,
        priority: existingTask.priority || "medium",
        status: existingTask.status || "open",
        isRecurring: existingTask.isRecurring || false,
        recurrencePattern: existingTask.recurrencePattern || undefined
      });
    }
  }, [existingTask, form]);

  // Create/update task mutation
  const saveTaskMutation = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      const payload = {
        ...values,
        relatedEmployeeId: values.relatedType === "employee" ? values.relatedEmployeeId : undefined,
        relatedLocationId: values.relatedType === "location" ? values.relatedLocationId : undefined
      };
      delete (payload as any).relatedType;

      if (isEditMode) {
        return apiRequest(`/api/tasks/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        return apiRequest("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: isEditMode ? "Task Updated" : "Task Created",
        description: isEditMode ? "Task has been updated successfully." : "Task has been created successfully.",
      });
      setLocation("/tasks");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save task. Please try again.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (values: TaskFormValues) => {
    saveTaskMutation.mutate(values);
  };

  if (isEditMode && isLoadingTask) {
    return (
      <MainLayout>
        <div className="p-8 text-center">Loading task...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild data-testid="button-back">
            <Link href="/tasks">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Tasks
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isEditMode ? "Edit Task" : "Create New Task"}</CardTitle>
            <CardDescription>
              {isEditMode ? "Update the task details below." : "Fill in the details to create a new task."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Enter task title"
                          data-testid="input-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Enter task description"
                          rows={4}
                          data-testid="input-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Due Date */}
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date *</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field}
                          data-testid="input-due-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Assigned To */}
                <FormField
                  control={form.control}
                  name="assignedToId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To *</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(parseInt(value))} 
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-assigned-to">
                            <SelectValue placeholder="Select assignee" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.map((employee) => (
                            <SelectItem key={employee.id} value={employee.id.toString()}>
                              {employee.firstName} {employee.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Related To */}
                <div className="space-y-4">
                  <Label>Related To *</Label>
                  <FormField
                    control={form.control}
                    name="relatedType"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => {
                              field.onChange(value);
                              setRelatedType(value as "employee" | "location");
                              form.setValue("relatedEmployeeId", undefined);
                              form.setValue("relatedLocationId", undefined);
                            }}
                            value={field.value}
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="employee" id="employee" data-testid="radio-employee" />
                              <Label htmlFor="employee" className="flex items-center gap-2 cursor-pointer">
                                <User className="w-4 h-4" />
                                Employee
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="location" id="location" data-testid="radio-location" />
                              <Label htmlFor="location" className="flex items-center gap-2 cursor-pointer">
                                <Building2 className="w-4 h-4" />
                                Location
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {relatedType === "employee" ? (
                    <FormField
                      control={form.control}
                      name="relatedEmployeeId"
                      render={({ field }) => (
                        <FormItem>
                          <Select 
                            onValueChange={(value) => field.onChange(parseInt(value))} 
                            value={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-related-employee">
                                <SelectValue placeholder="Select employee" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {employees.map((employee) => (
                                <SelectItem key={employee.id} value={employee.id.toString()}>
                                  {employee.firstName} {employee.lastName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="relatedLocationId"
                      render={({ field }) => (
                        <FormItem>
                          <Select 
                            onValueChange={(value) => field.onChange(parseInt(value))} 
                            value={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-related-location">
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {locations.map((location) => (
                                <SelectItem key={location.id} value={location.id.toString()}>
                                  {location.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category */}
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="inspection">Inspection</SelectItem>
                            <SelectItem value="review">Review</SelectItem>
                            <SelectItem value="compliance">Compliance</SelectItem>
                            <SelectItem value="training">Training</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Priority */}
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-priority">
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Status (only in edit mode) */}
                  {isEditMode && (
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-status">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Recurring */}
                <FormField
                  control={form.control}
                  name="isRecurring"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-recurring"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Recurring Task
                        </FormLabel>
                        <FormDescription>
                          Enable if this task should repeat on a schedule
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Recurring Pattern */}
                {form.watch("isRecurring") && (
                  <FormField
                    control={form.control}
                    name="recurrencePattern"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recurring Pattern</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-recurring-pattern">
                              <SelectValue placeholder="Select pattern" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="annual">Annual</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Form Actions */}
                <div className="flex justify-end gap-4">
                  <Button variant="outline" asChild data-testid="button-cancel">
                    <Link href="/tasks">Cancel</Link>
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={saveTaskMutation.isPending}
                    data-testid="button-submit"
                  >
                    {saveTaskMutation.isPending ? (
                      <>Saving...</>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {isEditMode ? "Update Task" : "Create Task"}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}