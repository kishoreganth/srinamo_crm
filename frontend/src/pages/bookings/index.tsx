import { useState } from 'react';
import { Plus, Search, Eye, BookOpen } from 'lucide-react';
import PageHeader from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBookings } from '@/hooks/useBookings';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { navigate } from '@/lib/navigate';

export default function BookingsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading } = useBookings({ page, status, search, from, to });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const total = data?.total ?? (data as { meta?: { total?: number } })?.meta?.total ?? 0;
  const limit = data?.limit ?? (data as { meta?: { limit?: number } })?.meta?.limit ?? 20;
  const totalPages = data ? Math.ceil(total / limit) || 1 : 1;
  const q = search.trim().toLowerCase();
  const rows = (data?.data ?? []).filter((b) => {
    if (!q) return true;
    const hay = `${b.guest?.firstName ?? ''} ${b.guest?.lastName ?? ''} ${b.bookingCode}`.toLowerCase();
    return hay.includes(q);
  });

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <PageHeader
        title="Bookings"
        description="Stays on the books. Search filters this page."
        action={<Button onClick={() => navigate('/bookings/new')}><Plus className="h-4 w-4" /> New Booking</Button>}
      />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              placeholder="Search by guest, booking code..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="CHECKED_IN">Checked In</SelectItem>
              <SelectItem value="CHECKED_OUT">Checked Out</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="NO_SHOW">No Show</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
        </div>

        {rows.length ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-sm">{b.bookingCode}</TableCell>
                    <TableCell>{b.guest?.firstName} {b.guest?.lastName}</TableCell>
                    <TableCell>{b.room?.roomNumber}</TableCell>
                    <TableCell>{formatDate(b.checkIn)}</TableCell>
                    <TableCell>{formatDate(b.checkOut)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(b.status)}>{b.status.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(b.totalAmount)}</TableCell>
                    <TableCell>
                      {(() => {
                        const paid = b.paidAmount || 0;
                        const bal = b.totalAmount - paid;
                        if (bal <= 0) return <Badge className={getStatusColor('PAID')}>Paid</Badge>;
                        if (paid > 0) return <Badge className={getStatusColor('PARTIAL')}>Partial</Badge>;
                        return <Badge className={getStatusColor('UNPAID')}>Unpaid</Badge>;
                      })()}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/bookings/${b.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState icon={BookOpen} title="No bookings found" description="Try another status or clear the search." />
        )}
      </Card>
    </div>
  );
}
