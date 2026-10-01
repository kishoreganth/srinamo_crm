import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHousekeepingBoard, useHousekeepingTasks, useCreateTask, useUpdateTask } from '@/hooks/useHousekeeping';
import { useRooms } from '@/hooks/useRooms';
import { cn, getStatusColor } from '@/lib/utils';
import { toast } from 'sonner';
import type { Room, TaskType, TaskPriority } from '@/types';

const taskSchema = z.object({
  roomId: z.string().min(1, 'Room required'),
  type: z.string().min(1),
  priority: z.string().min(1),
  notes: z.string().optional(),
});

export default function HousekeepingPage() {
  const { data: board, isLoading } = useHousekeepingBoard();
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const { data: tasks } = useHousekeepingTasks({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
  });
  const { data: rooms } = useRooms();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const [showDialog, setShowDialog] = useState(false);

  const form = useForm({ resolver: zodResolver(taskSchema) });

  const statusColors: Record<string, string> = {
    AVAILABLE: 'bg-emerald-400',
    OCCUPIED: 'bg-blue-400',
    CLEANING: 'bg-yellow-400',
    MAINTENANCE: 'bg-red-400',
    INSPECTED: 'bg-purple-400',
  };

  const handleCreate = async (data: z.infer<typeof taskSchema>) => {
    try {
      await createTask.mutateAsync({
        roomId: data.roomId,
        type: data.type as TaskType,
        priority: data.priority as TaskPriority,
        notes: data.notes,
      });
      setShowDialog(false);
      form.reset();
      toast.success('Task created');
    } catch {
      toast.error('Failed to create task');
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await updateTask.mutateAsync({ id, status } as any);
      toast.success('Task updated');
    } catch {
      toast.error('Failed to update task');
    }
  };

  if (isLoading) return <div className="p-6"><Skeleton className="h-96" /></div>;

  return (
    <div className="p-6 space-y-6">
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Room Status Board</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(statusColors).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5 text-xs">
              <div className={cn('h-3 w-3 rounded', color)} />
              <span>{status}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {(board as Room[])?.map((room) => (
            <div
              key={room.id}
              className={cn(
                'rounded-lg p-2 text-center text-xs font-medium text-white',
                statusColors[room.status] || 'bg-gray-400'
              )}
              title={`${room.roomNumber} - ${room.status}`}
            >
              {room.roomNumber}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Tasks</h3>
          <Button size="sm" onClick={() => setShowDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" /> Create Task
          </Button>
        </div>

        <div className="flex gap-3 mb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="CLEANING">Cleaning</SelectItem>
              <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
              <SelectItem value="INSPECTION">Inspection</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {tasks?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.room?.roomNumber}</TableCell>
                  <TableCell><Badge variant="secondary">{task.type}</Badge></TableCell>
                  <TableCell>
                    <Badge className={task.priority === 'URGENT' ? 'bg-red-100 text-red-800' : task.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}>
                      {task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell><Badge className={getStatusColor(task.status)}>{task.status}</Badge></TableCell>
                  <TableCell className="max-w-[200px] truncate">{task.notes || '-'}</TableCell>
                  <TableCell>
                    {task.status === 'PENDING' && (
                      <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(task.id, 'IN_PROGRESS')}>
                        Start
                      </Button>
                    )}
                    {task.status === 'IN_PROGRESS' && (
                      <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(task.id, 'COMPLETED')}>
                        Complete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-gray-500 py-8">No tasks found</p>
        )}
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
            <div className="space-y-1">
              <Label>Room</Label>
              <Select onValueChange={(v) => form.setValue('roomId', v)}>
                <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                <SelectContent>
                  {rooms?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.roomNumber} - {r.roomType.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select onValueChange={(v) => form.setValue('type', v)}>
                  <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLEANING">Cleaning</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    <SelectItem value="INSPECTION">Inspection</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select onValueChange={(v) => form.setValue('priority', v)}>
                  <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea {...form.register('notes')} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
