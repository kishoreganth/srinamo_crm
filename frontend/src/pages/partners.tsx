import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuthStore } from '@/stores/auth.store';
import { useCommissions, useCreatePartner, usePartners, usePayCommission } from '@/hooks/useCrm';
import { formatCurrency } from '@/lib/utils';
import type { Partner, PartnerType } from '@/types';

const TYPE_LABEL: Record<PartnerType, string> = {
  PLANNER: 'Event planner',
  CORPORATE: 'Corporate planner',
  INFLUENCER: 'Influencer / page',
  PHOTOGRAPHER: 'Photographer',
  DECORATOR: 'Decorator',
  TRAVEL: 'Travel',
  OTHER: 'Other',
};

const EMPTY_FORM = {
  name: '',
  type: 'PLANNER',
  phone: '',
  firm: '',
  location: '',
  tier: 'Chennai',
  instagram: '',
  commissionRate: '10',
};

function digits(raw?: string | null) {
  return (raw || '').replace(/\D/g, '');
}

function waNumber(raw?: string | null) {
  const d = digits(raw);
  if (!d) return '';
  if (d.length === 10) return `91${d}`;
  return d;
}

function formatPhone(raw?: string | null) {
  const n = waNumber(raw);
  if (n.length === 12 && n.startsWith('91')) return n.slice(2);
  return raw || '—';
}

function tierVariant(tier?: string) {
  if (tier === 'National') return 'warning' as const;
  if (tier === 'Local') return 'default' as const;
  return 'secondary' as const;
}

export default function PartnersPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const { data: partners, isLoading } = usePartners();
  const { data: commissions } = useCommissions();
  const createPartner = useCreatePartner();
  const pay = usePayCommission();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [form, setForm] = useState(EMPTY_FORM);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (partners || []).filter((p) => {
      if (typeFilter !== 'ALL' && p.type !== typeFilter) return false;
      if (tierFilter !== 'ALL' && (p.tier || '') !== tierFilter) return false;
      if (!q) return true;
      return [p.name, p.firm, p.phone, p.instagram, p.location, p.tier, p.notes, TYPE_LABEL[p.type] || p.type]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [partners, query, typeFilter, tierFilter]);

  if (isLoading) return <div className="p-6"><Skeleton className="h-96" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <p className="text-sm text-gray-500">
          {filtered.length} of {partners?.length || 0} partners · Due commissions: {isAdmin ? formatCurrency(commissions?.dueTotal || 0) : '—'}
        </p>
        {isAdmin && <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setForm(EMPTY_FORM); setOpen(true); }}>Add partner</Button>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search name, phone, Instagram, location" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="border rounded-md px-3 py-2 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="ALL">All categories</option>
          {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select className="border rounded-md px-3 py-2 text-sm" value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
          <option value="ALL">All tiers</option>
          <option>Local</option>
          <option>Chennai</option>
          <option>National</option>
        </select>
      </div>
      <Card className="p-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>Instagram</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Tier</TableHead>
              {isAdmin && <TableHead>Rate</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => {
              const wa = waNumber(p.phone);
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    {p.firm && p.firm !== p.name && <div className="text-xs text-gray-500">{p.firm}</div>}
                    {p.notes?.startsWith('Reached out') && <div className="text-xs text-emerald-700 mt-0.5">Ready to post · invite</div>}
                  </TableCell>
                  <TableCell>
                    {wa ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <a className="text-emerald-700 hover:underline" href={`tel:+${wa}`}>{formatPhone(p.phone)}</a>
                        <a className="text-xs text-emerald-600 hover:underline" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">WhatsApp</a>
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {p.instagram ? (
                      <a className="text-emerald-700 hover:underline" href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noreferrer">@{p.instagram}</a>
                    ) : '—'}
                  </TableCell>
                  <TableCell>{TYPE_LABEL[p.type] || p.type}</TableCell>
                  <TableCell>{p.location || '—'}</TableCell>
                  <TableCell>{p.tier ? <Badge variant={tierVariant(p.tier)}>{p.tier}</Badge> : '—'}</TableCell>
                  {isAdmin && <TableCell>{p.commissionRate}%</TableCell>}
                </TableRow>
              );
            })}
            {!filtered.length && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-sm text-gray-500">No partners match.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      {isAdmin && (
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold">Commissions</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(commissions?.data || []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.partner?.name}</TableCell>
                  <TableCell>{formatCurrency(c.amount)}</TableCell>
                  <TableCell>{c.status}</TableCell>
                  <TableCell>
                    {c.status === 'DUE' && <Button size="sm" onClick={() => pay.mutate(c.id, { onSuccess: () => toast.success('Marked paid') })}>Mark paid</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add partner</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Label>Category</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Label>Instagram</Label><Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@handle" />
            <Label>Firm</Label><Input value={form.firm} onChange={(e) => setForm({ ...form, firm: e.target.value })} />
            <Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Label>Tier</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
              <option>Local</option><option>Chennai</option><option>National</option>
            </select>
            <Label>Commission %</Label><Input value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} />
          </div>
          <DialogFooter>
            <Button onClick={() => createPartner.mutate({
              ...form,
              type: form.type as Partner['type'],
              commissionRate: Number(form.commissionRate),
            }, {
              onSuccess: () => { toast.success('Partner added'); setOpen(false); },
              onError: () => toast.error('Failed'),
            })}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
