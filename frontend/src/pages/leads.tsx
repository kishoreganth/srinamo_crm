import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Target } from 'lucide-react';
import PageHeader from '@/components/layout/page-header';
import { EmptyState, ErrorState } from '@/components/layout/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/motion/confirm-dialog';
import { CountUp } from '@/components/motion/count-up';
import api from '@/lib/api';
import { useAvailableRooms } from '@/hooks/useRooms';
import {
  useBulkLeads,
  useCreateLead,
  useLeadAction,
  useLeadBoard,
  useLeadList,
  useLeadViews,
  usePartners,
  type BulkLeadResult,
  type LeadList,
} from '@/hooks/useCrm';
import type { Lead, LeadStage } from '@/types';
import { cn, formatCurrency, formatDate, getStatusColor } from '@/lib/utils';

const STAGES: LeadStage[] = ['NEW', 'CONTACTED', 'QUOTED', 'HOLD', 'WON', 'LOST'];
const SOURCES = ['WALK_IN', 'PHONE', 'ONLINE', 'OTA', 'WHATSAPP', 'REFERRAL', 'PARTNER', 'IMPORT'] as const;
const OCCASIONS = ['STAY', 'BIRTHDAY', 'WEDDING', 'CORPORATE', 'OTHER'] as const;
const STAGE_LABEL: Record<LeadStage, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUOTED: 'Quoted',
  HOLD: 'Hold',
  WON: 'Won',
  LOST: 'Lost',
};
const STAGE_HELP: Record<LeadStage, string> = {
  NEW: 'Not contacted yet',
  CONTACTED: 'Someone has spoken to them',
  QUOTED: 'A price was sent',
  HOLD: 'Waiting on the guest',
  WON: 'They booked, or an event was created',
  LOST: 'They will not go ahead',
};
const PRESETS = [
  { id: 'followUpToday', label: 'Follow-up today', count: 'followUpToday' },
  { id: 'overdue', label: 'Overdue', count: 'overdue' },
  { id: 'new', label: 'New (not contacted)', count: 'newUncontacted' },
  { id: 'mine', label: 'My leads', count: 'mine' },
  { id: 'highValue', label: 'High value', count: 'highValue' },
  { id: 'wonThisMonth', label: 'Won this month', count: 'wonThisMonth' },
] as const;

type Filters = {
  view: 'board' | 'list';
  q: string;
  stage: string;
  source: string;
  occasion: string;
  ownerUserId: string;
  partnerId: string;
  followUp: string;
  createdFrom: string;
  createdTo: string;
  minValue: string;
  maxValue: string;
  preset: string;
  sort: string;
  page: number;
};

const VIEW_KEY = 'leads-view';

function readFilters(): Filters {
  const params = new URLSearchParams(window.location.search);
  const stored = localStorage.getItem(VIEW_KEY);
  const fromUrl = params.get('view');
  const view = fromUrl === 'list' || fromUrl === 'board' ? fromUrl : stored === 'list' ? 'list' : 'board';
  return {
    view,
    q: params.get('q') || '',
    stage: params.get('stage') || '',
    source: params.get('source') || '',
    occasion: params.get('occasion') || '',
    ownerUserId: params.get('ownerUserId') || '',
    partnerId: params.get('partnerId') || '',
    followUp: params.get('followUp') || '',
    createdFrom: params.get('createdFrom') || '',
    createdTo: params.get('createdTo') || '',
    minValue: params.get('minValue') || '',
    maxValue: params.get('maxValue') || '',
    preset: params.get('preset') || '',
    sort: params.get('sort') || '',
    page: Math.max(1, Number(params.get('page') || '1') || 1),
  };
}

function blankFilters(view: Filters['view']): Filters {
  return {
    view, q: '', stage: '', source: '', occasion: '', ownerUserId: '', partnerId: '',
    followUp: '', createdFrom: '', createdTo: '', minValue: '', maxValue: '', preset: '', sort: '', page: 1,
  };
}

