import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { format, differenceInDays } from "date-fns";
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  User, 
  Building2, 
  Edit2, 
  Trash2, 
  Plus,
  Filter,
  ChevronRight,
  CheckSquare,
  ListTodo
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Task {
  id: number;
  title: string;
  description?: string;
  dueDate: string;
  status: string;
  priority: string;
  category?: string;
  assignedToId?: number;
  assignedToName?: string;
  relatedEmployeeId?: number;
  relatedEmployeeName?: string;
  relatedLocationId?: number;
  relatedLocationName?: string;
  isRecurring: boolean;
  createdAt: string;
  completedAt?: string;
  isOverdue?: boolean;
  daysUntilDue?: number;
}

export default function TasksList() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", { status: statusFilter !== "all" ? statusFilter : undefined }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      const response = await fetch(`/api/tasks${params.toString() ? `?${params}` : ""}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch tasks");
      return response.json();
    }
  });

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return apiRequest("PATCH", `/api/tasks/${taskId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Task Completed",
        description: "Task has been marked as complete.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete task. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Task Deleted",
        description: "Task has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete task. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
    if (categoryFilter !== "all" && task.category !== categoryFilter) return false;
    if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Get status badge color
  const getStatusBadge = (status: string, isOverdue?: boolean) => {
    if (isOverdue && status !== "completed") {
      return <Badge variant="destructive" data-testid={`status-overdue`}>Overdue</Badge>;
    }
    switch (status) {
      case "open":
        return <Badge className="bg-yellow-100 text-yellow-800" data-testid={`status-open`}>Open</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-800" data-testid={`status-in-progress`}>In Progress</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800" data-testid={`status-completed`}>Completed</Badge>;
      case "cancelled":
        return <Badge variant="secondary" data-testid={`status-cancelled`}>Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get priority badge color
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive">{priority}</Badge>;
      case "high":
        return <Badge className="bg-orange-100 text-orange-800">{priority}</Badge>;
      case "medium":
        return <Badge className="bg-blue-100 text-blue-800">{priority}</Badge>;
      case "low":
        return <Badge variant="secondary">{priority}</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  // Get row class based on due date
  const getRowClass = (task: Task) => {
    if (task.status === "completed" || task.status === "cancelled") return "";
    if (task.isOverdue) return "bg-red-50 hover:bg-red-100";
    if (task.daysUntilDue !== undefined && task.daysUntilDue < 7) return "bg-orange-50 hover:bg-orange-100";
    return "";
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <ListTodo className="w-8 h-8" />
              Task Management
            </h1>
            <p className="text-muted-foreground mt-1">Manage HR tasks and assignments</p>
          </div>
          <Button asChild data-testid="button-new-task">
            <Link href="/tasks/new">
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status" data-testid="select-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger id="priority" data-testid="select-priority-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger id="category" data-testid="select-category-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button asChild variant="outline" className="w-full" data-testid="button-view-dashboard">
                  <Link href="/tasks/dashboard">
                    <Calendar className="w-4 h-4 mr-2" />
                    View Dashboard
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="inline-flex items-center gap-2">
                  <Clock className="w-4 h-4 animate-spin" />
                  Loading tasks...
                </div>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-8 text-center">
                <ListTodo className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No tasks found</p>
                <Button asChild className="mt-4" data-testid="button-create-first-task">
                  <Link href="/tasks/new">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Task
                  </Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Related</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TableRow 
                      key={task.id} 
                      className={getRowClass(task)}
                      data-testid={`task-row-${task.id}`}
                    >
                      <TableCell className="font-medium">
                        <div>
                          <div>{task.title}</div>
                          {task.isRecurring && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              Recurring
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {format(new Date(task.dueDate), "MMM d, yyyy")}
                          {task.daysUntilDue !== undefined && task.status !== "completed" && (
                            <span className="text-xs text-muted-foreground">
                              ({task.daysUntilDue < 0 ? `${Math.abs(task.daysUntilDue)} days ago` : 
                                task.daysUntilDue === 0 ? "Today" : 
                                `${task.daysUntilDue} days`})
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {task.assignedToName && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            {task.assignedToName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.relatedEmployeeName && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            {task.relatedEmployeeName}
                          </div>
                        )}
                        {task.relatedLocationName && (
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            {task.relatedLocationName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{task.category || "-"}</TableCell>
                      <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                      <TableCell>{getStatusBadge(task.status, task.isOverdue)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {task.status !== "completed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => completeTaskMutation.mutate(task.id)}
                              disabled={completeTaskMutation.isPending}
                              data-testid={`button-complete-${task.id}`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            data-testid={`button-edit-${task.id}`}
                          >
                            <Link href={`/tasks/${task.id}/edit`}>
                              <Edit2 className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTaskToDelete(task)}
                            data-testid={`button-delete-${task.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{taskToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (taskToDelete) {
                  deleteTaskMutation.mutate(taskToDelete.id);
                  setTaskToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}