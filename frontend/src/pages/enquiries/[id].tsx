import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/layout/empty-state';
import api from '@/lib/api';
import { navigate } from '@/lib/navigate';
import { useAuthStore } from '@/stores/auth.store';
import {
  uploadEnquiryRecording,
  useConvertEnquiryGuest,
  useEnquiry,
  useSaveEnquiry,
  type EnquiryRecording,
} from '@/hooks/useEnquiries';
import { EnquiryForm, RecordingUploader, enquiryToForm, formToBody, type EnquiryFormValue } from './form';

function Player({ enquiryId, recording }: { enquiryId: string; recording: EnquiryRecording }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let url = '';
    let dead = false;
    api.get(`/enquiries/${enquiryId}/recordings/${recording.id}`, { responseType: 'blob' })
      .then((res) => {
        url = URL.createObjectURL(res.data);
        if (!dead) setSrc(url);
      })
      .catch(() => {
        if (!dead) setSrc('');
      });
    return () => {
      dead = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [enquiryId, recording.id]);
  return (
    <div className="space-y-1">
      <p className="text-sm text-ink">{recording.originalName}</p>
      {src ? <audio controls src={src} className="w-full" /> : <p className="text-sm text-muted">Recording is not available for this login.</p>}
    </div>
  );
}

export default function EnquiryDetailPage({ enquiryId }: { enquiryId: string }) {
  const { data, isLoading, isError, refetch } = useEnquiry(enquiryId);
  const save = useSaveEnquiry();
  const convertGuest = useConvertEnquiryGuest();
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState<EnquiryFormValue | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!data) return;
    const next = enquiryToForm(data);
    const draft = localStorage.getItem(`enquiry-draft:${enquiryId}`);
    if (draft) next.notes = draft;
    setForm(next);
  }, [data, enquiryId]);

  if (isError) {
    return <div className="p-6"><ErrorState message="Enquiry not found." onRetry={() => refetch()} /></div>;
  }
  if (isLoading || !form || !data) {
    return <div className="space-y-4 p-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-96" /></div>;
  }

  const submit = async () => {
    try {
      await save.mutateAsync({ id: enquiryId, body: formToBody(form) });
      localStorage.removeItem(`enquiry-draft:${enquiryId}`);
      toast.success('Enquiry updated');
    } catch {
      toast.error('Could not update the enquiry');
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    setProgress(0);
    try {
      await uploadEnquiryRecording(enquiryId, file, setProgress);
      toast.success('Recording saved');
      refetch();
    } catch {
      toast.error('Could not save that recording');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (recordingId: string) => {
    try {
      await api.delete(`/enquiries/${enquiryId}/recordings/${recordingId}`);
      toast.success('Recording removed');
      refetch();
    } catch {
      toast.error('Only admin can delete a recording');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <Card className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-ink">{data.callerName}</h1>
          <Button type="button" variant="outline" onClick={() => navigate('/enquiries')}>Back</Button>
        </div>
        <EnquiryForm
          draftKey={`enquiry-draft:${enquiryId}`}
          value={form}
          onChange={setForm}
          staffName={data.takenBy?.name || user?.name || ''}
          excludeEnquiryId={enquiryId}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={submit} disabled={save.isPending}>Save</Button>
          <Button
            type="button"
            variant="outline"
            disabled={convertGuest.isPending}
            onClick={() => convertGuest.mutate(enquiryId, {
              onSuccess: (result) => {
                toast.success(result.created ? 'Guest created' : 'Linked to the existing guest');
                navigate(`/guests/${result.guestId}`);
              },
              onError: () => toast.error('Could not convert to a guest'),
            })}
          >
            Convert to guest
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(`/bookings/new?enquiry=${enquiryId}`)}>
            Convert to booking
          </Button>
        </div>
      </Card>
      <Card className="space-y-4 p-4 sm:p-6">
        <h2 className="text-base font-semibold text-ink">Call recordings</h2>
        {data.canPlay === false && <p className="text-sm text-muted">You can play recordings only for calls you took.</p>}
        {data.canPlay !== false && (data.recordings || []).map((row) => (
          <div key={row.id} className="space-y-2">
            <Player enquiryId={enquiryId} recording={row} />
            {user?.role === 'ADMIN' && (
              <Button type="button" size="sm" variant="outline" onClick={() => remove(row.id)}>Delete recording</Button>
            )}
          </div>
        ))}
        <RecordingUploader busy={uploading} progress={progress} onFile={upload} />
      </Card>
    </div>
  );
}
