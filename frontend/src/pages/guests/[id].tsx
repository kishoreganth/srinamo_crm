import { useState } from 'react';
import { useGuest, useGuestBookings, useUpdateGuest } from '@/hooks/useGuests';
import { useMessages, useSendAction } from '@/hooks/useCrm';
import { navigate } from '@/lib/navigate';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { PhoneField } from '@/components/phone-field';
import { displayPhone } from '@/lib/country-codes';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Mail, Phone, MapPin, CreditCard, Calendar, Hash, Pencil } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { toast } from 'sonner';
import type { Booking } from '@/types';

interface Props {
  guestId: string;
}

export default function GuestDetailPage({ guestId }: Props) {
  const { data: guest, isLoading } = useGuest(guestId);
  const { data: bookings } = useGuestBookings(guestId);
  const updateGuest = useUpdateGuest();
  const sendAction = useSendAction();
  const { data: messages } = useMessages('GUEST', guestId);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '', lastName: '', phone: '', email: '', address: '', city: '', state: '', idType: '', idNumber: '', notes: '',
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!guest) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg text-gray-500">Guest not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/guests')}>
          Back to Guests
        </Button>
      </div>
    );
  }

  const bookingList = (bookings as Booking[]) ?? [];

  const openEditDialog = () => {
    setEditForm({
      firstName: guest.firstName || '', lastName: guest.lastName || '', phone: guest.phone || '',
      email: guest.email || '', address: guest.address || '', city: guest.city || '',
      state: guest.state || '', idType: guest.idType || '', idNumber: guest.idNumber || '', notes: guest.notes || '',
    });
    setShowEdit(true);
  };

  const handleEditSubmit = () => {
    updateGuest.mutate({ id: guestId, ...editForm }, {
      onSuccess: () => { toast.success('Guest updated'); setShowEdit(false); },
      onError: () => toast.error('Failed to update'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/guests')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Guests
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!guest.phone || guest.whatsappConsent === false} onClick={() => sendAction.mutate({ path: `/actions/guests/${guestId}/review` }, { onSuccess: () => toast.success('Review ask queued'), onError: () => toast.error('Send failed') })}>Ask review</Button>
          <Button variant="outline" size="sm" disabled={!guest.phone || guest.whatsappConsent === false} onClick={() => sendAction.mutate({ path: `/actions/guests/${guestId}/winback` }, { onSuccess: () => toast.success('Win-back queued'), onError: () => toast.error('Send failed') })}>Win-back</Button>
          <Button variant="outline" size="sm" onClick={openEditDialog}>
            <Pencil className="h-4 w-4 mr-1" /> Edit Guest
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center pt-6">
            <Avatar className="h-20 w-20 text-xl">
              <AvatarFallback className="bg-emerald-100 text-emerald-800">
                {getInitials(`${guest.firstName} ${guest.lastName}`)}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-4 text-xl font-bold">{guest.firstName} {guest.lastName}</h2>
            <div className="mt-4 w-full space-y-3">
              {guest.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{displayPhone(guest.phone)}</span>
                </div>
              )}
              {guest.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>{guest.email}</span>
                </div>
              )}
              {(guest.city || guest.state) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span>{[guest.city, guest.state, guest.country].filter(Boolean).join(', ')}</span>
                </div>
              )}
              {guest.idType && (
                <div className="flex items-center gap-2 text-sm">
                  <Hash className="h-4 w-4 text-gray-400" />
                  <span>{guest.idType}: {guest.idNumber}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="flex flex-col items-center pt-6">
                <Calendar className="h-6 w-6 text-emerald-600" />
                <p className="mt-2 text-2xl font-bold">{guest.totalStays}</p>
                <p className="text-xs text-gray-500">Total Stays</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center pt-6">
                <CreditCard className="h-6 w-6 text-emerald-600" />
                <p className="mt-2 text-2xl font-bold">{formatCurrency(guest.totalSpent)}</p>
                <p className="text-xs text-gray-500">Total Spent</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center pt-6">
                <Calendar className="h-6 w-6 text-emerald-600" />
                <p className="mt-2 text-2xl font-bold">{guest.lastVisit ? formatDate(guest.lastVisit) : 'N/A'}</p>
                <p className="text-xs text-gray-500">Last Visit</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="bookings">
            <TabsList>
              <TabsTrigger value="bookings">Booking History ({bookingList.length})</TabsTrigger>
              <TabsTrigger value="messages">Messages ({messages?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="bookings">
              <Card>
                <CardContent className="pt-6">
                  {bookingList.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">No bookings yet</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Booking Code</TableHead>
                          <TableHead>Room</TableHead>
                          <TableHead>Check-in</TableHead>
                          <TableHead>Check-out</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookingList.map((b: Booking) => (
                          <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/bookings/${b.id}`)}>
                            <TableCell className="font-medium">{b.bookingCode}</TableCell>
                            <TableCell>{b.room?.roomNumber}</TableCell>
                            <TableCell>{formatDate(b.checkIn)}</TableCell>
                            <TableCell>{formatDate(b.checkOut)}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(b.status)}>{b.status.replace('_', ' ')}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(b.totalAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="messages">
              <Card>
                <CardContent className="pt-6">
                  {!messages?.length ? (
                    <p className="py-8 text-center text-sm text-gray-400">No WhatsApp messages yet</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Template</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {messages.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">{m.templateKey}</TableCell>
                            <TableCell>{m.toPhone}</TableCell>
                            <TableCell><Badge>{m.status}</Badge></TableCell>
                            <TableCell className="text-xs text-gray-500">{m.error || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-600">{guest.notes || 'No notes'}</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Guest</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First Name</Label>
                <Input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Last Name</Label>
                <Input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <PhoneField value={editForm.phone} onChange={(phone) => setEditForm({ ...editForm, phone })} />
            </div>
            <div className="space-y-1">
              <Label>Email (optional)</Label>
              <Input type="text" inputMode="email" autoComplete="email" placeholder="name@email.com" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>ID Type</Label>
                <select value={editForm.idType} onChange={(e) => setEditForm({ ...editForm, idType: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Select</option>
                  <option value="AADHAAR">Aadhaar</option>
                  <option value="PAN">PAN</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="DRIVING_LICENSE">Driving License</option>
                  <option value="VOTER_ID">Voter ID</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>ID Number</Label>
                <Input value={editForm.idNumber} onChange={(e) => setEditForm({ ...editForm, idNumber: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>State</Label>
                <Input value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={handleEditSubmit} disabled={updateGuest.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              {updateGuest.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
