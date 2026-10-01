import { useState } from 'react';
import { toast } from 'sonner';
import { useBooking } from '@/hooks/useBookings';
import {
  useFolio, usePayments,
  useAddFolioItem, useRecordPayment, useGenerateInvoice,
} from '@/hooks/useBilling';
import { formatCurrency, formatDate, formatDateTime, getStatusColor, getDaysBetween } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { navigate } from '@/lib/navigate';
import {
  ArrowLeft, Plus, CreditCard, FileText, Download, Loader2, Receipt,
} from 'lucide-react';
import type { FolioCategory, PaymentMethod, InvoiceType } from '@/types';

interface Props {
  bookingId?: string;
}

export default function BillingPage({ bookingId }: Props) {
  const { data: booking, isLoading: bookingLoading } = useBooking(bookingId ?? '');
  const { data: folioItems } = useFolio(bookingId ?? '');
  const { data: payments } = usePayments(bookingId ?? '');
  const addFolio = useAddFolioItem();
  const recordPayment = useRecordPayment();
  const generateInvoice = useGenerateInvoice();

  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeCategory, setChargeCategory] = useState<FolioCategory>('EXTRA');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentRef, setPaymentRef] = useState('');

  if (!bookingId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Receipt className="h-12 w-12 text-gray-300" />
        <p className="mt-4 text-lg text-gray-500">Select a booking to view billing</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/bookings')}>
          Go to Bookings
        </Button>
      </div>
    );
  }

  if (bookingLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
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

  const folioByCategory = (folioItems ?? []).reduce<Record<string, typeof folioItems>>((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat]!.push(item);
    return acc;
  }, {});

  const subtotal = (folioItems ?? []).reduce((sum, i) => sum + i.amount, 0);
  const taxItems = (folioItems ?? []).filter((i) => i.category === 'TAX');
  const taxTotal = taxItems.reduce((sum, i) => sum + i.amount, 0);
  const total = booking.totalAmount;
  const paid = booking.paidAmount;
  const balance = total - paid;

  const handleAddCharge = () => {
    if (!chargeDesc || !chargeAmount) return;
    addFolio.mutate(
      { bookingId: bookingId!, description: chargeDesc, category: chargeCategory, amount: parseFloat(chargeAmount) },
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
      { bookingId: bookingId!, amount: parseFloat(paymentAmount), method: paymentMethod, reference: paymentRef },
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

  const handleGenerateInvoice = (type: InvoiceType) => {
    generateInvoice.mutate(
      { bookingId: bookingId!, type },
      {
        onSuccess: () => toast.success(`${type} invoice generated`),
        onError: () => toast.error('Failed to generate invoice'),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(`/bookings/${bookingId}`)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Booking
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleGenerateInvoice('SIMPLE')} disabled={generateInvoice.isPending}>
            <FileText className="h-4 w-4 mr-1" />
            Simple Invoice
          </Button>
          <Button variant="outline" onClick={() => handleGenerateInvoice('GST')} disabled={generateInvoice.isPending}>
            <FileText className="h-4 w-4 mr-1" />
            GST Invoice
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-xl border bg-white p-4">
        <div>
          <p className="text-sm text-gray-500">Booking</p>
          <p className="font-bold">{booking.bookingCode}</p>
        </div>
        <Separator orientation="vertical" className="h-10" />
        <div>
          <p className="text-sm text-gray-500">Guest</p>
          <p className="font-medium">{booking.guest?.firstName} {booking.guest?.lastName}</p>
        </div>
        <Separator orientation="vertical" className="h-10" />
        <div>
          <p className="text-sm text-gray-500">Room</p>
          <p className="font-medium">{booking.room?.roomNumber}</p>
        </div>
        <Separator orientation="vertical" className="h-10" />
        <div>
          <p className="text-sm text-gray-500">Stay</p>
          <p className="font-medium">{formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Folio Items</CardTitle>
                <Button size="sm" onClick={() => setShowAddCharge(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Charge
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {Object.entries(folioByCategory).map(([category, items]) => (
                <div key={category} className="mb-4">
                  <h4 className="mb-2 text-sm font-semibold text-gray-600">{category}</h4>
                  <Table>
                    <TableBody>
                      {items!.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{formatDate(item.date)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
              {(!folioItems || folioItems.length === 0) && (
                <p className="py-6 text-center text-sm text-gray-400">No charges</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Payment History</CardTitle>
                <Button size="sm" onClick={() => setShowPayment(true)}>
                  <CreditCard className="h-4 w-4 mr-1" />
                  Record Payment
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!payments || payments.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">No payments</p>
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
                        <TableCell>{formatDateTime(p.date)}</TableCell>
                        <TableCell><Badge variant="secondary">{p.method}</Badge></TableCell>
                        <TableCell>{p.reference || '-'}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">{formatCurrency(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="py-4 text-center text-sm text-gray-400">
                Generate an invoice using the buttons above
              </p>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="text-base">Billing Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatCurrency(subtotal - taxTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">GST / Taxes</span>
                <span>{formatCurrency(taxTotal)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Paid</span>
                <span>{formatCurrency(paid)}</span>
              </div>
              <Separator />
              <div className={`flex justify-between text-lg font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                <span>Balance Due</span>
                <span>{formatCurrency(balance)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showAddCharge} onOpenChange={setShowAddCharge}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Charge</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={chargeDesc} onChange={(e) => setChargeDesc(e.target.value)} />
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
              {addFolio.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (INR)</Label>
              <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
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
              <Label>Reference</Label>
              <Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={recordPayment.isPending}>
              {recordPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
