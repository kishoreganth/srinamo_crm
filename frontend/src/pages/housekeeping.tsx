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
import { cn, getStatusColor, getStatusDot } from '@/lib/utils';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/page-header';
import { ErrorState } from '@/components/layout/empty-state';
import type { Room, TaskType } from '@/types';

const taskSchema = z.object({
  roomId: z.string().min(1, 'Room required'),
  taskType: z.string().min(1),
  notes: z.string().optional(),
});

export default function HousekeepingPage() {
  const { data: board, isLoading, isError, refetch } = useHousekeepingBoard();
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const { data: taskRows } = useHousekeepingTasks({
    status: statusFilter || undefined,
  });
  const tasks = (taskRows ?? []).filter((task) => !typeFilter || typeFilter === 'all' || task.taskType === typeFilter);
  const { data: rooms } = useRooms();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const [showDialog, setShowDialog] = useState(false);
  const [flashId, setFlashId] = useState('');

  const form = useForm({ resolver: zodResolver(taskSchema) });


  const handleCreate = async (data: z.infer<typeof taskSchema>) => {
    try {
      await createTask.mutateAsync({
        roomId: data.roomId,
        taskType: data.taskType as TaskType,
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
      setFlashId(id);
      window.setTimeout(() => setFlashId((cur) => (cur === id ? '' : cur)), 400);
      toast.success('Task updated');
    } catch {
      toast.error('Failed to update task');
    }
  };

  if (isError) return <div className="p-6"><ErrorState message="Housekeeping could not be loaded." onRetry={() => refetch()} /></div>;

  if (isLoading) return <div className="p-6"><Skeleton className="h-96" /></div>;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader title="Housekeeping" description="Room board and open tasks." />
      <Card className="p-5">
        <h3 className="font-semibold text-ink mb-4">Room Status Board</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'INSPECTED'].map((status) => (
            <div key={status} className="flex items-center gap-1.5 text-xs text-ink">
              <div className={cn('h-3 w-3 rounded', getStatusDot(status))} />
              <span>{status}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {(board as Room[])?.map((room) => (
            <div
              key={room.id}
              className={cn(
                'rounded-lg p-2 text-center text-xs font-medium',
                getStatusColor(room.status)
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
          <h3 className="font-semibold text-ink">Tasks</h3>
          <Button size="sm" onClick={() => setShowDialog(true)}>
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
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id} className={flashId === task.id ? 'motion-row' : ''}>
                  <TableCell className="font-medium">{task.room?.roomNumber}</TableCell>
                  <TableCell><Badge variant="secondary">{task.taskType}</Badge></TableCell>
                  <TableCell><Badge className={cn(getStatusColor(task.status), flashId === task.id && 'motion-pulse')}>{task.status}</Badge></TableCell>
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
          <p className="text-center text-muted py-8">No tasks found</p>
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
                    <SelectItem key={r.id} value={r.id}>{r.roomNumber} - {r.roomType?.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select onValueChange={(v) => form.setValue('taskType', v)}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLEANING">Cleaning</SelectItem>
                  <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  <SelectItem value="INSPECTION">Inspection</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea {...form.register('notes')} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
