import { CalendarDays, BedDouble, IndianRupee, UserCheck, Plus, LogIn, LogOut, UserPlus } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDashboard, useOccupancyReport, useRevenueReport } from '@/hooks/useReports';
import { useUpdateBookingStatus } from '@/hooks/useBookings';
import { useHousekeepingBoard } from '@/hooks/useHousekeeping';
import { formatCurrency, formatDate, getStatusColor, getStatusDot } from '@/lib/utils';
import { navigate } from '@/lib/navigate';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/page-header';
import { EmptyState, ErrorState } from '@/components/layout/empty-state';
import { ClipboardCheck } from 'lucide-react';

const chartTip = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)' };

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard();
  const updateStatus = useUpdateBookingStatus();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const { data: board } = useHousekeepingBoard();

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const from30 = thirtyDaysAgo.toISOString().split('T')[0];
  const from7 = sevenDaysAgo.toISOString().split('T')[0];
  const to = today.toISOString().split('T')[0];

  const { data: occupancyData } = useOccupancyReport(from30, to, isAdmin);
  const { data: revenue } = useRevenueReport(from7, to, isAdmin);

  const pendingRooms = (Array.isArray(board) ? board : []).filter((room: { pendingTasks?: number }) => (room.pendingTasks ?? 0) > 0).slice(0, 5);

  const runStatus = async (id: string, status: 'CHECKED_IN' | 'CHECKED_OUT', ok: string) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success(ok);
    } catch {
      toast.error('Could not update the booking');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (isError) return <div className="p-6"><ErrorState message="Dashboard could not be loaded." onRetry={() => refetch()} /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Today"
        description="Live occupancy, arrivals, and rooms."
        action={
          <>
            <Button onClick={() => navigate('/bookings/new')}><Plus className="h-4 w-4" /> New Booking</Button>
            <Button variant="outline" onClick={() => navigate('/guests')}><UserPlus className="h-4 w-4" /> New Guest</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Bookings" value={data?.bookingsToday ?? 0} icon={CalendarDays} />
        <StatCard label="Occupancy Rate" value={`${data?.occupancyRate ?? 0}%`} icon={BedDouble} />
        {isAdmin && <StatCard label="Revenue Today" value={formatCurrency(data?.revenueToday ?? 0)} icon={IndianRupee} />}
        <StatCard label="Pending Check-ins" value={data?.pendingCheckIns ?? 0} icon={UserCheck} />
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink">Occupancy, 30 days</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={occupancyData ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} unit="%" />
                <Tooltip contentStyle={chartTip} formatter={(v: number) => [`${v}%`, 'Occupancy']} />
                <Line type="monotone" dataKey="rate" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink">Revenue this week</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenue?.rows ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <Tooltip contentStyle={chartTip} formatter={(v: number) => [formatCurrency(v)]} />
                <Bar dataKey="room" fill="#1f6b45" radius={[4, 4, 0, 0]} />
                <Bar dataKey="food" fill="#8a6230" radius={[4, 4, 0, 0]} />
                <Bar dataKey="activities" fill="#3d6b8a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Today's arrivals</h3>
            <LogIn className="h-4 w-4 text-gold" />
          </div>
          {data?.todayArrivals?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.todayArrivals.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.guest?.firstName} {b.guest?.lastName}</TableCell>
                    <TableCell>{b.room?.roomNumber}</TableCell>
                    <TableCell><Badge className={getStatusColor(b.status)}>{b.status}</Badge></TableCell>
                    <TableCell>
                      {b.status === 'CONFIRMED' && (
                        <Button size="sm" variant="outline" onClick={() => runStatus(b.id, 'CHECKED_IN', 'Guest checked in')}>Check in</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <EmptyState icon={LogIn} title="No arrivals today" />}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Today's departures</h3>
            <LogOut className="h-4 w-4 text-gold" />
          </div>
          {data?.todayDepartures?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.todayDepartures.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.guest?.firstName} {b.guest?.lastName}</TableCell>
                    <TableCell>{b.room?.roomNumber}</TableCell>
                    <TableCell><Badge className={getStatusColor(b.status)}>{b.status}</Badge></TableCell>
                    <TableCell>
                      {b.status === 'CHECKED_IN' && (
                        <Button size="sm" variant="outline" onClick={() => runStatus(b.id, 'CHECKED_OUT', 'Guest checked out')}>Check out</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <EmptyState icon={LogOut} title="No departures today" />}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink">Room status</h3>
          <div className="flex flex-wrap gap-4">
            {data?.roomStatusCounts?.map((s) => (
              <div key={s.status} className="flex items-center gap-2">
                <div className={`h-4 w-4 rounded ${getStatusDot(s.status)}`} />
                <span className="text-sm text-muted">{s.status}</span>
                <span className="text-sm font-bold text-ink">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink">Pending housekeeping</h3>
          {pendingRooms.length ? (
            <ul className="space-y-2">
              {pendingRooms.map((room: { id: string; roomNumber: string; pendingTasks: number }) => (
                <li key={room.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">Room {room.roomNumber}</span>
                  <Badge variant="warning">{room.pendingTasks} open</Badge>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={ClipboardCheck} title="No open tasks" />}
          <Button variant="ghost" className="mt-2" onClick={() => navigate('/housekeeping')}>Open board</Button>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-ink">Recent bookings</h3>
        {data?.recentBookings?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentBookings.map((b) => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/bookings/${b.id}`)}>
                  <TableCell className="font-mono text-sm">{b.bookingCode}</TableCell>
                  <TableCell>{b.guest?.firstName} {b.guest?.lastName}</TableCell>
                  <TableCell>{b.room?.roomNumber}</TableCell>
                  <TableCell>{formatDate(b.checkIn)}</TableCell>
                  <TableCell><Badge className={getStatusColor(b.status)}>{b.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <EmptyState icon={CalendarDays} title="No recent bookings" />}
      </Card>
    </div>
  );
}
