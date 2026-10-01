import { CalendarDays, BedDouble, IndianRupee, UserCheck } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDashboard, useOccupancyReport, useRevenueReport } from '@/hooks/useReports';
import { useUpdateBookingStatus } from '@/hooks/useBookings';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { navigate } from '@/lib/navigate';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();
  const updateStatus = useUpdateBookingStatus();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const { data: occupancyData } = useOccupancyReport(
    thirtyDaysAgo.toISOString().split('T')[0],
    today.toISOString().split('T')[0],
    isAdmin
  );
  const { data: revenueData } = useRevenueReport(
    sevenDaysAgo.toISOString().split('T')[0],
    today.toISOString().split('T')[0],
    isAdmin
  );

  const handleCheckIn = async (id: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: 'CHECKED_IN' });
      toast.success('Guest checked in successfully');
    } catch {
      toast.error('Failed to check in');
    }
  };

  const handleCheckOut = async (id: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: 'CHECKED_OUT' });
      toast.success('Guest checked out successfully');
    } catch {
      toast.error('Failed to check out');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    AVAILABLE: 'bg-emerald-400',
    OCCUPIED: 'bg-blue-400',
    CLEANING: 'bg-yellow-400',
    MAINTENANCE: 'bg-red-400',
    INSPECTED: 'bg-purple-400',
  };

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Today's Bookings"
          value={data?.bookingsToday ?? 0}
          icon={CalendarDays}
          className="border-l-4 border-l-blue-500"
        />
        <StatCard
          label="Occupancy Rate"
          value={`${data?.occupancyRate ?? 0}%`}
          icon={BedDouble}
          className="border-l-4 border-l-emerald-500"
        />
        {isAdmin && (
          <StatCard
            label="Revenue Today"
            value={formatCurrency(data?.revenueToday ?? 0)}
            icon={IndianRupee}
            className="border-l-4 border-l-amber-500"
          />
        )}
        <StatCard
          label="Pending Check-ins"
          value={data?.pendingCheckIns ?? 0}
          icon={UserCheck}
          className="border-l-4 border-l-purple-500"
        />
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Occupancy Trend (30 days)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={occupancyData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Occupancy']} />
                <Line type="monotone" dataKey="rate" stroke="#059669" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue This Week</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [formatCurrency(v)]} />
                <Bar dataKey="room" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="food" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="activities" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Today's Arrivals</h3>
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
                    <TableCell className="font-medium">
                      {b.guest.firstName} {b.guest.lastName}
                    </TableCell>
                    <TableCell>{b.room.roomNumber}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(b.status)}>{b.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {b.status === 'CONFIRMED' && (
                        <Button size="sm" variant="outline" onClick={() => handleCheckIn(b.id)}>
                          Check In
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No arrivals today</p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Today's Departures</h3>
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
                    <TableCell className="font-medium">
                      {b.guest.firstName} {b.guest.lastName}
                    </TableCell>
                    <TableCell>{b.room.roomNumber}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(b.status)}>{b.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {b.status === 'CHECKED_IN' && (
                        <Button size="sm" variant="outline" onClick={() => handleCheckOut(b.id)}>
                          Check Out
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No departures today</p>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Room Status Overview</h3>
        <div className="flex flex-wrap gap-4">
          {data?.roomStatusCounts?.map((s) => (
            <div key={s.status} className="flex items-center gap-2">
              <div className={`h-4 w-4 rounded ${statusColors[s.status] || 'bg-gray-400'}`} />
              <span className="text-sm text-gray-600">{s.status}</span>
              <span className="text-sm font-bold text-gray-900">{s.count}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {data?.roomStatusCounts?.flatMap((s) =>
            Array.from({ length: s.count }, (_, i) => (
              <div
                key={`${s.status}-${i}`}
                className={`h-6 w-6 rounded ${statusColors[s.status] || 'bg-gray-300'}`}
                title={s.status}
              />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
