import { useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDashboard, useOccupancyReport, useRevenueReport, useFoodSalesReport, useGuestAnalytics } from '@/hooks/useReports';
import { useScoreboard } from '@/hooks/useCrm';
import { formatCurrency } from '@/lib/utils';
import { CalendarDays, BedDouble, IndianRupee, UserCheck, Users, UserPlus, Repeat } from 'lucide-react';

const COLORS = ['#059669', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

export default function ReportsPage() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [occFrom, setOccFrom] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [occTo, setOccTo] = useState(today.toISOString().split('T')[0]);
  const [revFrom, setRevFrom] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [revTo, setRevTo] = useState(today.toISOString().split('T')[0]);
  const [foodFrom, setFoodFrom] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [foodTo, setFoodTo] = useState(today.toISOString().split('T')[0]);

  const { data: dashboard, isLoading: dashLoading } = useDashboard();
  const { data: occupancy } = useOccupancyReport(occFrom, occTo);
  const { data: revenue } = useRevenueReport(revFrom, revTo);
  const { data: foodSales } = useFoodSalesReport(foodFrom, foodTo);
  const { data: guestAnalytics } = useGuestAnalytics();
  const { data: scoreboard } = useScoreboard();

  if (dashLoading) return <div className="p-6"><Skeleton className="h-96" /></div>;

  return (
    <div className="p-6 space-y-4">
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="food">Food Sales</TabsTrigger>
          <TabsTrigger value="guests">Guest Analytics</TabsTrigger>
          <TabsTrigger value="week">This week</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Today's Bookings" value={dashboard?.bookingsToday ?? 0} icon={CalendarDays} />
            <StatCard label="Occupancy Rate" value={`${dashboard?.occupancyRate ?? 0}%`} icon={BedDouble} />
            <StatCard label="Revenue Today" value={formatCurrency(dashboard?.revenueToday ?? 0)} icon={IndianRupee} />
            <StatCard label="Pending Check-ins" value={dashboard?.pendingCheckIns ?? 0} icon={UserCheck} />
          </div>
        </TabsContent>

        <TabsContent value="occupancy" className="mt-4 space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={occFrom} onChange={(e) => setOccFrom(e.target.value)} className="w-[160px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={occTo} onChange={(e) => setOccTo(e.target.value)} className="w-[160px]" />
              </div>
              {occupancy && (
                <div className="ml-auto text-right">
                  <p className="text-xs text-gray-500">Average Occupancy</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {(occupancy.reduce((s, d) => s + d.rate, 0) / occupancy.length).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={occupancy || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Occupancy']} />
                <Line type="monotone" dataKey="rate" stroke="#059669" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="mt-4 space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={revFrom} onChange={(e) => setRevFrom(e.target.value)} className="w-[160px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={revTo} onChange={(e) => setRevTo(e.target.value)} className="w-[160px]" />
              </div>
              {revenue && (
                <div className="ml-auto text-right">
                  <p className="text-xs text-gray-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {formatCurrency(revenue.reduce((s, d) => s + d.room + d.food + d.activities, 0))}
                  </p>
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={revenue || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [formatCurrency(v)]} />
                <Legend />
                <Bar dataKey="room" fill="#059669" name="Room" stackId="a" />
                <Bar dataKey="food" fill="#f59e0b" name="Food" stackId="a" />
                <Bar dataKey="activities" fill="#8b5cf6" name="Activities" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="food" className="mt-4 space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={foodFrom} onChange={(e) => setFoodFrom(e.target.value)} className="w-[160px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={foodTo} onChange={(e) => setFoodTo(e.target.value)} className="w-[160px]" />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold mb-3">Top Selling Items</h4>
                {(foodSales as any)?.topItems?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(foodSales as any).topItems.map((item: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{formatCurrency(item.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-gray-500">No data available</p>
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-3">Category Breakdown</h4>
                {(foodSales as any)?.categoryBreakdown?.length ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={(foodSales as any).categoryBreakdown}
                        dataKey="revenue"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                      >
                        {(foodSales as any).categoryBreakdown.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [formatCurrency(v)]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500">No data available</p>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="guests" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Total Guests" value={(guestAnalytics as any)?.totalGuests ?? 0} icon={Users} />
            <StatCard label="New This Month" value={(guestAnalytics as any)?.newThisMonth ?? 0} icon={UserPlus} />
            <StatCard label="Repeat Guests" value={(guestAnalytics as any)?.repeatGuests ?? 0} icon={Repeat} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <h4 className="text-sm font-semibold mb-3">Top 10 Spenders</h4>
              {(guestAnalytics as any)?.topSpenders?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Stays</TableHead>
                      <TableHead>Total Spent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(guestAnalytics as any).topSpenders.map((g: any) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{g.name}</TableCell>
                        <TableCell>{g.stays}</TableCell>
                        <TableCell>{formatCurrency(g.totalSpent)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-gray-500">No data available</p>
              )}
            </Card>
            <Card className="p-5">
              <h4 className="text-sm font-semibold mb-3">City Distribution</h4>
              {(guestAnalytics as any)?.cityDistribution?.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={(guestAnalytics as any).cityDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="city" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#059669" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-500">No data available</p>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Weekday occupancy" value={`${scoreboard?.weekdayOccupancy ?? 0}%`} icon={BedDouble} />
            <StatCard label="Weekend occupancy" value={`${scoreboard?.weekendOccupancy ?? 0}%`} icon={BedDouble} />
            <StatCard label="Lead win rate" value={`${scoreboard?.leadWinRate ?? 0}%`} icon={UserCheck} />
            <StatCard label="Commissions due" value={formatCurrency(scoreboard?.commissionsDue ?? 0)} icon={IndianRupee} />
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Week of {scoreboard?.weekStart || '—'} · {scoreboard?.leadsWon || 0}/{scoreboard?.leadsThisWeek || 0} leads won · {scoreboard?.outboxFailed || 0} failed WhatsApp sends
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
