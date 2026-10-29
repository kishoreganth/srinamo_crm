import { useState } from 'react';
import { Phone, Plus } from 'lucide-react';
import PageHeader from '@/components/layout/page-header';
import { EmptyState, ErrorState } from '@/components/layout/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEnquiries } from '@/hooks/useEnquiries';
import { displayPhone } from '@/lib/country-codes';
import { navigate } from '@/lib/navigate';
import { formatDateTime, getStatusColor } from '@/lib/utils';
import { ENQUIRY_SOURCES, ENQUIRY_STATUSES, labelOf } from './form';

export default function EnquiriesPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [source, setSource] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [due, setDue] = useState(false);
  const { data, isLoading, isError, refetch } = useEnquiries({ page, q, status, source, from, to, due });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isError) {
    return <div className="p-4 sm:p-6"><ErrorState message="Could not load enquiries." onRetry={() => refetch()} /></div>;
  }

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <PageHeader
        title="Enquiry"
        description="Calls and follow-ups. Both reception and admin can see this list."
        action={<Button onClick={() => navigate('/enquiries/new')}><Plus className="h-4 w-4" /> New enquiry</Button>}
      />
      <Card className="p-4">
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            className="min-w-[200px] flex-1"
            placeholder="Search name or phone"
            value={q}
            aria-label="Search enquiries"
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
          <select aria-label="Status" className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="ALL">All statuses</option>
            {ENQUIRY_STATUSES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select aria-label="Source" className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink" value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}>
            <option value="ALL">All sources</option>
            {ENQUIRY_SOURCES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <Input type="date" aria-label="From" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-[150px]" />
          <Input type="date" aria-label="To" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-[150px]" />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={due} onChange={(e) => { setDue(e.target.checked); setPage(1); }} />
            Follow-up due
          </label>
        </div>
        {rows.length ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Caller</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Call</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Follow-up</TableHead>
                  <TableHead>Staff</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => navigate(`/enquiries/${row.id}`)}>
                    <TableCell className="font-medium">{row.callerName}</TableCell>
                    <TableCell>{displayPhone(row.phone)}</TableCell>
                    <TableCell>{labelOf([
                      ['ROOM_STAY', 'Room stay'],
                      ['DAY_OUTING', 'Day outing'],
                      ['EVENT', 'Event'],
                      ['RESTAURANT', 'Restaurant'],
                      ['ACTIVITY', 'Activity'],
                      ['OTHER', 'Other'],
                    ], row.enquiryType)}</TableCell>
                    <TableCell>{labelOf(ENQUIRY_SOURCES, row.source)}</TableCell>
                    <TableCell>{row.callAt ? formatDateTime(row.callAt) : ''}</TableCell>
                    <TableCell><Badge className={getStatusColor(row.status)}>{labelOf(ENQUIRY_STATUSES, row.status)}</Badge></TableCell>
                    <TableCell>{row.nextFollowUpAt ? row.nextFollowUpAt.slice(0, 10) : ''}</TableCell>
                    <TableCell>{row.takenBy?.name || ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted">Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState icon={Phone} title="No enquiries" description="Record a call when someone phones the resort." />
        )}
      </Card>
    </div>
  );
}
