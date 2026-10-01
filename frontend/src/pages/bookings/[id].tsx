import { useState } from 'react';
import { toast } from 'sonner';
import { navigate } from '@/lib/navigate';
import { useBooking, useUpdateBookingStatus, useCancelBooking } from '@/hooks/useBookings';
import { useFolioItems, usePayments, useAddFolioItem, useRecordPayment } from '@/hooks/useBilling';
import { formatCurrency, formatDate, formatDateTime, getStatusColor, getDaysBetween } from '@/lib/utils';
import { displayPhone } from '@/lib/country-codes';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, User, BedDouble, Calendar, CreditCard, Plus, Loader2, LogIn, LogOut as LogOutIcon, X as XIcon, Users, Upload, AlertTriangle,
} from 'lucide-react';
import type { FolioCategory, PaymentMethod } from '@/types';
import api from '@/lib/api';
import { useMessages, useSendAction } from '@/hooks/useCrm';

interface Props {
  bookingId: string;
}

export default function BookingDetailPage({ bookingId }: Props) {
  const { data: booking, isLoading } = useBooking(bookingId);
  const { data: folioItems } = useFolioItems(bookingId);
  const { data: payments } = usePayments(bookingId);
  const updateStatus = useUpdateBookingStatus();
  const cancelBooking = useCancelBooking();
  const addFolio = useAddFolioItem();
  const recordPayment = useRecordPayment();
  const sendAction = useSendAction();
  const { data: messages } = useMessages('BOOKING', bookingId);

  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCheckoutWarning, setShowCheckoutWarning] = useState(false);
  const [checkInAdults, setCheckInAdults] = useState(1);
  const [checkInChildren, setCheckInChildren] = useState(0);
  const [primaryIdFile, setPrimaryIdFile] = useState<File | null>(null);
  const [companions, setCompanions] = useState<{ name: string; file: File | null }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeCategory, setChargeCategory] = useState<FolioCategory>('EXTRA');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentRef, setPaymentRef] = useState('');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg text-gray-500">Booking not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/bookings')}>
          Back to Bookings
        </Button>
      </div>
    );
  }

  const nights = getDaysBetween(booking.checkIn, booking.checkOut);
  const paid = booking.paidAmount || 0;
  const balance = booking.totalAmount - paid;

  const handleCheckInClick = () => {
    setCheckInAdults(booking.adults || 1);
    setCheckInChildren(booking.children || 0);
    setPrimaryIdFile(null);
    setCompanions([]);
    setShowCheckIn(true);
  };

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/upload/id-document', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.url;
  };

  const handleCheckInSubmit = async () => {
    if (!primaryIdFile) {
      toast.error('Please upload primary guest ID proof');
      return;
    }
    setUploading(true);
    try {
      const primaryUrl = await uploadFile(primaryIdFile);
      const companionData: { guestName: string; idDocumentUrl?: string }[] = [];
      for (const comp of companions) {
        if (comp.name.trim()) {
          let url: string | undefined;
          if (comp.file) url = await uploadFile(comp.file);
          companionData.push({ guestName: comp.name.trim(), idDocumentUrl: url });
        }
      }
      updateStatus.mutate(
        {
          id: bookingId,
          status: 'CHECKED_IN',
          actualAdults: checkInAdults,
          actualChildren: checkInChildren,
          primaryIdDocumentUrl: primaryUrl,
          companions: companionData.length > 0 ? companionData : undefined,
        },
        {
          onSuccess: () => {
            toast.success('Guest checked in successfully');
            setShowCheckIn(false);
          },
          onError: () => toast.error('Failed to check in'),
        }
      );
    } catch {
      toast.error('Failed to upload documents');
    } finally {
      setUploading(false);
    }
  };

  const handleCheckOut = () => {
    if (balance > 0) {
      setShowCheckoutWarning(true);
    } else {
      performCheckout();
    }
  };

  const performCheckout = () => {
    setShowCheckoutWarning(false);
    updateStatus.mutate(
      { id: bookingId, status: 'CHECKED_OUT' },
      {
        onSuccess: () => toast.success('Guest checked out'),
        onError: () => toast.error('Failed to check out'),
      }
    );
  };

  const addCompanion = () => setCompanions([...companions, { name: '', file: null }]);
  const removeCompanion = (i: number) => setCompanions(companions.filter((_, idx) => idx !== i));
  const updateCompanionName = (i: number, name: string) => {
    const updated = [...companions];
    updated[i] = { ...updated[i], name };
    setCompanions(updated);
  };
  const updateCompanionFile = (i: number, file: File | null) => {
    const updated = [...companions];
    updated[i] = { ...updated[i], file };
    setCompanions(updated);
  };

  const handleCancel = () => {
    cancelBooking.mutate(bookingId, {
      onSuccess: () => toast.success('Booking cancelled'),
      onError: () => toast.error('Failed to cancel'),
    });
  };

  const handleAddCharge = () => {
    if (!chargeDesc || !chargeAmount) return;
    addFolio.mutate(
      { bookingId, description: chargeDesc, category: chargeCategory, amount: parseFloat(chargeAmount) },
      {
        onSuccess: () => {
          toast.success('Charge added');
          setShowAddCharge(false);
          setChargeDesc('');
          setChargeAmount('');
        },
        onError: () => toast.error('Failed to add charge'),
      }
    );
  };

  const handleRecordPayment = () => {
    if (!paymentAmount) return;
    recordPayment.mutate(
      { bookingId, amount: parseFloat(paymentAmount), method: paymentMethod, transactionId: paymentRef || undefined },
      {
        onSuccess: () => {
          toast.success('Payment recorded');
          setShowPayment(false);
          setPaymentAmount('');
          setPaymentRef('');
        },
        onError: () => toast.error('Failed to record payment'),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/bookings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold">{booking.bookingCode}</h2>
            <Badge className={getStatusColor(booking.status)}>{booking.status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {booking.status === 'CONFIRMED' && (
            <Button onClick={handleCheckInClick} disabled={updateStatus.isPending}>
              <LogIn className="h-4 w-4 mr-1" />
              Check In
            </Button>
          )}
          {booking.status === 'CHECKED_IN' && (
            <Button onClick={handleCheckOut} disabled={updateStatus.isPending}>
              <LogOutIcon className="h-4 w-4 mr-1" />
              Check Out
            </Button>
          )}
          {(booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN') && (
            <Button variant="destructive" onClick={handleCancel} disabled={cancelBooking.isPending}>
              <XIcon className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['confirmation', 'Send confirmation'],
          ['pre-arrival', 'Pre-arrival'],
          ['payment-reminder', 'Payment reminder'],
          ['review', 'Ask review'],
          ['upsell', 'In-stay upsell'],
        ].map(([path, label]) => (
          <Button
            key={path}
            size="sm"
            variant="outline"
            disabled={!booking.guest?.phone || booking.guest?.whatsappConsent === false}
            onClick={() => sendAction.mutate(
              { path: `/actions/bookings/${bookingId}/${path}` },
              {
                onSuccess: (result: { message?: { status?: string } }) => {
                  if (result?.message?.status === 'SKIPPED') toast.message('Saved. WhatsApp is not connected, so it was not sent.');
                  else toast.success(`${label} queued`);
                },
                onError: () => toast.error('Could not send that message'),
              },
            )}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Guest</p>
              <p className="font-medium">{booking.guest?.firstName} {booking.guest?.lastName}</p>
              <p className="text-sm text-gray-500">{booking.guest?.phone ? displayPhone(booking.guest.phone) : ''}</p>
              <p className="text-sm text-gray-500">{booking.guest?.email}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <BedDouble className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Rooms</p>
              <p className="font-medium">
                {(booking.rooms?.length ? booking.rooms : booking.room ? [booking.room] : [])
                  .map((room) => room.roomNumber)
                  .join(', ') || '-'}
              </p>
              {booking.amenities && booking.amenities.length > 0 && (
                <p className="text-sm text-gray-500">Amenities: {booking.amenities.map((item) => item.name).join(', ')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Stay</p>
              <p className="font-medium">{formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}</p>
              {booking.package && (
                <p className="text-sm text-gray-500">
                  {booking.package.startsAt}–{booking.package.endsAt} · {formatCurrency(Number(booking.package.pricePerPerson))} per person
                </p>
              )}
              <p className="text-sm text-gray-500">
                {booking.package
                  ? 'Day package'
                  : formatDate(booking.checkIn) === formatDate(booking.checkOut)
                    ? 'Day visit'
                    : `${nights} night${nights > 1 ? 's' : ''}`}
                {' · '}{booking.adults + booking.children} people
                {booking.children > 0 ? ` · ${booking.adults} paying · ${booking.children} under 5` : ''}
              </p>
              {booking.bookingGuests && booking.bookingGuests.length > 0 && (
                <p className="text-sm text-gray-500">Also: {booking.bookingGuests.map((bg) => bg.guestName).join(', ')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {booking.status !== 'CONFIRMED' && (booking.actualAdults != null || (booking.bookingGuests && booking.bookingGuests.length > 0)) && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold">Guest Details at Check-In</h3>
            </div>
            <div className="flex gap-6 text-sm mb-3">
              <span>Adults: <strong>{booking.actualAdults ?? booking.adults}</strong></span>
              <span>Children: <strong>{booking.actualChildren ?? booking.children}</strong></span>
              <span>Total: <strong>{(booking.actualAdults ?? booking.adults) + (booking.actualChildren ?? booking.children)}</strong></span>
            </div>
            {booking.guest?.idDocumentUrl && (
              <div className="text-sm mb-2">
                <span className="text-gray-500">Primary ID: </span>
                <a href={booking.guest.idDocumentUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">View Document</a>
              </div>
            )}
            {booking.bookingGuests && booking.bookingGuests.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Additional Guests</p>
                <div className="space-y-1">
                  {booking.bookingGuests.map((bg: any) => (
                    <div key={bg.id} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-1.5">
                      <span>{bg.guestName}</span>
                      {bg.idDocumentUrl && (
                        <a href={bg.idDocumentUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline text-xs">View ID</a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex gap-8">
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-lg font-bold">{formatCurrency(booking.totalAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Paid</p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(paid)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Balance</p>
              <p className={`text-lg font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {formatCurrency(balance)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddCharge(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Charge
            </Button>
            <Button size="sm" onClick={() => setShowPayment(true)}>
              <CreditCard className="h-4 w-4 mr-1" />
              Record Payment
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/billing/${bookingId}`)}>
              View Full Billing
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="folio">
        <TabsList>
          <TabsTrigger value="folio">Folio ({folioItems?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="messages">Messages ({messages?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="folio">
          <Card>
            <CardContent className="pt-6">
              {!folioItems || folioItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No charges yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {folioItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.category.charAt(0) + item.category.slice(1).toLowerCase()}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(item.createdAt)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent className="pt-6">
              {!payments || payments.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No payments yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDateTime(p.paidAt || p.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{p.method}</Badge>
                        </TableCell>
                        <TableCell>{p.transactionId || '-'}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">
                          {formatCurrency(p.amount)}
                        </TableCell>
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
                <p className="py-8 text-center text-sm text-gray-400">No messages yet. Use the buttons above.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.templateKey}</TableCell>
                        <TableCell>{m.toPhone}</TableCell>
                        <TableCell>{m.status}{m.error ? ` · ${m.error}` : ''}</TableCell>
                        <TableCell>{formatDateTime(m.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddCharge} onOpenChange={setShowAddCharge}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Charge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={chargeDesc} onChange={(e) => setChargeDesc(e.target.value)} placeholder="e.g. Extra bed" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={chargeCategory} onValueChange={(v) => setChargeCategory(v as FolioCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROOM">Room</SelectItem>
                  <SelectItem value="FOOD">Food</SelectItem>
                  <SelectItem value="ACTIVITY">Activity</SelectItem>
                  <SelectItem value="EXTRA">Extra</SelectItem>
                  <SelectItem value="TAX">Tax</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (INR)</Label>
              <Input type="number" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCharge(false)}>Cancel</Button>
            <Button onClick={handleAddCharge} disabled={addFolio.isPending}>
              {addFolio.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Charge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (INR)</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder={balance.toString()}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference (optional)</Label>
              <Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="Transaction ID" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={recordPayment.isPending}>
              {recordPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCheckIn} onOpenChange={setShowCheckIn}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Check In &mdash; {booking.bookingCode}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Adults</Label>
                <Input type="number" min={1} value={checkInAdults} onChange={(e) => setCheckInAdults(parseInt(e.target.value) || 1)} />
              </div>
              <div className="space-y-2">
                <Label>Children</Label>
                <Input type="number" min={0} value={checkInChildren} onChange={(e) => setCheckInChildren(parseInt(e.target.value) || 0)} />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Upload className="h-4 w-4" /> Primary Guest ID Proof <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-gray-500">{booking.guest?.firstName} {booking.guest?.lastName} &mdash; Aadhaar / PAN / Passport / DL / Voter ID</p>
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setPrimaryIdFile(e.target.files?.[0] || null)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Additional Guests (Optional)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addCompanion}>
                  <Plus className="h-3 w-3 mr-1" /> Add Guest
                </Button>
              </div>
              {companions.map((comp, i) => (
                <div key={i} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 space-y-2">
                    <Input placeholder="Guest name" value={comp.name} onChange={(e) => updateCompanionName(i, e.target.value)} />
                    <Input type="file" accept="image/*,.pdf" onChange={(e) => updateCompanionFile(i, e.target.files?.[0] || null)} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeCompanion(i)}>
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckIn(false)}>Cancel</Button>
            <Button onClick={handleCheckInSubmit} disabled={uploading || updateStatus.isPending || !primaryIdFile}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Uploading...</> : 'Complete Check-In'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCheckoutWarning} onOpenChange={setShowCheckoutWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Outstanding Balance
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            This booking has an outstanding balance of <strong className="text-red-600">{formatCurrency(balance)}</strong>.
          </p>
          <p className="text-sm text-gray-500">Would you like to settle the balance or proceed with checkout?</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCheckoutWarning(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => { setShowCheckoutWarning(false); setShowPayment(true); }}>
              <CreditCard className="h-4 w-4 mr-1" /> Settle Balance
            </Button>
            <Button onClick={performCheckout} disabled={updateStatus.isPending}>
              Proceed Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
