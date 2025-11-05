import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Edit, Trash2 } from "lucide-react";

export type EmployeeTasksProps = {
  employeeId: number;
  employeeName?: string;
};

type Task = {
  id: number;
  name: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  assigneeId: number | null;
  assigneeName: string;
};

export function EmployeeTasks({ employeeId, employeeName }: EmployeeTasksProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load tasks from API
  const { data: tasksData, isLoading: isTasksLoading } = useQuery<{ tasks: Task[] }>({
    queryKey: ["/api/employees", employeeId, "tasks"],
    queryFn: async ({ queryKey }) => {
      const [, id] = queryKey as [string, number, string];
      const res = await fetch(`/api/employees/${id}/tasks`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
    enabled: !!employeeId,
  });
  const tasks: Task[] = tasksData?.tasks || [];

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [taskForm, setTaskForm] = useState<{
    name: string;
    description: string;
    dueDate: string;
    assigneeId: number | null;
    assigneeName: string;
  }>({ name: "", description: "", dueDate: "", assigneeId: null, assigneeName: "" });
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");

  const { data: employeeSearchData } = useQuery<any>({
    queryKey: ["/api/employees", 1, { search: employeeSearchQuery, limit: 10 }],
    queryFn: async ({ queryKey }) => {
      const [url, pageNum, opts] = queryKey as [string, number, { search: string; limit: number }];
      const params = new URLSearchParams({ page: String(pageNum), limit: String(opts.limit) });
      if (opts.search) params.set("search", opts.search);
      const res = await fetch(`${url}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
    enabled: showTaskModal,
  });

  const employeeOptions: Array<{ id: number; name: string }> = (employeeSearchData?.employees || []).map((e: any) => ({
    id: e.id,
    name: `${e.firstName} ${e.lastName}`,
  }));

  const openAddTask = () => {
    setEditingTaskId(null);
    setTaskForm({ name: "", description: "", dueDate: "", assigneeId: null, assigneeName: "" });
    setEmployeeSearchQuery("");
    setShowTaskModal(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setTaskForm({ name: task.name, description: task.description, dueDate: task.dueDate, assigneeId: task.assigneeId, assigneeName: task.assigneeName });
    setEmployeeSearchQuery("");
    setShowTaskModal(true);
  };

  const createMutation = useMutation({
    mutationFn: async (payload: Omit<Task, "id">) => {
      const res = await fetch(`/api/employees/${employeeId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "tasks"] });
      setShowTaskModal(false);
      toast({ title: "Task created successfully" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e?.message || "Failed to create task", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<Task> }) => {
      const res = await fetch(`/api/employees/${employeeId}/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "tasks"] });
      setShowTaskModal(false);
      toast({ title: "Task updated successfully" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e?.message || "Failed to update task", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/employees/${employeeId}/tasks/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete task");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "tasks"] });
      setConfirmDeleteId(null);
      toast({ title: "Task deleted successfully" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e?.message || "Failed to delete task", variant: "destructive" });
    }
  });

  const handleDeleteTask = (id: number) => {
    setConfirmDeleteId(id);
  };

  const handleSaveTask = () => {
    if (!taskForm.name.trim() || !taskForm.dueDate || !taskForm.assigneeId) {
      toast({ title: "Missing fields", description: "Please provide name, due date, and assignee.", variant: "destructive" });
      return;
    }

    const payload = {
      name: taskForm.name.trim(),
      description: taskForm.description.trim(),
      dueDate: taskForm.dueDate,
      assigneeId: taskForm.assigneeId!,
      assigneeName: taskForm.assigneeName,
    } as Omit<Task, "id">;

    if (editingTaskId) {
      updateMutation.mutate({ id: editingTaskId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Tasks</h3>
        <Button onClick={openAddTask} data-testid="button-add-task">Add Task</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[22%]">Name</TableHead>
                <TableHead className="w-[38%]">Description</TableHead>
                <TableHead className="w-[15%]">Due Date</TableHead>
                <TableHead className="w-[15%]">Assignee</TableHead>
                <TableHead className="w-[10%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No tasks yet.</TableCell>
                </TableRow>
              ) : (
                tasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.description || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {(() => {
                        const d = new Date(t.dueDate);
                        // Format MM-DD-YYYY
                        const mm = String(d.getMonth() + 1).padStart(2, "0");
                        const dd = String(d.getDate()).padStart(2, "0");
                        const yyyy = d.getFullYear();
                        return `${yyyy}-${mm}-${dd}`;
                      })()}
                    </TableCell>
                    <TableCell className="text-sm">{t.assigneeName}</TableCell>
                    <TableCell className="text-right space-x-2 flex items-center justify-end">
                      <Button variant="outline" size="sm" onClick={() => openEditTask(t)} data-testid={`task-edit-${t.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteTask(t.id)} data-testid={`task-delete-${t.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingTaskId ? "Edit Task" : "Add Task"}</DialogTitle>
            <DialogDescription>
              {editingTaskId ? "Update task details." : "Create a new task for this employee."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="task-name">Name</Label>
              <Input id="task-name" placeholder="Enter task name" value={taskForm.name} onChange={(e) => setTaskForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="task-desc">Description</Label>
              <textarea id="task-desc" className="w-full border rounded-md p-2 text-sm bg-background" rows={3} placeholder="Enter task description" value={taskForm.description} onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="task-due">Due Date</Label>
              <Input id="task-due" type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm(prev => ({ ...prev, dueDate: e.target.value }))} />
            </div>
            <div>
              <Label>Assign To</Label>
              <Select
                value={taskForm.assigneeId ? String(taskForm.assigneeId) : ""}
                onValueChange={(value) => {
                  const opt = employeeOptions.find(o => String(o.id) === value);
                  setTaskForm(prev => ({
                    ...prev,
                    assigneeId: opt ? opt.id : null,
                    assigneeName: opt ? opt.name : ""
                  }));
                }}
              >
                <SelectTrigger data-testid="select-assignee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employeeOptions.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground select-none">No results</div>
                  ) : (
                    employeeOptions.map(opt => (
                      <SelectItem key={opt.id} value={String(opt.id)}>
                        {opt.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowTaskModal(false)}>Cancel</Button>
            <Button onClick={handleSaveTask} data-testid="button-save-task" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingTaskId ? (updateMutation.isPending ? "Saving..." : "Save Changes") : (createMutation.isPending ? "Adding..." : "Add Task")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Modal */}
      <Dialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId !== null && deleteMutation.mutate(confirmDeleteId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-task"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


