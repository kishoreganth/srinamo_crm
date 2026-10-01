import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, Eye, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGuests, useCreateGuest } from '@/hooks/useGuests';
import { useImportGuests } from '@/hooks/useCrm';
import { formatCurrency } from '@/lib/utils';
import { navigate } from '@/lib/navigate';
import { toast } from 'sonner';
import { PhoneField } from '@/components/phone-field';
import { displayPhone } from '@/lib/country-codes';
import { guestEmailSchema, guestPhoneSchema } from '@/lib/guest-form';

const guestSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  phone: guestPhoneSchema,
  email: guestEmailSchema,
  idType: z.string().optional(),
  idNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
});

export default function GuestsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);

  const { data, isLoading } = useGuests(page, search);
  const createGuest = useCreateGuest();
  const importGuests = useImportGuests();
  const [importPreview, setImportPreview] = useState<{ created: number; updated: number; skipped: number; file?: File } | null>(null);
  const form = useForm({ resolver: zodResolver(guestSchema) });

  const handleCreate = async (formData: z.infer<typeof guestSchema>) => {
    try {
      await createGuest.mutateAsync({
        ...formData,
        email: formData.email?.trim() || undefined,
      });
      setShowDialog(false);
      form.reset();
      toast.success('Guest added');
    } catch {
      toast.error('Failed to add guest');
    }
  };

  if (isLoading) {
    return <div className="p-6"><Skeleton className="h-96" /></div>;
  }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <div className="flex gap-2">
          <label className="inline-flex">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const res = await importGuests.mutateAsync({ file, commit: false });
                  setImportPreview({ created: res.created, updated: res.updated, skipped: res.skipped, file });
                  toast.message(`Preview: ${res.created} new, ${res.updated} update, ${res.skipped} skip`);
                } catch {
                  toast.error('Import preview failed');
                }
              }}
            />
            <span className="inline-flex items-center rounded-md border px-3 py-2 text-sm cursor-pointer">
              <Upload className="h-4 w-4 mr-2" /> Import Excel
            </span>
          </label>
          {importPreview?.file && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await importGuests.mutateAsync({ file: importPreview.file!, commit: true });
                  toast.success('Guests imported');
                  setImportPreview(null);
                } catch {
                  toast.error('Import failed');
                }
              }}
            >
              Commit import
            </Button>
          )}
          <Button onClick={() => setShowDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" /> Add Guest
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, phone, email, ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>

        {data?.data?.length ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>ID Type</TableHead>
                  <TableHead>Total Stays</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.firstName} {g.lastName}</TableCell>
                    <TableCell>{displayPhone(g.phone)}</TableCell>
                    <TableCell>{g.email || '-'}</TableCell>
                    <TableCell>{g.idType || '-'}</TableCell>
                    <TableCell>{g.totalStays}</TableCell>
                    <TableCell>{formatCurrency(g.totalSpent)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/guests/${g.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * data.limit + 1} to {Math.min(page * data.limit, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          </>
        ) : (
          <p className="text-center text-gray-500 py-12">No guests found</p>
        )}
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Guest</DialogTitle></DialogHeader>
          <form noValidate onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First Name</Label>
                <Input {...form.register('firstName')} />
                {form.formState.errors.firstName && <p className="text-xs text-red-500">{form.formState.errors.firstName.message as string}</p>}
              </div>
              <div className="space-y-1">
                <Label>Last Name</Label>
                <Input {...form.register('lastName')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Controller
                control={form.control}
                name="phone"
                defaultValue=""
                render={({ field }) => <PhoneField value={field.value} onChange={field.onChange} />}
              />
              {form.formState.errors.phone && <p className="text-xs text-red-500">{form.formState.errors.phone.message as string}</p>}
            </div>
            <div className="space-y-1">
              <Label>Email (optional)</Label>
              <Input type="text" inputMode="email" autoComplete="email" placeholder="name@email.com" {...form.register('email')} />
              {form.formState.errors.email && <p className="text-xs text-red-500">{form.formState.errors.email.message as string}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>ID Type</Label>
                <select {...form.register('idType')} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Select</option>
                  <option value="AADHAAR">Aadhaar</option>
                  <option value="PAN">PAN</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="DRIVING_LICENSE">Driving License</option>
                  <option value="VOTER_ID">Voter ID</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>ID Number</Label>
                <Input {...form.register('idNumber')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input {...form.register('address')} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>City</Label>
                <Input {...form.register('city')} />
              </div>
              <div className="space-y-1">
                <Label>State</Label>
                <Input {...form.register('state')} />
              </div>
              <div className="space-y-1">
                <Label>Country</Label>
                <Input {...form.register('country')} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
