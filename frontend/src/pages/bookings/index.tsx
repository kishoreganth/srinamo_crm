import { useEffect, useRef, useState } from 'react';
import { Plus, Search, Eye, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/page-header';
import { EmptyState, ErrorState } from '@/components/layout/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CountUp } from '@/components/motion/count-up';
import { useBookings } from '@/hooks/useBookings';
import { useBulkReview, type BulkReviewResult } from '@/hooks/useCrm';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { navigate } from '@/lib/navigate';
import { useAuthStore } from '@/stores/auth.store';

const SKIP_LABELS: Record<string, string> = {
  not_checked_out: 'not checked out',
  no_phone: 'no phone',
  no_consent: 'no consent',
  dnd: 'DND',
  already_asked: 'already asked',
  not_found: 'not found',
  error: 'could not send',
};

export default function BookingsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resend, setResend] = useState(false);
  const [summary, setSummary] = useState<BulkReviewResult[] | null>(null);
  const headerRef = useRef<HTMLInputElement>(null);
  const isAdmin = useAuthStore((s) => s.user?.role) === 'ADMIN';
  const bulkReview = useBulkReview();

  const { data, isLoading, isError, refetch } = useBookings({ page, status, search, from, to });

  useEffect(() => {
    setSelected(new Set());
    setResend(false);
  }, [page, status, search, from, to]);

  const total = data?.total ?? (data as { meta?: { total?: number } })?.meta?.total ?? 0;
  const limit = data?.limit ?? (data as { meta?: { limit?: number } })?.meta?.limit ?? 20;
  const totalPages = data ? Math.ceil(total / limit) || 1 : 1;
  const q = search.trim().toLowerCase();
  const rows = (data?.data ?? []).filter((b) => {
    if (!q) return true;
    const hay = `${b.guest?.firstName ?? ''} ${b.guest?.lastName ?? ''} ${b.bookingCode}`.toLowerCase();
    return hay.includes(q);
  });
  const selectedRows = rows.filter((b) => selected.has(b.id));
  const notCheckedOut = selectedRows.filter((b) => b.status !== 'CHECKED_OUT').length;
  const allSelected = rows.length > 0 && rows.every((b) => selected.has(b.id));

  useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = selectedRows.length > 0 && !allSelected;
  }, [selectedRows.length, allSelected]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isError) {
    return <div className="p-6"><ErrorState message="Bookings could not be loaded." onRetry={() => refetch()} /></div>;
  }

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((b) => b.id)));
  };

  const askReview = () => {
    bulkReview.mutate(
      { ids: selectedRows.map((b) => b.id), force: isAdmin && resend },
      {
        onSuccess: (result) => {
          const queued = result.results.filter((row) => row.outcome === 'queued').length;
          const skipped = result.results.length - queued;
          toast.message(`Queued ${queued}. Skipped ${skipped}.`);
          setSummary(result.results);
          setSelected(new Set());
          setResend(false);
        },
        onError: () => toast.error('Could not ask for reviews'),
      },
    );
  };

  const skippedGroups = (summary ?? [])
    .filter((row) => row.outcome === 'skipped')
    .reduce<Record<string, number>>((acc, row) => {
      const key = row.reason || 'error';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  const queuedRows = (summary ?? []).filter((row) => row.outcome === 'queued');
  const notDelivered = queuedRows.filter((row) => row.status === 'SKIPPED').length;

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
            {selectedRows.length > 0 && (
              <div className="motion-slide-down mb-4 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-3 py-2">
                <p className="text-sm font-medium text-ink"><CountUp value={selectedRows.length} /> selected</p>
                {notCheckedOut > 0 && (
                  <p id="ask-review-reason" className="text-sm text-muted">
                    {notCheckedOut} selected booking{notCheckedOut === 1 ? ' is' : 's are'} not checked out
                  </p>
                )}
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <Switch id="resend-asked" checked={resend} onCheckedChange={setResend} />
                    <Label htmlFor="resend-asked">Resend even if already asked</Label>
                  </div>
                )}
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => { setSelected(new Set()); setResend(false); }}>
                    Clear
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={notCheckedOut > 0 || bulkReview.isPending}
                    aria-describedby={notCheckedOut > 0 ? 'ask-review-reason' : undefined}
                    onClick={askReview}
                  >
                    Ask Review
                  </Button>
                </div>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      ref={headerRef}
                      type="checkbox"
                      className="h-4 w-4 accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all on this page"
                    />
                  </TableHead>
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
                  <TableRow key={b.id} data-state={selected.has(b.id) ? 'selected' : undefined}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        checked={selected.has(b.id)}
                        onChange={() => toggleRow(b.id)}
                        aria-label={`Select ${b.bookingCode}`}
                      />
                    </TableCell>
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

      <Dialog open={summary !== null} onOpenChange={(open) => { if (!open) setSummary(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ask Review</DialogTitle>
            <DialogDescription>
              {queuedRows.length} queued. {(summary?.length ?? 0) - queuedRows.length} skipped.
              {notDelivered > 0 ? ' Saved in the system. WhatsApp is off, so these were not delivered.' : ''}
            </DialogDescription>
          </DialogHeader>
          {Object.keys(skippedGroups).length > 0 && (
            <ul className="space-y-1 text-sm text-ink">
              {Object.entries(skippedGroups).map(([reason, count]) => (
                <li key={reason}>{count} {SKIP_LABELS[reason] || reason}</li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setSummary(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
