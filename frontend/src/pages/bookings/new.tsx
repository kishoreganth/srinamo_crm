import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreateBooking } from '@/hooks/useBookings';
import { useSearchGuests, useCreateGuest } from '@/hooks/useGuests';
import { useAvailableRooms, useRoomTypes } from '@/hooks/useRooms';
import { useAmenities } from '@/hooks/useAmenities';
import { usePackages } from '@/hooks/usePackages';
import { formatCurrency, getDaysBetween } from '@/lib/utils';
import { navigate } from '@/lib/navigate';
import { toast } from 'sonner';
import type { Amenity, Guest, Room } from '@/types';
import { PhoneField } from '@/components/phone-field';
import { displayPhone } from '@/lib/country-codes';
import { guestEmailSchema, guestPhoneSchema } from '@/lib/guest-form';

const guestSchema = z.object({
  firstName: z.string().min(1, 'First name required'),
  lastName: z.string().min(1, 'Last name required'),
  phone: guestPhoneSchema,
  email: guestEmailSchema,
  idType: z.string().optional(),
  idNumber: z.string().optional(),
});

export default function NewBookingPage() {
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [people, setPeople] = useState(1);
  const [underFive, setUnderFive] = useState(0);
  const [packageId, setPackageId] = useState('');
  const [amenityQty, setAmenityQty] = useState<Record<string, number>>({});
  const [extraGuests, setExtraGuests] = useState<string[]>([]);
  const [extraName, setExtraName] = useState('');
  const [extraSearch, setExtraSearch] = useState('');
  const [source, setSource] = useState('WALK_IN');
  const [selectedRoomType, setSelectedRoomType] = useState('all');
  const [selectedRooms, setSelectedRooms] = useState<Room[]>([]);
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<string[]>([]);
  const [specialRequests, setSpecialRequests] = useState('');
  const [showGuestDialog, setShowGuestDialog] = useState(false);

  const sameDay = Boolean(checkIn && checkOut && checkIn === checkOut);
  const stayCheckIn = sameDay ? `${checkIn}T00:00:00` : checkIn;
  const stayCheckOut = sameDay ? `${checkOut}T23:59:00` : checkOut;

  const { data: searchResults } = useSearchGuests(guestSearch);
  const { data: roomTypes } = useRoomTypes();
  const roomTypeFilter = selectedRoomType && selectedRoomType !== 'all' ? selectedRoomType : undefined;
  const { data: availableRooms } = useAvailableRooms(stayCheckIn, stayCheckOut, roomTypeFilter);
  const { data: amenities } = useAmenities();
  const { data: packages } = usePackages();
  const createBooking = useCreateBooking();
  const createGuest = useCreateGuest();

  const guestForm = useForm({ resolver: zodResolver(guestSchema) });

  const nights = checkIn && checkOut && !sameDay ? getDaysBetween(checkIn, checkOut) : 0;
  const partySize = Math.max(people, 1 + extraGuests.length);
  const payingGuests = Math.max(0, partySize - underFive);
  const bedCapacity = selectedRooms.reduce((sum, room) => sum + (room.roomType?.maxOccupancy || 0), 0);
  const selectedPackage = (packages || []).find((item) => item.id === packageId);
  const addonAmenities = (amenities || []).filter((amenity) => !amenity.included);
  const includedAmenities = (amenities || []).filter((amenity) => amenity.included);
  const amenityTotal = addonAmenities
    .filter((amenity) => selectedAmenityIds.includes(amenity.id))
    .reduce((sum, amenity) => sum + (Number(amenity.price) || 0) * (amenityQty[amenity.id] || 1), 0);
  const totalAmount = (selectedPackage ? Number(selectedPackage.pricePerPerson) * payingGuests : 0) + amenityTotal;

  const toggleRoom = (room: Room) => {
    setSelectedRooms((list) => list.some((item) => item.id === room.id)
      ? list.filter((item) => item.id !== room.id)
      : [...list, room]);
  };

  const toggleAmenity = (amenity: Amenity) => {
    setSelectedAmenityIds((list) => list.includes(amenity.id)
      ? list.filter((id) => id !== amenity.id)
      : [...list, amenity.id]);
  };

  const handleCreateGuest = async (data: z.infer<typeof guestSchema>) => {
    try {
      const guest = await createGuest.mutateAsync({
        ...data,
        email: data.email?.trim() || undefined,
      });
      setSelectedGuest(guest);
      setShowGuestDialog(false);
      guestForm.reset();
      toast.success('Guest created');
    } catch {
      toast.error('Failed to create guest');
    }
  };

  const handleSubmit = async () => {
    const missing = [
      !selectedGuest && 'a guest',
      (!checkIn || !checkOut) && 'the dates',
      !selectedRooms.length && 'a room',
      !packageId && 'a day package',
    ].filter(Boolean);
    if (missing.length) {
      toast.error(`Choose ${missing.join(', ')}`);
      return;
    }
    try {
      const named = extraGuests.map((name) => name.trim()).filter(Boolean);
      const partySize = Math.max(people, 1 + named.length);
      await createBooking.mutateAsync({
        guestId: selectedGuest.id,
        roomId: selectedRooms[0].id,
        roomIds: selectedRooms.map((room) => room.id),
        amenitySelections: selectedAmenityIds.map((amenityId) => ({ amenityId, quantity: amenityQty[amenityId] || 1 })),
        checkIn: stayCheckIn,
        checkOut: stayCheckOut,
        adults: Math.max(0, partySize - underFive),
        children: Math.min(underFive, partySize),
        packageId,
        source: source as 'WALK_IN' | 'PHONE' | 'WEBSITE' | 'OTA' | 'REFERRAL',
        specialRequests,
        companions: named.map((guestName) => ({ guestName })),
      });
      toast.success('Booking created successfully');
      navigate('/bookings');
    } catch {
      toast.error('Failed to create booking');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink mb-1">1. Guest</h2>
        <p className="text-sm text-muted mb-4">Search a previous guest, or create a new one.</p>
        {selectedGuest ? (
          <div className="flex items-center justify-between rounded-lg bg-tint p-4 text-ink">
            <div>
              <p className="font-medium">{selectedGuest.firstName} {selectedGuest.lastName}</p>
              <p className="text-sm text-muted">{displayPhone(selectedGuest.phone)}{selectedGuest.email ? ` • ${selectedGuest.email}` : ''}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setSelectedGuest(null); setExtraGuests([]); setExtraSearch(''); setPeople(1); }}>Change</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                placeholder="Search by name or phone..."
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchResults && searchResults.length > 0 && (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {searchResults.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => { setSelectedGuest(g); setGuestSearch(''); }}
                    className="w-full text-left px-4 py-2 hover:bg-background/60 border-b last:border-b-0"
                  >
                    <p className="text-sm font-medium">{g.firstName} {g.lastName}</p>
                    <p className="text-xs text-muted">{displayPhone(g.phone)}</p>
                  </button>
                ))}
              </div>
            )}
            <Button variant="outline" onClick={() => setShowGuestDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create New Guest
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">2. Stay Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Check-in Date</Label>
            <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Check-out Date</Label>
            <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            <p className="text-xs text-muted">For a day package, use the same date for both.</p>
          </div>
          <div className="space-y-2">
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="WALK_IN">Walk In</SelectItem>
                <SelectItem value="PHONE">Phone</SelectItem>
                <SelectItem value="WEBSITE">Website</SelectItem>
                <SelectItem value="OTA">OTA</SelectItem>
                <SelectItem value="REFERRAL">Referral</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-5 space-y-3 border-t pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
            <div className="space-y-2">
              <Label>People coming</Label>
              <Input
                type="number"
                min={1}
                value={people}
                onChange={(e) => setPeople(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div className="space-y-2">
              <Label>Children under 5</Label>
              <Input
                type="number"
                min={0}
                value={underFive}
                onChange={(e) => setUnderFive(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>
          <p className="text-xs text-muted">
            Under 5 is free. Age 5 and above is charged as an adult. Paying guests: {payingGuests}.
          </p>
          <div className="space-y-2">
            <Label>Other guests (optional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Name of another guest"
                value={extraName}
                onChange={(e) => setExtraName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const name = extraName.trim();
                    if (!name) return;
                    setExtraGuests((list) => [...list, name]);
                    setPeople((count) => Math.max(count, extraGuests.length + 2));
                    setExtraName('');
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const name = extraName.trim();
                  if (!name) return;
                  setExtraGuests((list) => [...list, name]);
                  setPeople((count) => Math.max(count, extraGuests.length + 2));
                  setExtraName('');
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {extraGuests.length > 0 && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <Input
                    placeholder={`Search ${extraGuests.length} guests`}
                    value={extraSearch}
                    onChange={(e) => setExtraSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-1">
                  {extraGuests
                    .map((name, index) => ({ name, index }))
                    .filter((guest) => guest.name.toLowerCase().includes(extraSearch.trim().toLowerCase()))
                    .map((guest) => (
                      <li key={`${guest.name}-${guest.index}`} className="flex items-center justify-between rounded-md bg-background/50 px-3 py-1.5 text-sm">
                        <span>{guest.name}</span>
                        <button
                          type="button"
                          className="text-xs text-muted hover:text-danger"
                          onClick={() => setExtraGuests((list) => list.filter((_, i) => i !== guest.index))}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                </ul>
                {extraSearch.trim() && !extraGuests.some((name) => name.toLowerCase().includes(extraSearch.trim().toLowerCase())) && (
                  <p className="text-xs text-muted">No guests match that search.</p>
                )}
              </div>
            )}
          </div>
          {selectedRooms.length > 0 && bedCapacity < partySize && (
            <p className="text-sm text-warning">
              These rooms sleep {bedCapacity}. You have {partySize} people. Choose another room.
            </p>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink mb-1">3. Rooms</h2>
        <p className="text-sm text-muted mb-4">
          Choose one or more rooms. Selected beds: {bedCapacity}. People coming: {partySize}.
        </p>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedRoomType('all')}
              className={`rounded-full border px-3 py-1 text-sm ${selectedRoomType === 'all' ? 'border-accent bg-accent text-accent-foreground' : 'text-muted hover:bg-background/60'}`}
            >
              All types
            </button>
            {roomTypes?.map((rt) => (
              <button
                key={rt.id}
                type="button"
                onClick={() => setSelectedRoomType(rt.id)}
                className={`rounded-full border px-3 py-1 text-sm ${selectedRoomType === rt.id ? 'border-accent bg-accent text-accent-foreground' : 'text-muted hover:bg-background/60'}`}
              >
                {rt.name}
              </button>
            ))}
          </div>

          {!checkIn || !checkOut ? (
            <p className="text-sm text-muted">Select dates to see available rooms</p>
          ) : availableRooms?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => toggleRoom(room)}
                  className={`text-left border rounded-lg p-4 transition-colors ${
                    selectedRooms.some((item) => item.id === room.id)
                      ? 'border-accent bg-tint text-ink ring-2 ring-accent'
                      : 'hover:border-line'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">{room.roomNumber}</span>
                    {selectedRooms.some((item) => item.id === room.id) && <Check className="h-5 w-5 text-gold" />}
                  </div>
                  <p className="text-sm text-muted">{room.roomType.name} • Sleeps {room.roomType.maxOccupancy}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No rooms available for selected dates</p>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink mb-1">4. Day package</h2>
        <p className="text-sm text-muted mb-4">Price is per paying guest. Children under 5 are not charged.</p>
        <div className="space-y-2">
          {(packages || []).map((item) => (
            <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm ${packageId === item.id ? 'border-accent bg-tint text-ink' : 'text-ink'}`}>
              <input type="radio" className="mt-1" name="package" checked={packageId === item.id} onChange={() => setPackageId(item.id)} />
              <span>
                <span className="font-medium">{formatCurrency(Number(item.pricePerPerson))} per person · {item.startsAt} to {item.endsAt}</span>
                <span className="block text-xs text-muted">{item.includes}</span>
              </span>
            </label>
          ))}
          {!packages?.length && <p className="text-sm text-muted">Day packages are not loaded yet.</p>}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink mb-1">5. Amenities</h2>
        <p className="text-sm text-muted mb-3">Included with every package</p>
        <ul className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-1 text-sm text-ink">
          {includedAmenities.map((amenity) => (
            <li key={amenity.id}>{amenity.name}</li>
          ))}
        </ul>
        <p className="text-sm text-muted mb-3">Paid add-ons</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {addonAmenities.map((amenity) => {
            const checked = selectedAmenityIds.includes(amenity.id);
            const unit = amenity.chargeType === 'PER_PERSON' ? 'per person' : 'each';
            return (
              <div key={amenity.id} className="rounded-lg border px-3 py-2 text-sm">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="mt-1" checked={checked} onChange={() => toggleAmenity(amenity)} />
                  <span>
                    <span className="font-medium">{amenity.name}</span>
                    {Number(amenity.price) > 0 && <span className="text-muted"> · {formatCurrency(Number(amenity.price))} {unit}</span>}
                    {amenity.description && <span className="block text-xs text-muted">{amenity.description}</span>}
                  </span>
                </label>
                {checked && (
                  <div className="mt-2 flex items-center gap-2 pl-7">
                    <Label className="text-xs">{amenity.chargeType === 'PER_PERSON' ? 'People' : 'Quantity'}</Label>
                    <Input
                      type="number"
                      min={1}
                      className="h-8 w-20"
                      value={amenityQty[amenity.id] || 1}
                      onChange={(e) => setAmenityQty({ ...amenityQty, [amenity.id]: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">6. Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Rooms</span>
            <span className="text-right">{selectedRooms.length ? selectedRooms.map((room) => room.roomNumber).join(', ') : '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">{sameDay ? 'Visit' : 'Nights'}</span>
            <span>{sameDay ? 'Same day' : nights}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">People</span>
            <span>{partySize} total · {payingGuests} paying · {Math.min(underFive, partySize)} under 5 · beds {bedCapacity}</span>
          </div>
          {extraGuests.length > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-muted">Named guests</span>
              <span className="text-right">{[selectedGuest ? `${selectedGuest.firstName} ${selectedGuest.lastName}` : '', ...extraGuests].filter(Boolean).join(', ')}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted">Package</span>
            <span>{selectedPackage ? `${formatCurrency(Number(selectedPackage.pricePerPerson))} × ${payingGuests}` : '-'}</span>
          </div>
          <div className="border-t pt-2 flex justify-between font-semibold text-base">
            <span>Total</span>
            <span className="text-ink">{formatCurrency(totalAmount)}</span>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">7. Special Requests</h2>
        <Textarea
          placeholder="Any special requests or notes..."
          value={specialRequests}
          onChange={(e) => setSpecialRequests(e.target.value)}
          rows={3}
        />
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/bookings')}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          disabled={createBooking.isPending}
        >
          {createBooking.isPending ? 'Creating...' : 'Create Booking'}
        </Button>
      </div>

      <Dialog open={showGuestDialog} onOpenChange={setShowGuestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Guest</DialogTitle>
          </DialogHeader>
          <form noValidate onSubmit={guestForm.handleSubmit(handleCreateGuest)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First Name</Label>
                <Input {...guestForm.register('firstName')} />
                {guestForm.formState.errors.firstName && (
                  <p className="text-xs text-danger">{guestForm.formState.errors.firstName.message as string}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Last Name</Label>
                <Input {...guestForm.register('lastName')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Controller
                control={guestForm.control}
                name="phone"
                defaultValue=""
                render={({ field }) => <PhoneField value={field.value} onChange={field.onChange} />}
              />
              {guestForm.formState.errors.phone && (
                <p className="text-xs text-danger">{guestForm.formState.errors.phone.message as string}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Email (optional)</Label>
              <Input type="text" inputMode="email" autoComplete="email" placeholder="name@email.com" {...guestForm.register('email')} />
              {guestForm.formState.errors.email && (
                <p className="text-xs text-danger">{guestForm.formState.errors.email.message as string}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>ID Type</Label>
                <select {...guestForm.register('idType')} className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink">
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
                <Input {...guestForm.register('idNumber')} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowGuestDialog(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
