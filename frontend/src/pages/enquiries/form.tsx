import { useEffect, useRef, useState } from 'react';
import { Maximize2, Mic, Square, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneField } from '@/components/phone-field';
import { Textarea } from '@/components/ui/textarea';
import { useEnquiryLookup, type Enquiry } from '@/hooks/useEnquiries';
import { navigate } from '@/lib/navigate';
import { useAuthStore } from '@/stores/auth.store';

export const ENQUIRY_TYPES = [
  ['ROOM_STAY', 'Room stay'],
  ['DAY_OUTING', 'Day outing'],
  ['EVENT', 'Event/Function'],
  ['RESTAURANT', 'Restaurant'],
  ['ACTIVITY', 'Activity'],
  ['OTHER', 'Other'],
] as const;

export const ENQUIRY_SOURCES = [
  ['PHONE', 'Phone'],
  ['WHATSAPP', 'WhatsApp'],
  ['WALK_IN', 'Walk-in'],
  ['INSTAGRAM', 'Instagram'],
  ['REFERRAL', 'Referral'],
  ['OTHER', 'Other'],
] as const;

export const ENQUIRY_STATUSES = [
  ['NEW', 'New'],
  ['FOLLOW_UP', 'Follow-up'],
  ['QUOTED', 'Quoted'],
  ['CONVERTED', 'Converted to booking'],
  ['LOST', 'Lost'],
] as const;

export function labelOf(options: readonly (readonly [string, string])[], value?: string | null) {
  return options.find(([key]) => key === value)?.[1] || value || '';
}

export interface EnquiryFormValue {
  callerName: string;
  phone: string;
  alternatePhone: string;
  email: string;
  enquiryType: string;
  source: string;
  preferredCheckIn: string;
  preferredCheckOut: string;
  adults: string;
  children: string;
  interest: string;
  budget: string;
  heardAbout: string;
  callDirection: string;
  callAt: string;
  durationMinutes: string;
  status: string;
  nextFollowUpAt: string;
  notes: string;
}

export function emptyEnquiryForm(): EnquiryFormValue {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return {
    callerName: '',
    phone: '',
    alternatePhone: '',
    email: '',
    enquiryType: 'ROOM_STAY',
    source: 'PHONE',
    preferredCheckIn: '',
    preferredCheckOut: '',
    adults: '2',
    children: '0',
    interest: '',
    budget: '',
    heardAbout: '',
    callDirection: 'INCOMING',
    callAt: local,
    durationMinutes: '',
    status: 'NEW',
    nextFollowUpAt: '',
    notes: '',
  };
}

export function enquiryToForm(row: Enquiry): EnquiryFormValue {
  const date = (value?: string | null) => (value ? value.slice(0, 10) : '');
  const local = (value?: string | null) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value.slice(0, 16);
    return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  return {
    callerName: row.callerName || '',
    phone: row.phone || '',
    alternatePhone: row.alternatePhone || '',
    email: row.email || '',
    enquiryType: row.enquiryType || 'ROOM_STAY',
    source: row.source || 'PHONE',
    preferredCheckIn: date(row.preferredCheckIn),
    preferredCheckOut: date(row.preferredCheckOut),
    adults: String(row.adults ?? 1),
    children: String(row.children ?? 0),
    interest: row.interest || '',
    budget: row.budget != null ? String(row.budget) : '',
    heardAbout: row.heardAbout || '',
    callDirection: row.callDirection || 'INCOMING',
    callAt: local(row.callAt),
    durationMinutes: row.durationSeconds != null ? String(Math.round(row.durationSeconds / 60)) : '',
    status: row.status || 'NEW',
    nextFollowUpAt: date(row.nextFollowUpAt),
    notes: row.notes || '',
  };
}

