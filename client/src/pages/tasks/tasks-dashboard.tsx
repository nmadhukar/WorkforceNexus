import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { 
  LayoutDashboard,
  AlertCircle,
  Clock,
  Calendar,
  CheckCircle2,
  User,
  Building2,
  ArrowRight,
  Plus,
  ListTodo,
  Target
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface TaskDashboard {
  summary: {
    totalOpen: number;
    overdue: number;
    dueThisWeek: number;
    dueThisMonth: number;
  };
  tasks: {
    overdue: Task[];
    dueThisWeek: Task[];
    dueThisMonth: Task[];
    dueLater: Task[];
  };
}

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
}

export default function TasksDashboard() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch dashboard data
  const { data: dashboard, isLoading } = useQuery<TaskDashboard>({
    queryKey: ["/api/tasks/dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/tasks/dashboard", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch dashboard");
      return response.json();
    }
  });

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return apiRequest(`/api/tasks/${taskId}/complete`, {
        method: "PATCH"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/dashboard"] });
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

  // Calculate days until due
  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
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

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge className="bg-yellow-100 text-yellow-800">{status}</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Render task table for a section
  const renderTaskTable = (tasks: Task[], sectionTitle: string, sectionColor: string) => {
    if (tasks.length === 0) {
      return null;
    }

    return (
      <Card>
        <CardHeader className={`border-l-4 ${sectionColor}`}>
          <CardTitle className="text-lg">{sectionTitle} ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Related To</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const daysUntilDue = getDaysUntilDue(task.dueDate);
                return (
                  <TableRow key={task.id} data-testid={`task-row-${task.id}`}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{task.title}</div>
                        {task.category && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            {task.category}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {format(new Date(task.dueDate), "MMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={daysUntilDue < 0 ? "destructive" : daysUntilDue <= 7 ? "default" : "secondary"}
                        data-testid={`days-badge-${task.id}`}
                      >
                        {daysUntilDue < 0 
                          ? `${Math.abs(daysUntilDue)}d overdue`
                          : daysUntilDue === 0 
                          ? "Today"
                          : `${daysUntilDue}d`
                        }
                      </Badge>
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
                    <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                    <TableCell>{getStatusBadge(task.status)}</TableCell>
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
                          data-testid={`button-view-${task.id}`}
                        >
                          <Link href={`/tasks/${task.id}/edit`}>
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <LayoutDashboard className="w-8 h-8" />
              Tasks Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">Overview of upcoming tasks and deadlines</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild data-testid="button-view-all">
              <Link href="/tasks">
                <ListTodo className="w-4 h-4 mr-2" />
                View All Tasks
              </Link>
            </Button>
            <Button asChild data-testid="button-new-task">
              <Link href="/tasks/new">
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </Link>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center gap-2">
              <Clock className="w-4 h-4 animate-spin" />
              Loading dashboard...
            </div>
          </div>
        ) : dashboard ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="card-total-open">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Open Tasks</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboard.summary.totalOpen}</div>
                  <p className="text-xs text-muted-foreground">
                    Active tasks requiring attention
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-overdue">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{dashboard.summary.overdue}</div>
                  <p className="text-xs text-muted-foreground">
                    Tasks past their due date
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-due-week">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Due This Week</CardTitle>
                  <Clock className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{dashboard.summary.dueThisWeek}</div>
                  <p className="text-xs text-muted-foreground">
                    Tasks due in the next 7 days
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-due-month">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Due This Month</CardTitle>
                  <Calendar className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{dashboard.summary.dueThisMonth}</div>
                  <p className="text-xs text-muted-foreground">
                    Tasks due in the next 30 days
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Task Lists by Category */}
            <div className="space-y-6">
              {renderTaskTable(dashboard.tasks.overdue, "Overdue Tasks", "border-red-500")}
              {renderTaskTable(dashboard.tasks.dueThisWeek, "Due This Week", "border-orange-500")}
              {renderTaskTable(dashboard.tasks.dueThisMonth, "Due This Month", "border-yellow-500")}
              {renderTaskTable(dashboard.tasks.dueLater, "Due Later", "border-green-500")}
            </div>

            {/* Empty State */}
            {dashboard.summary.totalOpen === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
                  <p className="text-muted-foreground mb-4">
                    There are no open tasks at the moment.
                  </p>
                  <Button asChild data-testid="button-create-task">
                    <Link href="/tasks/new">
                      <Plus className="w-4 h-4 mr-2" />
                      Create New Task
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
              <p className="text-muted-foreground">Failed to load dashboard data</p>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}