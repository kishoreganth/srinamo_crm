import { useState } from 'react';
import { toast } from 'sonner';
import { useRoomTypes, useCreateRoomType, useUpdateRoomType } from '@/hooks/useRooms';
import { useMenuItems, useCreateMenuItem, useUpdateMenuItem } from '@/hooks/useRestaurant';
import { useActivities, useCreateActivity, useUpdateActivity } from '@/hooks/useActivities';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { navigate } from '@/lib/navigate';
import api from '@/lib/api';
import { Plus, Pencil, Loader2, ShieldAlert } from 'lucide-react';
import type { RoomType, MenuItem, Activity, Amenity } from '@/types';
import { useAmenities, useDisableAmenity, useSaveAmenity } from '@/hooks/useAmenities';
import { usePackages } from '@/hooks/usePackages';

function RoomTypesTab() {
  const { data: roomTypes, isLoading } = useRoomTypes();
  const createMutation = useCreateRoomType();
  const updateMutation = useUpdateRoomType();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RoomType | null>(null);
  const [form, setForm] = useState({ name: '', description: '', maxOccupancy: '2', basePrice: '' });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', maxOccupancy: '2', basePrice: '' });
    setShowForm(true);
  };

  const openEdit = (rt: RoomType) => {
    setEditing(rt);
    setForm({
      name: rt.name,
      description: rt.description || '',
      maxOccupancy: String(rt.maxOccupancy),
      basePrice: String(rt.basePrice),
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    const payload = {
      name: form.name,
      description: form.description,
      maxOccupancy: parseInt(form.maxOccupancy),
      basePrice: parseFloat(form.basePrice),
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload }, {
        onSuccess: () => { toast.success('Room type updated'); setShowForm(false); },
        onError: () => toast.error('Failed to update'),
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { toast.success('Room type created'); setShowForm(false); },
        onError: () => toast.error('Failed to create'),
      });
    }
  };

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Add Room Type</Button>
      </div>
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Max Occupancy</TableHead>
                <TableHead className="text-right">Base Price</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!roomTypes || roomTypes.length === 0) ? (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-400">No room types</TableCell></TableRow>
              ) : roomTypes.map((rt: RoomType) => (
                <TableRow key={rt.id}>
                  <TableCell className="font-medium">{rt.name}</TableCell>
                  <TableCell className="text-sm text-gray-500">{rt.description || '-'}</TableCell>
                  <TableCell className="text-center">{rt.maxOccupancy}</TableCell>
                  <TableCell className="text-right">{formatCurrency(rt.basePrice)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(rt)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'New'} Room Type</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Max Occupancy</Label><Input type="number" value={form.maxOccupancy} onChange={(e) => setForm({ ...form, maxOccupancy: e.target.value })} /></div>
              <div className="space-y-1"><Label>Base Price (INR)</Label><Input type="number" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MenuItemsTab() {
  const { data: items, isLoading } = useMenuItems();
  const createMutation = useCreateMenuItem();
  const updateMutation = useUpdateMenuItem();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState({ name: '', category: '', description: '', price: '', isVeg: true });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', category: '', description: '', price: '', isVeg: true });
    setShowForm(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      category: item.category,
      description: item.description || '',
      price: String(item.price),
      isVeg: item.isVeg,
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    const payload = {
      name: form.name,
      category: form.category,
      description: form.description,
      price: parseFloat(form.price),
      isVeg: form.isVeg,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload }, {
        onSuccess: () => { toast.success('Menu item updated'); setShowForm(false); },
        onError: () => toast.error('Failed to update'),
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { toast.success('Menu item created'); setShowForm(false); },
        onError: () => toast.error('Failed to create'),
      });
    }
  };

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Add Menu Item</Button>
      </div>
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Type</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!items || items.length === 0) ? (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-400">No menu items</TableCell></TableRow>
              ) : items.map((item: MenuItem) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell><Badge variant="secondary">{item.category}</Badge></TableCell>
                  <TableCell className="text-center">
                    <Badge variant={item.isVeg ? 'default' : 'destructive'}>
                      {item.isVeg ? 'Veg' : 'Non-Veg'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'New'} Menu Item</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {['Starters', 'Main Course', 'Breads', 'Beverages', 'Desserts'].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Price (INR)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={form.isVeg} onCheckedChange={(v) => setForm({ ...form, isVeg: v })} />
                <Label>{form.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActivitiesTab() {
  const { data: activities, isLoading } = useActivities();
  const createMutation = useCreateActivity();
  const updateMutation = useUpdateActivity();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', maxParticipants: '10', duration: '' });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', price: '', maxParticipants: '10', duration: '' });
    setShowForm(true);
  };

  const openEdit = (a: Activity) => {
    setEditing(a);
    setForm({
      name: a.name,
      description: a.description || '',
      price: String(a.price),
      maxParticipants: String(a.maxCapacity),
      duration: String(a.duration || ''),
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    const payload = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      maxParticipants: parseInt(form.maxParticipants),
      duration: form.duration,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload }, {
        onSuccess: () => { toast.success('Activity updated'); setShowForm(false); },
        onError: () => toast.error('Failed to update'),
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { toast.success('Activity created'); setShowForm(false); },
        onError: () => toast.error('Failed to create'),
      });
    }
  };

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Add Activity</Button>
      </div>
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Max Participants</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!activities || activities.length === 0) ? (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-400">No activities</TableCell></TableRow>
              ) : activities.map((a: Activity) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-sm text-gray-500">{a.description || '-'}</TableCell>
                  <TableCell className="text-center">{a.maxCapacity}</TableCell>
                  <TableCell>{a.duration || '-'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(a.price)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'New'} Activity</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1"><Label>Price (INR)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div className="space-y-1"><Label>Max Participants</Label><Input type="number" value={form.maxParticipants} onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })} /></div>
              <div className="space-y-1"><Label>Duration</Label><Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 2 hours" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StaffTab() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Staff Management</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Admin</TableCell>
              <TableCell>admin@srinamo.com</TableCell>
              <TableCell><Badge>ADMIN</Badge></TableCell>
              <TableCell><Badge variant="default">Active</Badge></TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Receptionist</TableCell>
              <TableCell>reception@srinamo.com</TableCell>
              <TableCell><Badge variant="secondary">RECEPTIONIST</Badge></TableCell>
              <TableCell><Badge variant="default">Active</Badge></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function WhatsAppTab() {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const sendTest = async () => {
    if (!phone.trim()) {
      toast.error('Enter a phone number');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post(`/notifications/test-whatsapp?phone=${encodeURIComponent(phone.trim())}`);
      const data = res.data as { success?: boolean; error?: string; status?: number };
      if (data.success) {
        toast.success('Test queued to n8n');
      } else {
        toast.error(data.error || `Failed (${data.status ?? 'no n8n'})`);
      }
    } catch {
      toast.error('Test send failed — is n8n running?');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">WhatsApp test send</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <p className="text-sm text-gray-500">
          Sends the <code>booking-confirmed</code> template to this number via n8n. Tamil/English copy lives in Meta, not here.
          Leave <code>WHATSAPP_ENABLED=false</code> until the Cloud API node is wired.
        </p>
        <div className="space-y-1">
          <Label>Admin phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="91XXXXXXXXXX" />
        </div>
        <Button onClick={sendTest} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
          Send test
        </Button>
      </CardContent>
    </Card>
  );
}

function ResortInfoTab() {
  const [info, setInfo] = useState({
    name: 'SriNamo Farms Resort',
    gstin: '',
    address: '',
    phone: '',
    email: '',
  });

  const handleSave = () => {
    toast.success('Resort info saved');
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Resort Information</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <div className="space-y-1">
          <Label>Resort Name</Label>
          <Input value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>GSTIN</Label>
          <Input value={info.gstin} onChange={(e) => setInfo({ ...info, gstin: e.target.value })} placeholder="22AAAAA0000A1Z5" />
        </div>
        <div className="space-y-1">
          <Label>Address</Label>
          <Textarea value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} />
          </div>
        </div>
        <Button onClick={handleSave}>Save Changes</Button>
      </CardContent>
    </Card>
  );
}

function PackagesTab() {
  const { data: packages, isLoading } = usePackages();
  if (isLoading) return <Skeleton className="h-48" />;
  return (
    <Card>
      <CardContent className="pt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timing</TableHead>
              <TableHead>Price / person</TableHead>
              <TableHead>Includes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(packages || []).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.startsAt} – {item.endsAt}</TableCell>
                <TableCell>{formatCurrency(Number(item.pricePerPerson))}</TableCell>
                <TableCell className="text-sm text-gray-600">{item.includes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-gray-500 mt-3">Children under 5 are free. From 5 years, the charge is the same as an adult.</p>
      </CardContent>
    </Card>
  );
}

function AmenitiesTab() {
  const { data: amenities, isLoading } = useAmenities(true);
  const save = useSaveAmenity();
  const disable = useDisableAmenity();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Amenity | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '0', isActive: true, chargeType: 'FLAT', included: false });

  const startCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', price: '0', isActive: true, chargeType: 'FLAT', included: false });
    setOpen(true);
  };

  const startEdit = (amenity: Amenity) => {
    setEditing(amenity);
    setForm({
      name: amenity.name,
      description: amenity.description || '',
      price: String(amenity.price ?? 0),
      isActive: amenity.isActive,
      chargeType: amenity.chargeType === 'PER_PERSON' ? 'PER_PERSON' : 'FLAT',
      included: Boolean(amenity.included),
    });
    setOpen(true);
  };

  const submit = () => {
    save.mutate({
      id: editing?.id,
      name: form.name.trim(),
      description: form.description.trim(),
      price: form.included ? 0 : (Number(form.price) || 0),
      isActive: form.isActive,
      chargeType: form.chargeType,
      included: form.included,
    }, {
      onSuccess: () => { toast.success(editing ? 'Amenity updated' : 'Amenity added'); setOpen(false); },
      onError: () => toast.error('Could not save amenity'),
    });
  };

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={startCreate}><Plus className="h-4 w-4 mr-1" />Add amenity</Button>
      </div>
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(amenities || []).map((amenity) => (
                <TableRow key={amenity.id}>
                  <TableCell>
                    <div className="font-medium">{amenity.name}</div>
                    {amenity.description && <div className="text-xs text-gray-500">{amenity.description}</div>}
                  </TableCell>
                  <TableCell>{amenity.included ? 'Included' : formatCurrency(Number(amenity.price) || 0)}</TableCell>
                  <TableCell>{amenity.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Hidden</Badge>}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(amenity)}><Pencil className="h-3.5 w-3.5" /></Button>
                    {amenity.isActive && (
                      <Button size="sm" variant="outline" onClick={() => disable.mutate(amenity.id, { onSuccess: () => toast.success('Amenity hidden') })}>Hide</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!amenities?.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-gray-500">No amenities yet. Add the extras reception can offer, such as an extra mattress or a bonfire.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit amenity' : 'Add amenity'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Included with day packages</Label>
              <Switch checked={form.included} onCheckedChange={(checked) => setForm({ ...form, included: checked, price: checked ? '0' : form.price })} />
            </div>
            {!form.included && (
              <>
                <div className="space-y-1">
                  <Label>Charge</Label>
                  <Select value={form.chargeType} onValueChange={(chargeType) => setForm({ ...form, chargeType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FLAT">Flat amount</SelectItem>
                      <SelectItem value="PER_PERSON">Per person</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{form.chargeType === 'PER_PERSON' ? 'Price per person (INR)' : 'Price (INR)'}</Label>
                  <Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <Label>Show to reception</Label>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!form.name.trim() || save.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuthStore();

  if (user?.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ShieldAlert className="h-12 w-12 text-gray-300" />
        <p className="mt-4 text-lg text-gray-500">Admin access required</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard')}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <Tabs defaultValue="room-types">
        <TabsList>
          <TabsTrigger value="room-types">Room Types</TabsTrigger>
          <TabsTrigger value="menu">Menu Items</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="amenities">Amenities</TabsTrigger>
          <TabsTrigger value="packages">Day packages</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="resort">Resort Info</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>
        <TabsContent value="room-types" className="mt-4"><RoomTypesTab /></TabsContent>
        <TabsContent value="menu" className="mt-4"><MenuItemsTab /></TabsContent>
        <TabsContent value="activities" className="mt-4"><ActivitiesTab /></TabsContent>
        <TabsContent value="amenities" className="mt-4"><AmenitiesTab /></TabsContent>
        <TabsContent value="packages" className="mt-4"><PackagesTab /></TabsContent>
        <TabsContent value="staff" className="mt-4"><StaffTab /></TabsContent>
        <TabsContent value="resort" className="mt-4"><ResortInfoTab /></TabsContent>
        <TabsContent value="whatsapp" className="mt-4"><WhatsAppTab /></TabsContent>
      </Tabs>
    </div>
  );
}
