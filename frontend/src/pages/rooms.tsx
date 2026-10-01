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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRoomStatusBoard, useRoomTypes, useUpdateRoomStatus, useCreateRoomType } from '@/hooks/useRooms';
import { cn, formatCurrency, getStatusColor } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from 'sonner';
import type { Room, RoomStatus } from '@/types';

const roomTypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  basePrice: z.coerce.number().min(1),
  maxOccupancy: z.coerce.number().min(1),
  amenities: z.string().min(1),
});

export default function RoomsPage() {
  const { user } = useAuthStore();
  const { data: rooms, isLoading } = useRoomStatusBoard();
  const { data: roomTypes, isLoading: typesLoading } = useRoomTypes();
  const updateStatus = useUpdateRoomStatus();
  const createRoomType = useCreateRoomType();

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showTypeDialog, setShowTypeDialog] = useState(false);

  const typeForm = useForm({ resolver: zodResolver(roomTypeSchema) });

  const statusColors: Record<string, string> = {
    AVAILABLE: 'border-emerald-400 bg-emerald-50',
    OCCUPIED: 'border-blue-400 bg-blue-50',
    CLEANING: 'border-yellow-400 bg-yellow-50',
    MAINTENANCE: 'border-red-400 bg-red-50',
    INSPECTED: 'border-purple-400 bg-purple-50',
  };

  const handleStatusUpdate = async (status: RoomStatus) => {
    if (!selectedRoom) return;
    try {
      await updateStatus.mutateAsync({ id: selectedRoom.id, status });
      setShowStatusDialog(false);
      toast.success('Room status updated');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleCreateType = async (data: z.infer<typeof roomTypeSchema>) => {
    try {
      await createRoomType.mutateAsync({
        name: data.name,
        description: data.description,
        basePrice: data.basePrice,
        maxOccupancy: data.maxOccupancy,
        amenities: data.amenities.split(',').map((a) => a.trim()),
      });
      setShowTypeDialog(false);
      typeForm.reset();
      toast.success('Room type created');
    } catch {
      toast.error('Failed to create room type');
    }
  };

  if (isLoading) {
    return <div className="p-6"><Skeleton className="h-96" /></div>;
  }

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  return (
    <div className="p-6 space-y-4">
      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Room Board</TabsTrigger>
          <TabsTrigger value="types">Room Types</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {(rooms as Room[])?.map((room) => (
              <Card
                key={room.id}
                className={cn('p-4 border-2 cursor-pointer hover:shadow-md transition-shadow', statusColors[room.status])}
                onClick={() => { setSelectedRoom(room); setShowStatusDialog(true); }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold text-gray-900">{room.roomNumber}</span>
                  <Badge className={getStatusColor(room.status)} >{room.status}</Badge>
                </div>
                <p className="text-sm text-gray-600">{room.roomType?.name}</p>
                <p className="text-xs text-gray-400">Floor {room.floor}</p>
              </Card>
            ))}
          </div>
          {(!rooms || (rooms as Room[]).length === 0) && (
            <p className="text-center text-gray-500 py-12">No rooms found</p>
          )}
        </TabsContent>

        <TabsContent value="types" className="mt-4">
          <Card className="p-5">
            {isAdmin && (
              <div className="flex justify-end mb-4">
                <Button onClick={() => setShowTypeDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="h-4 w-4 mr-2" /> Add Room Type
                </Button>
              </div>
            )}
            {typesLoading ? <Skeleton className="h-48" /> : roomTypes?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Max Occupancy</TableHead>
                    <TableHead>Base Price</TableHead>
                    <TableHead>Amenities</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roomTypes.map((rt) => (
                    <TableRow key={rt.id}>
                      <TableCell className="font-medium">{rt.name}</TableCell>
                      <TableCell>{rt.maxOccupancy}</TableCell>
                      <TableCell>{formatCurrency(rt.basePrice)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {rt.amenities?.map((a) => (
                            <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-gray-500 py-8">No room types defined</p>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Room {selectedRoom?.roomNumber} - Change Status</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {(['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'INSPECTED'] as RoomStatus[]).map((s) => (
              <Button
                key={s}
                variant="outline"
                className={cn(selectedRoom?.status === s && 'ring-2 ring-emerald-500')}
                onClick={() => handleStatusUpdate(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTypeDialog} onOpenChange={setShowTypeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Room Type</DialogTitle></DialogHeader>
          <form onSubmit={typeForm.handleSubmit(handleCreateType)} className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input {...typeForm.register('name')} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input {...typeForm.register('description')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Base Price (₹)</Label>
                <Input type="number" {...typeForm.register('basePrice')} />
              </div>
              <div className="space-y-1">
                <Label>Max Occupancy</Label>
                <Input type="number" {...typeForm.register('maxOccupancy')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Amenities (comma-separated)</Label>
              <Input {...typeForm.register('amenities')} placeholder="WiFi, AC, TV" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowTypeDialog(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
