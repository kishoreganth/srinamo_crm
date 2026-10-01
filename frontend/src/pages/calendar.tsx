import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCalendarData } from '@/hooks/useBookings';
import { useRooms } from '@/hooks/useRooms';
import { navigate } from '@/lib/navigate';
import { cn } from '@/lib/utils';
import type { Booking, InventoryBlock, Room } from '@/types';
import { useCreateBlock } from '@/hooks/useCrm';
import { toast } from 'sonner';

interface CalendarBooking extends Booking {
  startCol: number;
  span: number;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
  const lastDay = new Date(year, month, daysInMonth).toISOString().split('T')[0];

  const { data: calendarData, isLoading: calLoading } = useCalendarData(firstDay, lastDay);
  const { data: rooms, isLoading: roomsLoading } = useRooms();
  const createBlock = useCreateBlock();

  const dates = useMemo(() =>
    Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return { date: d, day: i + 1, weekday: d.toLocaleDateString('en', { weekday: 'short' }) };
    }),
  [year, month, daysInMonth]);

  const roomsByType = useMemo(() => {
    if (!rooms) return {};
    const grouped: Record<string, Room[]> = {};
    rooms.forEach((r) => {
      const typeName = r.roomType.name;
      if (!grouped[typeName]) grouped[typeName] = [];
      grouped[typeName].push(r);
    });
    return grouped;
  }, [rooms]);

  const bookingsByRoom = useMemo(() => {
    if (!calendarData?.bookings) return {};
    const map: Record<string, CalendarBooking[]> = {};
    calendarData.bookings.forEach((b) => {
      const checkIn = new Date(b.checkIn);
      const checkOut = new Date(b.checkOut);
      const startCol = Math.max(1, checkIn.getDate() - (checkIn.getMonth() === month && checkIn.getFullYear() === year ? 0 : checkIn.getDate()) + (checkIn.getMonth() < month || checkIn.getFullYear() < year ? 1 : checkIn.getDate()));
      const startDay = checkIn.getMonth() === month && checkIn.getFullYear() === year ? checkIn.getDate() : 1;
      const endDay = checkOut.getMonth() === month && checkOut.getFullYear() === year ? checkOut.getDate() : daysInMonth;
      const span = endDay - startDay + 1;
      if (!map[b.roomId]) map[b.roomId] = [];
      map[b.roomId].push({ ...b, startCol: startDay, span });
    });
    return map;
  }, [calendarData, month, year, daysInMonth]);

  const blocksByRoom = useMemo(() => {
    const map: Record<string, { id: string; startCol: number; span: number; source: string }[]> = {};
    (calendarData?.blocks || []).forEach((blk: InventoryBlock) => {
      const start = new Date(blk.start);
      const end = new Date(blk.end);
      const startDay = start.getMonth() === month && start.getFullYear() === year ? start.getDate() : 1;
      const endDay = end.getMonth() === month && end.getFullYear() === year ? end.getDate() : daysInMonth;
      const item = { id: blk.id, startCol: startDay, span: Math.max(1, endDay - startDay + 1), source: blk.source };
      if (!blk.roomId) {
        (rooms || []).forEach((r) => {
          if (!map[r.id]) map[r.id] = [];
          map[r.id].push(item);
        });
      } else {
        if (!map[blk.roomId]) map[blk.roomId] = [];
        map[blk.roomId].push(item);
      }
    });
    return map;
  }, [calendarData, month, year, daysInMonth, rooms]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const statusColors: Record<string, string> = {
    CONFIRMED: 'bg-emerald-500',
    CHECKED_IN: 'bg-blue-500',
    CHECKED_OUT: 'bg-gray-400',
  };

  if (calLoading || roomsLoading) {
    return <div className="p-6"><Skeleton className="h-[600px]" /></div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-lg font-semibold min-w-[160px] text-center">
            {currentDate.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
          </h2>
          <Button size="sm" variant="outline" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            const start = new Date().toISOString();
            const end = new Date(Date.now() + 15 * 60 * 1000).toISOString();
            createBlock.mutate({ start, end, holdMinutes: 15, source: 'HOLD' }, { onSuccess: () => toast.success('15-minute hold placed'), onError: () => toast.error('Hold failed') });
          }}>Hold 15 min</Button>
          <Button size="sm" variant="outline" onClick={goToday}>Today</Button>
        </div>
      </div>

      <Card className="overflow-auto">
        <div className="min-w-[1200px]">
          <div className="grid" style={{ gridTemplateColumns: `140px repeat(${daysInMonth}, 1fr)` }}>
            <div className="sticky left-0 z-10 bg-gray-50 border-b border-r p-2 text-xs font-medium text-gray-500">
              Room
            </div>
            {dates.map((d) => (
              <div
                key={d.day}
                className={cn(
                  'border-b border-r p-1 text-center text-xs',
                  d.weekday === 'Sun' || d.weekday === 'Sat' ? 'bg-gray-50' : 'bg-white'
                )}
              >
                <div className="font-medium">{d.day}</div>
                <div className="text-gray-400">{d.weekday}</div>
              </div>
            ))}

            {Object.entries(roomsByType).map(([typeName, typeRooms]) => (
              <>
                <div
                  key={`header-${typeName}`}
                  className="sticky left-0 z-10 bg-gray-100 border-b border-r px-2 py-1 text-xs font-semibold text-gray-700"
                  style={{ gridColumn: `1 / -1` }}
                >
                  {typeName}
                </div>
                {typeRooms.map((room) => (
                  <div key={room.id} className="contents">
                    <div className="sticky left-0 z-10 bg-white border-b border-r px-2 py-2 text-sm font-medium">
                      {room.roomNumber}
                    </div>
                    <div
                      className="relative border-b"
                      style={{ gridColumn: `2 / -1`, display: 'grid', gridTemplateColumns: `repeat(${daysInMonth}, 1fr)` }}
                    >
                      {dates.map((d) => (
                        <div
                          key={d.day}
                          className="border-r h-10 cursor-pointer hover:bg-emerald-50"
                          onClick={() => navigate(`/bookings/new?room=${room.id}&date=${year}-${String(month + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`)}
                        />
                      ))}
                      {blocksByRoom[room.id]?.map((blk) => (
                        <div
                          key={blk.id}
                          className="absolute top-1 h-8 rounded-md bg-amber-400/80 text-amber-950 text-xs flex items-center px-2 truncate"
                          style={{
                            left: `${((blk.startCol - 1) / daysInMonth) * 100}%`,
                            width: `${(blk.span / daysInMonth) * 100}%`,
                          }}
                          title={blk.source}
                        >
                          {blk.source}
                        </div>
                      ))}
                      {bookingsByRoom[room.id]?.map((b) => (
                        <div
                          key={b.id}
                          className={cn(
                            'absolute top-1 h-8 rounded-md text-white text-xs flex items-center px-2 cursor-pointer truncate',
                            statusColors[b.status] || 'bg-gray-400'
                          )}
                          style={{
                            left: `${((b.startCol - 1) / daysInMonth) * 100}%`,
                            width: `${(b.span / daysInMonth) * 100}%`,
                          }}
                          title={`${b.guest?.firstName} ${b.guest?.lastName}`}
                          onClick={(e) => { e.stopPropagation(); navigate(`/bookings/${b.id}`); }}
                        >
                          {b.guest?.firstName} {b.guest?.lastName}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-emerald-500" /> Confirmed</div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-blue-500" /> Checked In</div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-gray-400" /> Checked Out</div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-amber-400" /> Block / OTA / Hold</div>
      </div>
    </div>
  );
}
