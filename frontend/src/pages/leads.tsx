import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useCreateLead, useLeadAction, useLeadBoard, usePartners } from '@/hooks/useCrm';
import { useAvailableRooms } from '@/hooks/useRooms';
import type { Lead, LeadStage } from '@/types';
import { formatCurrency } from '@/lib/utils';

const STAGES: LeadStage[] = ['NEW', 'CONTACTED', 'QUOTED', 'HOLD', 'WON', 'LOST'];

export default function LeadsPage() {
  const { data, isLoading } = useLeadBoard();
  const createLead = useCreateLead();
  const action = useLeadAction();
  const { data: partners } = usePartners();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', occasion: 'STAY', source: 'PHONE', expectedValue: '', partnerId: '', notes: '' });
  const [convertLead, setConvertLead] = useState<Lead | NoneLead>(null);
  const [lostLead, setLostLead] = useState<Lead | NoneLead>(null);
  const [lostReason, setLostReason] = useState('');
  const [convert, setConvert] = useState({ roomId: '', checkIn: '', checkOut: '', adults: '2' });
  const { data: rooms } = useAvailableRooms(convert.checkIn, convert.checkOut);

  if (isLoading) return <div className="p-6"><Skeleton className="h-96" /></div>;

  const saveLead = async () => {
    try {
      await createLead.mutateAsync({
        name: form.name,
        phone: form.phone,
        occasion: form.occasion as Lead['occasion'],
        source: form.source as Lead['source'],
        expectedValue: form.expectedValue ? Number(form.expectedValue) : undefined,
        partnerId: form.partnerId || undefined,
        notes: form.notes,
      });
      toast.success('Lead created');
      setShowNew(false);
    } catch {
      toast.error('Could not create lead');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{data?.dueToday?.length || 0} follow-ups due</p>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowNew(true)}>New lead</Button>
      </div>
      {!!data?.dueToday?.length && (
        <Card className="p-3 text-sm">Due today: {data.dueToday.map((l) => l.name).join(', ')}</Card>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {STAGES.map((stage) => (
          <div key={stage} className="rounded-lg border bg-white p-2 min-h-[320px]">
            <p className="text-xs font-semibold text-gray-500 mb-2">{stage} ({data?.board?.[stage]?.length || 0})</p>
            <div className="space-y-2">
              {(data?.board?.[stage] || []).map((lead) => (
                <Card key={lead.id} className="p-3 space-y-2">
                  <p className="font-medium text-sm">{lead.name}</p>
                  <p className="text-xs text-gray-500">{lead.phone} · {lead.occasion}</p>
                  {lead.expectedValue != null && <p className="text-xs">{formatCurrency(lead.expectedValue)}</p>}
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => action.mutate({ id: lead.id, action: 'send-quote' }, { onSuccess: () => toast.success('Quote queued'), onError: () => toast.error('Send failed') })}>Quote</Button>
                    <Button size="sm" variant="outline" onClick={() => action.mutate({ id: lead.id, action: 'log-call', body: { notes: 'Called', stage: 'CONTACTED' } })}>Log call</Button>
                    {stage !== 'WON' && stage !== 'LOST' && (
                      <>
                        <Button size="sm" onClick={() => setConvertLead(lead)}>Book</Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          const d = window.prompt('Event date (YYYY-MM-DD)');
                          if (!d) return;
                          action.mutate({ id: lead.id, action: 'convert-event', body: { eventDate: d, venue: 'LAWN', pax: 80 } }, { onSuccess: () => toast.success('Event created'), onError: () => toast.error('Convert failed') });
                        }}>Event</Button>
                        <Button size="sm" variant="ghost" onClick={() => setLostLead(lead)}>Lost</Button>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>New lead</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Label>Occasion</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.occasion} onChange={(e) => setForm({ ...form, occasion: e.target.value })}>
              <option>STAY</option><option>BIRTHDAY</option><option>WEDDING</option><option>CORPORATE</option><option>OTHER</option>
            </select>
            <Label>Expected value</Label><Input value={form.expectedValue} onChange={(e) => setForm({ ...form, expectedValue: e.target.value })} />
            <Label>Partner</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })}>
              <option value="">None</option>
              {(partners || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={saveLead}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!convertLead} onOpenChange={() => setConvertLead(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convert to booking</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Check-in</Label><Input type="date" value={convert.checkIn} onChange={(e) => setConvert({ ...convert, checkIn: e.target.value })} />
            <Label>Check-out</Label><Input type="date" value={convert.checkOut} onChange={(e) => setConvert({ ...convert, checkOut: e.target.value })} />
            <Label>Room</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" value={convert.roomId} onChange={(e) => setConvert({ ...convert, roomId: e.target.value })}>
              <option value="">Select</option>
              {(rooms || []).map((r) => <option key={r.id} value={r.id}>{r.roomNumber} · {r.roomType?.name}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertLead(null)}>Cancel</Button>
            <Button onClick={() => convertLead && action.mutate({
              id: convertLead.id,
              action: 'convert-booking',
              body: { roomId: convert.roomId, checkIn: convert.checkIn, checkOut: convert.checkOut, adults: Number(convert.adults) },
            }, { onSuccess: () => { toast.success('Booking created'); setConvertLead(null); }, onError: () => toast.error('Convert failed') })}>Convert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lostLead} onOpenChange={() => setLostLead(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark lost</DialogTitle></DialogHeader>
          <Input placeholder="Reason" value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
          <DialogFooter>
            <Button onClick={() => lostLead && action.mutate({ id: lostLead.id, action: 'lost', body: { lostReason } }, { onSuccess: () => { toast.success('Marked lost'); setLostLead(null); } })}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type NoneLead = Lead | null;