export function formToBody(form: EnquiryFormValue) {
  return {
    callerName: form.callerName.trim(),
    phone: form.phone,
    alternatePhone: form.alternatePhone || null,
    email: form.email.trim() || null,
    enquiryType: form.enquiryType,
    source: form.source,
    preferredCheckIn: form.preferredCheckIn || null,
    preferredCheckOut: form.preferredCheckOut || null,
    adults: Number(form.adults || 0),
    children: Number(form.children || 0),
    interest: form.interest || null,
    budget: form.budget ? Number(form.budget) : null,
    heardAbout: form.heardAbout || null,
    callDirection: form.callDirection,
    callAt: form.callAt ? new Date(form.callAt).toISOString() : null,
    durationSeconds: form.durationMinutes ? Math.round(Number(form.durationMinutes) * 60) : null,
    status: form.status,
    nextFollowUpAt: form.nextFollowUpAt || null,
    notes: form.notes,
  };
}

function NotesField({
  draftKey,
  value,
  onChange,
}: {
  draftKey: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const grow = (node: HTMLTextAreaElement | null) => {
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.max(node.scrollHeight, 72)}px`;
  };

  useEffect(() => {
    grow(ref.current);
  }, [value]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      localStorage.setItem(draftKey, value);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [draftKey, value]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="enquiry-notes">Notes</Label>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} aria-label="Expand notes">
          <Maximize2 className="h-4 w-4" /> Expand
        </Button>
      </div>
      <Textarea
        id="enquiry-notes"
        ref={ref}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[4.5rem] resize-y"
      />
      <p className="text-xs text-muted">{value.length} characters</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl">
          <DialogHeader>
            <DialogTitle>Notes</DialogTitle>
          </DialogHeader>
          <Textarea rows={16} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[50vh]" />
          <p className="text-xs text-muted">{value.length} characters</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function EnquiryForm({
  draftKey,
  value,
  onChange,
  staffName,
  excludeEnquiryId,
}: {
  draftKey: string;
  value: EnquiryFormValue;
  onChange: (next: EnquiryFormValue) => void;
  staffName: string;
  excludeEnquiryId?: string;
}) {
  const isAdmin = useAuthStore((s) => s.user?.role) === 'ADMIN';
  const { data: matches } = useEnquiryLookup(value.phone);
  const set = (patch: Partial<EnquiryFormValue>) => onChange({ ...value, ...patch });
  const others = (matches || []).filter((row) => !(row.type === 'enquiry' && row.id === excludeEnquiryId));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="caller-name">Caller name</Label>
        <Input id="caller-name" value={value.callerName} onChange={(e) => set({ callerName: e.target.value })} />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label>Phone</Label>
        <PhoneField value={value.phone} onChange={(phone) => set({ phone })} />
        {others.length > 0 && (
          <div className="rounded-md border border-line bg-tint px-3 py-2 text-sm text-ink" role="status">
            This number is already on file.
            <ul className="mt-1 space-y-1">
              {others.map((row) => (
                <li key={`${row.type}-${row.id}`}>
                  {row.type === 'lead' && !isAdmin ? (
                    <span>Lead: {row.name}</span>
                  ) : (
                    <button
                      type="button"
                      className="text-accent underline"
                      onClick={() => navigate(row.type === 'guest' ? `/guests/${row.id}` : row.type === 'enquiry' ? `/enquiries/${row.id}` : '/leads')}
                    >
                      {row.type === 'guest' ? 'Guest' : row.type === 'enquiry' ? 'Enquiry' : 'Lead'}: {row.name}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label>Alternate phone</Label>
        <PhoneField value={value.alternatePhone} onChange={(alternatePhone) => set({ alternatePhone })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="enquiry-email">Email</Label>
        <Input id="enquiry-email" type="email" value={value.email} onChange={(e) => set({ email: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="enquiry-type">Enquiry type</Label>
        <select id="enquiry-type" className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink" value={value.enquiryType} onChange={(e) => set({ enquiryType: e.target.value })}>
          {ENQUIRY_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="enquiry-source">Source</Label>
        <select id="enquiry-source" className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink" value={value.source} onChange={(e) => set({ source: e.target.value })}>
          {ENQUIRY_SOURCES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="pref-in">Preferred check-in</Label>
        <Input id="pref-in" type="date" value={value.preferredCheckIn} onChange={(e) => set({ preferredCheckIn: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="pref-out">Preferred check-out</Label>
        <Input id="pref-out" type="date" value={value.preferredCheckOut} onChange={(e) => set({ preferredCheckOut: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="adults">Adults</Label>
        <Input id="adults" type="number" min={0} value={value.adults} onChange={(e) => set({ adults: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="children">Children</Label>
        <Input id="children" type="number" min={0} value={value.children} onChange={(e) => set({ children: e.target.value })} />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="interest">Room or package interest</Label>
        <Input id="interest" value={value.interest} onChange={(e) => set({ interest: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="budget">Budget (INR)</Label>
        <Input id="budget" type="number" min={0} value={value.budget} onChange={(e) => set({ budget: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="heard">How they heard about us</Label>
        <Input id="heard" value={value.heardAbout} onChange={(e) => set({ heardAbout: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="direction">Call direction</Label>
        <select id="direction" className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink" value={value.callDirection} onChange={(e) => set({ callDirection: e.target.value })}>
          <option value="INCOMING">Incoming</option>
          <option value="OUTGOING">Outgoing</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="call-at">Call date and time</Label>
        <Input id="call-at" type="datetime-local" value={value.callAt} onChange={(e) => set({ callAt: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="duration">Call duration (minutes)</Label>
        <Input id="duration" type="number" min={0} value={value.durationMinutes} onChange={(e) => set({ durationMinutes: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="staff">Staff who took the call</Label>
        <Input id="staff" value={staffName} readOnly />
      </div>
      <div className="space-y-1">
        <Label htmlFor="status">Status</Label>
        <select id="status" className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink" value={value.status} onChange={(e) => set({ status: e.target.value })}>
          {ENQUIRY_STATUSES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="follow">Next follow-up</Label>
        <Input id="follow" type="date" value={value.nextFollowUpAt} onChange={(e) => set({ nextFollowUpAt: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <NotesField draftKey={draftKey} value={value.notes} onChange={(notes) => set({ notes })} />
      </div>
    </div>
  );
}

export function RecordingUploader({
  onFile,
  busy,
  progress,
}: {
  onFile: (file: File) => void;
  busy?: boolean;
  progress?: number;
}) {
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const take = (file: File) => {
    const ok = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm', 'video/webm', ''];
    const name = file.name.toLowerCase();
    const extOk = ['.mp3', '.m4a', '.wav', '.ogg', '.webm'].some((ext) => name.endsWith(ext));
    if (!extOk && file.type && !ok.includes(file.type) && !file.type.startsWith('audio/')) {
      toast.error('Choose an mp3, m4a, wav, ogg, or webm file');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('Recording is over 25 MB');
      return;
    }
    onFile(file);
  };

  const toggleMic = async () => {
    if (recording && recorder.current) {
      recorder.current.stop();
      setRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('This browser cannot record audio');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream);
      chunks.current = [];
      media.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const type = media.mimeType || 'audio/webm';
        const blob = new Blob(chunks.current, { type });
        take(new File([blob], 'call.webm', { type }));
      };
      recorder.current = media;
      media.start();
      setRecording(true);
    } catch {
      toast.error('Microphone permission was blocked');
    }
  };

  return (
    <div className="space-y-3">
      <div
        className="rounded-lg border border-dashed border-line bg-surface px-4 py-6 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) take(file);
        }}
      >
        <Upload className="mx-auto h-5 w-5 text-muted" />
        <p className="mt-2 text-sm text-ink">Drop a call recording here, or choose a file.</p>
        <p className="text-xs text-muted">mp3, m4a, wav, ogg, webm. Up to 25 MB.</p>
        <label className="mt-3 inline-block">
          <input
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) take(file);
              e.target.value = '';
            }}
          />
          <span className="inline-flex cursor-pointer rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink">Choose file</span>
        </label>
      </div>
      <Button type="button" variant="outline" onClick={toggleMic} aria-pressed={recording}>
        {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {recording ? 'Stop recording' : 'Record from microphone'}
      </Button>
      {busy && (
        <div className="h-2 overflow-hidden rounded-full bg-line" aria-valuenow={progress || 0} aria-valuemin={0} aria-valuemax={100} role="progressbar">
          <div className="h-full bg-accent" style={{ width: `${progress || 0}%` }} />
        </div>
      )}
    </div>
  );
}
