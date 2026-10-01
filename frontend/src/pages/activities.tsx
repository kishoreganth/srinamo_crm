import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActivities, useCreateActivity, useActivityBookings, useBookActivity } from '@/hooks/useActivities';
import { useBookings } from '@/hooks/useBookings';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from 'sonner';

const activitySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.coerce.number().min(0),
  duration: z.coerce.number().min(1),
  maxCapacity: z.coerce.number().min(1),
});

const bookingSchema = z.object({
  activityId: z.string().min(1),
  bookingId: z.string().min(1),
  date: z.string().min(1),
  participants: z.coerce.number().min(1),
});

export default function ActivitiesPage() {
  const { user } = useAuthStore();
  const { data: activities, isLoading } = useActivities();
  const { data: activityBookings } = useActivityBookings();
  const { data: activeBookings } = useBookings({ status: 'CHECKED_IN' });
  const createActivity = useCreateActivity();
  const bookActivity = useBookActivity();

  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [showBookDialog, setShowBookDialog] = useState(false);

  const activityForm = useForm({ resolver: zodResolver(activitySchema) });
  const bookForm = useForm({ resolver: zodResolver(bookingSchema) });

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const handleCreateActivity = async (data: z.infer<typeof activitySchema>) => {
    try {
      await createActivity.mutateAsync(data);
      setShowActivityDialog(false);
      activityForm.reset();
      toast.success('Activity created');
    } catch {
      toast.error('Failed to create activity');
    }
  };

  const handleBookActivity = async (data: z.infer<typeof bookingSchema>) => {
    try {
      await bookActivity.mutateAsync(data);
      setShowBookDialog(false);
      bookForm.reset();
      toast.success('Activity booked');
    } catch {
      toast.error('Failed to book activity');
    }
  };

  if (isLoading) return <div className="p-6"><Skeleton className="h-96" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <div className="flex gap-2">
          <Button onClick={() => setShowBookDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" /> Book Activity
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => setShowActivityDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Activity
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activities?.map((activity) => (
          <Card key={activity.id} className="p-5">
            <h3 className="font-semibold text-gray-900 mb-1">{activity.name}</h3>
            <p className="text-sm text-gray-500 mb-3 line-clamp-2">{activity.description}</p>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="font-semibold text-emerald-700">{formatCurrency(activity.price)}</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{activity.duration}min</span>
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />Max {activity.maxCapacity}</span>
            </div>
            {!activity.isActive && <Badge variant="secondary" className="mt-2">Inactive</Badge>}
          </Card>
        ))}
        {!activities?.length && (
          <p className="col-span-3 text-center text-gray-500 py-12">No activities configured</p>
        )}
      </div>

      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Activity Bookings</h3>
        {activityBookings?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Participants</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activityBookings.map((ab) => (
                <TableRow key={ab.id}>
                  <TableCell className="font-medium">{ab.activity?.name}</TableCell>
                  <TableCell>{ab.booking?.guest?.firstName} {ab.booking?.guest?.lastName}</TableCell>
                  <TableCell>{formatDate(ab.date)}</TableCell>
                  <TableCell>{ab.participants}</TableCell>
                  <TableCell>{formatCurrency(ab.totalAmount)}</TableCell>
                  <TableCell><Badge className={getStatusColor(ab.status)}>{ab.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-gray-500 py-8">No activity bookings yet</p>
        )}
      </Card>

      <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Activity</DialogTitle></DialogHeader>
          <form onSubmit={activityForm.handleSubmit(handleCreateActivity)} className="space-y-4">
            <div className="space-y-1"><Label>Name</Label><Input {...activityForm.register('name')} /></div>
            <div className="space-y-1"><Label>Description</Label><Textarea {...activityForm.register('description')} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Price (₹)</Label><Input type="number" {...activityForm.register('price')} /></div>
              <div className="space-y-1"><Label>Duration (min)</Label><Input type="number" {...activityForm.register('duration')} /></div>
              <div className="space-y-1"><Label>Max Capacity</Label><Input type="number" {...activityForm.register('maxCapacity')} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowActivityDialog(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showBookDialog} onOpenChange={setShowBookDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Book Activity</DialogTitle></DialogHeader>
          <form onSubmit={bookForm.handleSubmit(handleBookActivity)} className="space-y-4">
            <div className="space-y-1">
              <Label>Activity</Label>
              <Select onValueChange={(v) => bookForm.setValue('activityId', v)}>
                <SelectTrigger><SelectValue placeholder="Select activity" /></SelectTrigger>
                <SelectContent>
                  {activities?.filter((a) => a.isActive).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} - {formatCurrency(a.price)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Booking (Guest)</Label>
              <Select onValueChange={(v) => bookForm.setValue('bookingId', v)}>
                <SelectTrigger><SelectValue placeholder="Select booking" /></SelectTrigger>
                <SelectContent>
                  {activeBookings?.data?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.guest.firstName} {b.guest.lastName} - Room {b.room.roomNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Date</Label><Input type="date" {...bookForm.register('date')} /></div>
              <div className="space-y-1"><Label>Participants</Label><Input type="number" min={1} {...bookForm.register('participants')} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowBookDialog(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Book</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
