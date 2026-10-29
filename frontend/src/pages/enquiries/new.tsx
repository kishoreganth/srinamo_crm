import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth.store';
import { navigate } from '@/lib/navigate';
import { uploadEnquiryRecording, useSaveEnquiry } from '@/hooks/useEnquiries';
import { EnquiryForm, RecordingUploader, emptyEnquiryForm, formToBody, type EnquiryFormValue } from './form';

export default function NewEnquiryPage() {
  const staffName = useAuthStore((s) => s.user?.name) || '';
  const save = useSaveEnquiry();
  const [form, setForm] = useState<EnquiryFormValue>(() => {
    const next = emptyEnquiryForm();
    const draft = localStorage.getItem('enquiry-draft:new');
    if (draft) next.notes = draft;
    return next;
  });
  const [pending, setPending] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);

  const submit = async () => {
    if (!form.callerName.trim() || !form.phone.trim()) {
      toast.error('Enter the caller name and phone');
      return;
    }
    try {
      const created = await save.mutateAsync({ body: formToBody(form) });
      for (const file of pending) {
        await uploadEnquiryRecording(created.id, file, setProgress);
      }
      localStorage.removeItem('enquiry-draft:new');
      toast.success('Enquiry saved');
      navigate(`/enquiries/${created.id}`);
    } catch {
      toast.error('Could not save the enquiry');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <Card className="space-y-4 p-4 sm:p-6">
        <h1 className="text-lg font-semibold text-ink">New enquiry</h1>
        <EnquiryForm draftKey="enquiry-draft:new" value={form} onChange={setForm} staffName={staffName} />
        <RecordingUploader busy={save.isPending && progress > 0} progress={progress} onFile={(file) => setPending((list) => [...list, file])} />
        {pending.length > 0 && (
          <ul className="text-sm text-muted">
            {pending.map((file) => <li key={file.name}>{file.name} will upload when you save.</li>)}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={submit} disabled={save.isPending}>Save enquiry</Button>
          <Button type="button" variant="outline" onClick={() => navigate('/enquiries')}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}