function istDay(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

function followState(lead: Lead): 'overdue' | 'today' | 'later' | 'none' {
  if (!lead.nextFollowUpAt) return 'none';
  if (lead.stage === 'WON' || lead.stage === 'LOST') return 'later';
  const day = istDay(lead.nextFollowUpAt);
  const today = istDay(new Date().toISOString());
  if (day < today) return 'overdue';
  if (day === today) return 'today';
  return 'later';
}

function followText(lead: Lead) {
  const state = followState(lead);
  if (state === 'overdue') return 'Overdue';
  if (state === 'today') return 'Today';
  if (state === 'none') return 'No follow-up';
  return formatDate(lead.nextFollowUpAt || '');
}

export default function LeadsPage() {
  const [filters, setFilters] = useState(readFilters);
  const [searchText, setSearchText] = useState(filters.q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileStage, setMobileStage] = useState<LeadStage>('NEW');
  const [closedOpen, setClosedOpen] = useState<Record<string, boolean>>({});
  const [more, setMore] = useState<Record<string, Lead[]>>({});
  const [loadingMore, setLoadingMore] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', occasion: 'STAY', source: 'PHONE', expectedValue: '', partnerId: '', notes: '' });
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [lostReason, setLostReason] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [convert, setConvert] = useState({ roomId: '', checkIn: '', checkOut: '', adults: '2' });
  const [bulkStage, setBulkStage] = useState<LeadStage>('CONTACTED');
  const [bulkOwner, setBulkOwner] = useState('');
  const [confirmStage, setConfirmStage] = useState(false);
  const [confirmOwner, setConfirmOwner] = useState(false);
  const [bulkLostOpen, setBulkLostOpen] = useState(false);
  const [bulkReason, setBulkReason] = useState('');
  const [summary, setSummary] = useState<BulkLeadResult[] | null>(null);
  const headerRef = useRef<HTMLInputElement>(null);

  const query = {
    q: filters.q,
    stage: filters.stage,
    source: filters.source,
    occasion: filters.occasion,
    ownerUserId: filters.ownerUserId,
    partnerId: filters.partnerId,
    followUp: filters.followUp,
    createdFrom: filters.createdFrom,
    createdTo: filters.createdTo,
    minValue: filters.minValue,
    maxValue: filters.maxValue,
    preset: filters.preset,
    sort: filters.sort,
  };
  const boardQuery = useLeadBoard({ ...query, perColumn: 20 }, filters.view === 'board');
  const listQuery = useLeadList({ ...query, page: filters.page, limit: 25 }, filters.view === 'list');
  const views = useLeadViews();
  const createLead = useCreateLead();
  const action = useLeadAction();
  const bulk = useBulkLeads();
  const { data: partners } = usePartners();
  const { data: rooms } = useAvailableRooms(convert.checkIn, convert.checkOut);
  const { data: staff } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<Array<{ id: string; name: string; isActive: boolean }>>('/users')).data,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) => (prev.q === searchText ? prev : { ...prev, q: searchText, page: 1 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    const params = new URLSearchParams();
    const write = (key: string, value: string) => { if (value) params.set(key, value); };
    write('view', filters.view);
    write('q', filters.q);
    write('stage', filters.stage);
    write('source', filters.source);
    write('occasion', filters.occasion);
    write('ownerUserId', filters.ownerUserId);
    write('partnerId', filters.partnerId);
    write('followUp', filters.followUp);
    write('createdFrom', filters.createdFrom);
    write('createdTo', filters.createdTo);
    write('minValue', filters.minValue);
    write('maxValue', filters.maxValue);
    write('preset', filters.preset);
    write('sort', filters.sort);
    if (filters.page > 1) params.set('page', String(filters.page));
    const qs = params.toString();
    window.history.replaceState({}, '', qs ? `/leads?${qs}` : '/leads');
    localStorage.setItem(VIEW_KEY, filters.view);
  }, [filters]);

  useEffect(() => {
    const sync = () => {
      const next = readFilters();
      setFilters(next);
      setSearchText(next.q);
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const filterStamp = JSON.stringify(filters);
  useEffect(() => {
    setSelected(new Set());
    setMore({});
  }, [filterStamp]);

  const rows = listQuery.data?.data ?? [];
  const allSelected = rows.length > 0 && rows.every((lead) => selected.has(lead.id));
  useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = selected.size > 0 && !allSelected;
  }, [selected.size, allSelected]);

  const isLoading = filters.view === 'board' ? boardQuery.isLoading : listQuery.isLoading;
  const isError = filters.view === 'board' ? boardQuery.isError : listQuery.isError;
  const counts = boardQuery.data?.counts;
  const listTotal = listQuery.data?.total ?? 0;
  const boardTotal = Object.values(counts ?? {}).reduce((sum, n) => sum + n, 0);
  const resultCount = filters.view === 'list' ? listTotal : boardTotal;
  const ownerName = (id?: string) => staff?.find((person) => person.id === id)?.name || 'Unassigned';
  const partnerName = (id?: string) => partners?.find((partner) => partner.id === id)?.name || 'Partner';

  const setPatch = (patch: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }));

  const chips = [
    filters.q ? { key: 'q', label: `Search: ${filters.q}` } : null,
    filters.preset ? { key: 'preset', label: PRESETS.find((item) => item.id === filters.preset)?.label || filters.preset } : null,
    filters.stage ? { key: 'stage', label: STAGE_LABEL[filters.stage as LeadStage] || filters.stage } : null,
    filters.source ? { key: 'source', label: filters.source.replaceAll('_', ' ').toLowerCase() } : null,
    filters.occasion ? { key: 'occasion', label: filters.occasion.toLowerCase() } : null,
    filters.ownerUserId ? { key: 'ownerUserId', label: ownerName(filters.ownerUserId) } : null,
    filters.partnerId ? { key: 'partnerId', label: partnerName(filters.partnerId) } : null,
    filters.followUp ? { key: 'followUp', label: filters.followUp === 'none' ? 'No follow-up' : filters.followUp } : null,
    filters.createdFrom ? { key: 'createdFrom', label: `From ${filters.createdFrom}` } : null,
    filters.createdTo ? { key: 'createdTo', label: `To ${filters.createdTo}` } : null,
    filters.minValue ? { key: 'minValue', label: `At least ${formatCurrency(Number(filters.minValue))}` } : null,
    filters.maxValue ? { key: 'maxValue', label: `At most ${formatCurrency(Number(filters.maxValue))}` } : null,
  ].filter((chip): chip is { key: string; label: string } => !!chip);

  const clearChip = (key: string) => {
    if (key === 'q') setSearchText('');
    setPatch({ [key]: '' } as Partial<Filters>);
  };

  const applyPreset = (preset: string) => {
    setSearchText('');
    setFilters({ ...blankFilters(filters.view), preset });
  };

  const showMore = async (stage: string) => {
    const have = (boardQuery.data?.board?.[stage as LeadStage]?.length ?? 0) + (more[stage]?.length ?? 0);
    const page = Math.floor(have / 20) + 1;
    setLoadingMore(stage);
    try {
      const res = await api.get<LeadList>('/leads', {
        params: { ...query, stage, page, limit: 20, sort: filters.sort || undefined },
      });
      setMore((prev) => {
        const seen = new Set([...(boardQuery.data?.board?.[stage as LeadStage] ?? []), ...(prev[stage] ?? [])].map((lead) => lead.id));
        const added = res.data.data.filter((lead) => !seen.has(lead.id));
        return { ...prev, [stage]: [...(prev[stage] ?? []), ...added] };
      });
    } catch {
      toast.error('Could not load more leads');
    } finally {
      setLoadingMore('');
    }
  };

  const saveLead = async () => {
    try {
      await createLead.mutateAsync({
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        occasion: form.occasion as Lead['occasion'],
        source: form.source as Lead['source'],
        expectedValue: form.expectedValue ? Number(form.expectedValue) : undefined,
        partnerId: form.partnerId || undefined,
        notes: form.notes || undefined,
      });
      toast.success('Lead created');
      setShowNew(false);
    } catch {
      toast.error('Could not create lead');
    }
  };

  const runBulk = (body: { action: 'stage' | 'assign' | 'lost'; stage?: string; ownerUserId?: string; lostReason?: string }) => {
    bulk.mutate(
      { ids: [...selected], ...body },
      {
        onSuccess: (result) => {
          const updated = result.results.filter((row) => row.outcome === 'updated').length;
          const skipped = result.results.length - updated;
          toast.message(`Updated ${updated}. Skipped ${skipped}.`);
          setSummary(result.results);
          setSelected(new Set());
          setConfirmStage(false);
          setConfirmOwner(false);
          setBulkLostOpen(false);
          setBulkReason('');
        },
        onError: () => toast.error('Could not update those leads'),
      },
    );
  };

  const cardsFor = (stage: LeadStage) => [...(boardQuery.data?.board?.[stage] ?? []), ...(more[stage] ?? [])];
  const columnCount = (stage: LeadStage) => counts?.[stage] ?? cardsFor(stage).length;
  const hasMore = (stage: LeadStage) => {
    if ((more[stage]?.length ?? 0) > 0 && cardsFor(stage).length >= columnCount(stage)) return false;
    return !!boardQuery.data?.hasMore?.[stage] || cardsFor(stage).length < columnCount(stage);
  };

  const sortBy = (sort: string) => setPatch({ sort });
  const toggleCreated = () => setPatch({ sort: filters.sort === 'newest' ? 'oldest' : 'newest' });

  const renderCard = (lead: Lead) => {
    const state = followState(lead);
    return (
      <button key={lead.id} type="button" className="block w-full text-left" onClick={() => setOpenLead(lead)}>
        <Card className="space-y-1 p-3">
          <p className="text-sm font-medium text-ink">{lead.name}</p>
          <p className="text-xs text-muted">{lead.phone} · {lead.occasion.toLowerCase()}</p>
          {lead.expectedValue != null && <p className="text-xs text-ink">{formatCurrency(lead.expectedValue)}</p>}
          <p className={cn('text-xs', state === 'overdue' && 'font-medium text-danger', state === 'today' && 'font-medium text-accent')}>{followText(lead)}</p>
        </Card>
      </button>
    );
  };

  const renderColumn = (stage: LeadStage, collapsed: boolean) => (
    <div key={stage} className={cn('flex flex-col rounded-lg border border-line bg-surface p-2', collapsed ? 'min-h-0' : 'min-h-[280px]')}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <StageTitle stage={stage} count={columnCount(stage)} />
        {collapsed && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setClosedOpen((prev) => ({ ...prev, [stage]: true }))}>Show</Button>
        )}
      </div>
      {!collapsed && (
        <div className="max-h-[70vh] space-y-2 overflow-y-auto">
          {cardsFor(stage).map(renderCard)}
          {hasMore(stage) && columnCount(stage) > cardsFor(stage).length && (
            <Button type="button" size="sm" variant="outline" className="w-full" disabled={loadingMore === stage} onClick={() => showMore(stage)}>
              {loadingMore === stage ? 'Loading…' : `Show more (${columnCount(stage) - cardsFor(stage).length})`}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-4 p-4 sm:p-6">
        <PageHeader
          title="Leads"
          description={isLoading ? 'Loading leads' : `${resultCount} lead${resultCount === 1 ? '' : 's'}`}
          action={
            <div className="flex flex-wrap gap-2">
              <div className="flex rounded-lg border border-line p-0.5">
                <Button type="button" size="sm" variant={filters.view === 'board' ? 'default' : 'ghost'} onClick={() => setPatch({ view: 'board', page: 1 })}>Board</Button>
                <Button type="button" size="sm" variant={filters.view === 'list' ? 'default' : 'ghost'} onClick={() => setPatch({ view: 'list' })}>List</Button>
              </div>
              <Button onClick={() => setShowNew(true)}>New lead</Button>
            </div>
          }
        />

        <div className="flex gap-2 overflow-x-auto pb-1">
          {PRESETS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={filters.preset === item.id ? 'default' : 'outline'}
              className="shrink-0"
              aria-pressed={filters.preset === item.id}
              onClick={() => applyPreset(item.id)}
            >
              {item.label} ({views.data?.[item.count] ?? 0})
            </Button>
          ))}
        </div>

        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search name, phone, email, or notes"
                aria-label="Search leads"
                className="pl-9"
              />
            </div>
            <Button type="button" variant="outline" className="sm:hidden" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>
              Filters
            </Button>
          </div>
          <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', filtersOpen ? 'grid' : 'hidden sm:grid')}>
            <FilterSelect label="Stage" value={filters.stage} onChange={(stage) => setPatch({ stage, preset: '' })} options={STAGES.map((stage) => ({ value: stage, label: STAGE_LABEL[stage] }))} />
            <FilterSelect label="Source" value={filters.source} onChange={(source) => setPatch({ source, preset: '' })} options={SOURCES.map((source) => ({ value: source, label: source.replaceAll('_', ' ') }))} />
            <FilterSelect label="Occasion" value={filters.occasion} onChange={(occasion) => setPatch({ occasion, preset: '' })} options={OCCASIONS.map((occasion) => ({ value: occasion, label: occasion }))} />
            <FilterSelect label="Owner" value={filters.ownerUserId} onChange={(ownerUserId) => setPatch({ ownerUserId, preset: '' })} options={(staff ?? []).filter((person) => person.isActive).map((person) => ({ value: person.id, label: person.name }))} />
            <FilterSelect label="Partner" value={filters.partnerId} onChange={(partnerId) => setPatch({ partnerId, preset: '' })} options={(partners ?? []).map((partner) => ({ value: partner.id, label: partner.name }))} />
            <FilterSelect label="Follow-up" value={filters.followUp} onChange={(followUp) => setPatch({ followUp, preset: '' })} options={[
              { value: 'overdue', label: 'Overdue' },
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'This week' },
              { value: 'none', label: 'No follow-up' },
            ]} />
            <label className="space-y-1 text-sm text-ink">Created from
              <Input type="date" value={filters.createdFrom} onChange={(e) => setPatch({ createdFrom: e.target.value, preset: '' })} />
            </label>
            <label className="space-y-1 text-sm text-ink">Created to
              <Input type="date" value={filters.createdTo} onChange={(e) => setPatch({ createdTo: e.target.value, preset: '' })} />
            </label>
            <label className="space-y-1 text-sm text-ink">Minimum value
              <Input inputMode="numeric" value={filters.minValue} onChange={(e) => setPatch({ minValue: e.target.value, preset: '' })} />
            </label>
            <label className="space-y-1 text-sm text-ink">Maximum value
              <Input inputMode="numeric" value={filters.maxValue} onChange={(e) => setPatch({ maxValue: e.target.value, preset: '' })} />
            </label>
          </div>
          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <button key={chip.key} type="button" className="rounded-full border border-line bg-background px-3 py-1 text-xs text-ink" onClick={() => clearChip(chip.key)}>
                  {chip.label} <span aria-hidden>×</span>
                  <span className="sr-only">Remove {chip.label}</span>
                </button>
              ))}
              <Button type="button" size="sm" variant="ghost" onClick={() => { setSearchText(''); setFilters(blankFilters(filters.view)); }}>Clear all</Button>
            </div>
          )}
        </Card>

        {isLoading && (
          filters.view === 'list'
            ? <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            : <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
        )}
        {isError && <ErrorState message="Leads could not be loaded." onRetry={() => { boardQuery.refetch(); listQuery.refetch(); }} />}

        {!isLoading && !isError && resultCount === 0 && (
          <EmptyState
            icon={Target}
            title={chips.length ? 'No leads match' : 'No leads yet'}
            description={chips.length ? 'Clear the filters to see everyone.' : 'Add the first one with New lead.'}
          />
        )}

        {!isLoading && !isError && filters.view === 'board' && resultCount > 0 && (
          <>
            <div className="md:hidden">
              <Label>Stage</Label>
              <Select value={mobileStage} onValueChange={(value) => setMobileStage(value as LeadStage)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((stage) => <SelectItem key={stage} value={stage}>{STAGE_LABEL[stage]} ({columnCount(stage)})</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="mt-3 space-y-2">
                {cardsFor(mobileStage).length === 0 && <p className="text-sm text-muted">No leads in this stage.</p>}
                {cardsFor(mobileStage).map(renderCard)}
                {hasMore(mobileStage) && columnCount(mobileStage) > cardsFor(mobileStage).length && (
                  <Button type="button" variant="outline" className="w-full" disabled={loadingMore === mobileStage} onClick={() => showMore(mobileStage)}>
                    Show more ({columnCount(mobileStage) - cardsFor(mobileStage).length})
                  </Button>
                )}
              </div>
            </div>
            <div className="hidden gap-3 md:grid md:grid-cols-3 xl:grid-cols-6">
              {STAGES.map((stage) => renderColumn(stage, (stage === 'WON' || stage === 'LOST') && !closedOpen[stage]))}
            </div>
          </>
        )}

        {!isLoading && !isError && filters.view === 'list' && resultCount > 0 && (
          <Card className="p-4">
            {selected.size > 0 && (
              <div className="motion-slide-down mb-4 flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface px-3 py-2">
                <p className="text-sm font-medium text-ink"><CountUp value={selected.size} /> selected</p>
                {selected.size > 20 && <p className="text-sm text-muted">Select at most 20</p>}
                <Select value={bulkStage} onValueChange={(value) => setBulkStage(value as LeadStage)}>
                  <SelectTrigger className="w-[140px]" aria-label="Stage for selected leads"><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map((stage) => <SelectItem key={stage} value={stage}>{STAGE_LABEL[stage]}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" size="sm" disabled={selected.size > 20 || bulk.isPending} onClick={() => setConfirmStage(true)}>Change stage</Button>
                <Select value={bulkOwner || 'none'} onValueChange={(value) => setBulkOwner(value === 'none' ? '' : value)}>
                  <SelectTrigger className="w-[160px]" aria-label="Owner for selected leads"><SelectValue placeholder="Owner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose owner</SelectItem>
                    {(staff ?? []).filter((person) => person.isActive).map((person) => <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" variant="outline" disabled={!bulkOwner || selected.size > 20 || bulk.isPending} onClick={() => setConfirmOwner(true)}>Assign</Button>
                <Button type="button" size="sm" variant="outline" disabled={selected.size > 20 || bulk.isPending} onClick={() => setBulkLostOpen(true)}>Mark lost</Button>
                <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>Clear</Button>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input ref={headerRef} type="checkbox" aria-label="Select all on this page" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((lead) => lead.id)))} />
                  </TableHead>
                  <TableHead><SortButton label="Name" active={filters.sort === 'name'} onClick={() => sortBy('name')} /></TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Occasion</TableHead>
                  <TableHead><SortButton label="Follow-up" active={filters.sort === 'followUp'} onClick={() => sortBy('followUp')} /></TableHead>
                  <TableHead><SortButton label="Expected value" active={filters.sort === 'value'} onClick={() => sortBy('value')} /></TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead><SortButton label="Created" active={filters.sort === 'newest' || filters.sort === 'oldest'} onClick={toggleCreated} /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((lead) => {
                  const state = followState(lead);
                  return (
                    <TableRow
                      key={lead.id}
                      tabIndex={0}
                      className="cursor-pointer"
                      onClick={() => setOpenLead(lead)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setOpenLead(lead); }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${lead.name}`}
                          checked={selected.has(lead.id)}
                          onChange={() => setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(lead.id)) next.delete(lead.id);
                            else next.add(lead.id);
                            return next;
                          })}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-ink">{lead.name}</TableCell>
                      <TableCell>{lead.phone}</TableCell>
                      <TableCell><Badge className={getStatusColor(lead.stage)}>{STAGE_LABEL[lead.stage]}</Badge></TableCell>
                      <TableCell className="capitalize">{lead.occasion.toLowerCase()}</TableCell>
                      <TableCell className={cn(state === 'overdue' && 'font-medium text-danger', state === 'today' && 'font-medium text-accent')}>{followText(lead)}</TableCell>
                      <TableCell>{lead.expectedValue != null ? formatCurrency(lead.expectedValue) : '—'}</TableCell>
                      <TableCell>{ownerName(lead.ownerUserId)}</TableCell>
                      <TableCell>{formatDate(lead.createdAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted">Page {filters.page} of {Math.max(1, Math.ceil(listTotal / (listQuery.data?.limit || 25)))}</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={filters.page <= 1} onClick={() => setPatch({ page: filters.page - 1 })}>Previous</Button>
                <Button type="button" size="sm" variant="outline" disabled={filters.page >= Math.ceil(listTotal / (listQuery.data?.limit || 25))} onClick={() => setPatch({ page: filters.page + 1 })}>Next</Button>
              </div>
            </div>
          </Card>
        )}

        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogContent>
            <DialogHeader><DialogTitle>New lead</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Label>Occasion</Label>
              <select className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink" value={form.occasion} onChange={(e) => setForm({ ...form, occasion: e.target.value })}>
                {OCCASIONS.map((occasion) => <option key={occasion}>{occasion}</option>)}
              </select>
              <Label>Source</Label>
              <select className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {SOURCES.map((source) => <option key={source} value={source}>{source.replaceAll('_', ' ')}</option>)}
              </select>
              <Label>Expected value</Label><Input value={form.expectedValue} onChange={(e) => setForm({ ...form, expectedValue: e.target.value })} />
              <Label>Partner</Label>
              <select className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink" value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })}>
                <option value="">None</option>
                {(partners || []).map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
              </select>
              <Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button onClick={saveLead} disabled={createLead.isPending}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!openLead} onOpenChange={(open) => { if (!open) setOpenLead(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{openLead?.name}</DialogTitle></DialogHeader>
            {openLead && (
              <div className="space-y-3 text-sm text-ink">
                <p>{openLead.phone}{openLead.email ? ` · ${openLead.email}` : ''}</p>
                <p><Badge className={getStatusColor(openLead.stage)}>{STAGE_LABEL[openLead.stage]}</Badge> <span className="text-muted">{STAGE_HELP[openLead.stage]}</span></p>
                <p className={cn(followState(openLead) === 'overdue' && 'text-danger', followState(openLead) === 'today' && 'text-accent')}>{followText(openLead)}</p>
                <p>Owner: {ownerName(openLead.ownerUserId)}</p>
                {openLead.expectedValue != null && <p>{formatCurrency(openLead.expectedValue)}</p>}
                {openLead.notes && <p className="whitespace-pre-wrap text-muted">{openLead.notes}</p>}
                {openLead.stage !== 'WON' && openLead.stage !== 'LOST' && (
                  <div className="space-y-2">
                    <Label>Event date</Label>
                    <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => openLead && action.mutate({ id: openLead.id, action: 'send-quote' }, { onSuccess: () => toast.success('Quote queued'), onError: () => toast.error('Send failed') })}>Quote</Button>
              <Button type="button" variant="outline" onClick={() => openLead && action.mutate({ id: openLead.id, action: 'log-call', body: { notes: 'Called', stage: 'CONTACTED' } }, { onSuccess: () => toast.success('Call logged'), onError: () => toast.error('Could not log the call') })}>Log call</Button>
              {openLead && openLead.stage !== 'WON' && openLead.stage !== 'LOST' && (
                <>
                  <Button type="button" onClick={() => { setConvertLead(openLead); setOpenLead(null); }}>Book</Button>
                  <Button type="button" variant="outline" onClick={() => {
                    if (!openLead || !eventDate) { toast.error('Choose an event date'); return; }
                    action.mutate({ id: openLead.id, action: 'convert-event', body: { eventDate, venue: 'LAWN', pax: 80 } }, { onSuccess: () => { toast.success('Event created'); setOpenLead(null); }, onError: () => toast.error('Convert failed') });
                  }}>Event</Button>
                  <Button type="button" variant="ghost" onClick={() => { setLostLead(openLead); setOpenLead(null); }}>Lost</Button>
                </>
              )}
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
              <select className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink" value={convert.roomId} onChange={(e) => setConvert({ ...convert, roomId: e.target.value })}>
                <option value="">Select</option>
                {(rooms || []).map((room) => <option key={room.id} value={room.id}>{room.roomNumber} · {room.roomType?.name}</option>)}
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
              <Button onClick={() => lostLead && lostReason.trim() && action.mutate({ id: lostLead.id, action: 'lost', body: { lostReason } }, { onSuccess: () => { toast.success('Marked lost'); setLostLead(null); setLostReason(''); }, onError: () => toast.error('Could not mark lost') })}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={confirmStage}
          onOpenChange={setConfirmStage}
          title={`Change ${selected.size} leads to ${STAGE_LABEL[bulkStage]}?`}
          description="Their stage updates together. Won and lost leads move as well."
          confirmLabel="Change stage"
          pending={bulk.isPending}
          onConfirm={() => runBulk({ action: 'stage', stage: bulkStage })}
        />
        <ConfirmDialog
          open={confirmOwner}
          onOpenChange={setConfirmOwner}
          title={`Assign ${selected.size} leads to ${ownerName(bulkOwner)}?`}
          description="The owner is the person who follows up."
          confirmLabel="Assign"
          pending={bulk.isPending}
          onConfirm={() => runBulk({ action: 'assign', ownerUserId: bulkOwner })}
        />
        <Dialog open={bulkLostOpen} onOpenChange={setBulkLostOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Mark {selected.size} leads as lost?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted">They leave the open stages. A reason is required.</p>
            <Input placeholder="Reason" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkLostOpen(false)}>Cancel</Button>
              <Button variant="destructive" disabled={!bulkReason.trim() || bulk.isPending} onClick={() => runBulk({ action: 'lost', lostReason: bulkReason.trim() })}>Mark lost</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={!!summary} onOpenChange={() => setSummary(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Bulk update</DialogTitle></DialogHeader>
            <p className="text-sm text-ink">Updated {(summary ?? []).filter((row) => row.outcome === 'updated').length}. Skipped {(summary ?? []).filter((row) => row.outcome === 'skipped').length}.</p>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-muted">
              {(summary ?? []).filter((row) => row.outcome === 'skipped').map((row) => (
                <li key={row.id}>{row.id}: {row.reason === 'not_found' ? 'not found' : row.reason}</li>
              ))}
            </ul>
            <DialogFooter><Button onClick={() => setSummary(null)}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function StageTitle({ stage, count }: { stage: LeadStage; count: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p className="text-xs font-semibold text-muted">{STAGE_LABEL[stage]} ({count})</p>
      </TooltipTrigger>
      <TooltipContent>{STAGE_HELP[stage]}</TooltipContent>
    </Tooltip>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="space-y-1 text-sm text-ink">{label}
      <Select value={value || 'ALL'} onValueChange={(next) => onChange(next === 'ALL' ? '' : next)}>
        <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All</SelectItem>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </label>
  );
}

function SortButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={cn('text-left', active && 'text-ink')} onClick={onClick}>{label}</button>
  );
}
