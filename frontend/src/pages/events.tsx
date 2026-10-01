import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCreateEvent, useEvents, useHoldEventRooms, usePartners } from '@/hooks/useCrm';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { EventDeal } from '@/types';

export default function EventsPage() {
  const { data, isLoading } = useEvents();
  const createEvent = useCreateEvent();
  const hold = useHoldEventRooms();
  const { data: partners } = usePartners();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'WEDDING', eventDate: '', venue: 'LAWN', pax: '80', quotedAmount: '', partnerId: '', exclusiveBuyout: false });

  if (isLoading) return <div className="p-6"><Skeleton className="h-96" /></div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-end">
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpen(true)}>New event</Button>
      </div>
      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Pax</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Quote</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data || []).map((e) => (
              <TableRow key={e.id}>
                <TableCell>{formatDate(e.eventDate)}</TableCell>
                <TableCell>{e.type}</TableCell>
                <TableCell>{e.venue}</TableCell>
                <TableCell>{e.pax}</TableCell>
                <TableCell>{e.status}</TableCell>
                <TableCell>{e.quotedAmount != null ? formatCurrency(e.quotedAmount) : '—'}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => hold.mutate({ id: e.id, exclusive: e.exclusiveBuyout, nights: 1 }, { onSuccess: () => toast.success('Rooms held'), onError: () => toast.error('Hold failed') })}>
                    Hold rooms
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New event</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Type</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option>WEDDING</option><option>BIRTHDAY</option><option>CORPORATE</option><option>OTHER</option>
            </select>
            <Label>Date</Label><Input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
            <Label>Venue</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })}>
              <option>LAWN</option><option>ROOFTOP</option><option>POOL</option><option>OTHER</option>
            </select>
            <Label>Pax</Label><Input value={form.pax} onChange={(e) => setForm({ ...form, pax: e.target.value })} />
            <Label>Quote</Label><Input value={form.quotedAmount} onChange={(e) => setForm({ ...form, quotedAmount: e.target.value })} />
            <Label>Partner</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })}>
              <option value="">None</option>
              {(partners || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.exclusiveBuyout} onChange={(e) => setForm({ ...form, exclusiveBuyout: e.target.checked })} />
              Exclusive buyout
            </label>
          </div>
          <DialogFooter>
            <Button onClick={() => createEvent.mutate({
              type: form.type as EventDeal['type'],
              eventDate: form.eventDate,
              venue: form.venue as EventDeal['venue'],
              pax: Number(form.pax),
              quotedAmount: form.quotedAmount ? Number(form.quotedAmount) : undefined,
              partnerId: form.partnerId || undefined,
              exclusiveBuyout: form.exclusiveBuyout,
            }, { onSuccess: () => { toast.success('Event saved'); setOpen(false); }, onError: () => toast.error('Failed') })}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
