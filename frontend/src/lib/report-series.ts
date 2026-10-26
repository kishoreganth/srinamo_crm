export interface OccupancyPoint {
  date: string;
  rate: number;
}

export interface RevenuePoint {
  date: string;
  room: number;
  food: number;
  activities: number;
}

export interface FoodItemRow {
  name: string;
  quantity: number;
  revenue: number;
}

export interface FoodCategoryRow {
  category: string;
  quantity: number;
  revenue: number;
}

export interface FoodSalesView {
  topItems: FoodItemRow[];
  categories: FoodCategoryRow[];
}

export interface SpenderRow {
  name: string;
  stays: number;
  totalSpent: number;
}

export interface GuestAnalyticsView {
  totalGuests: number;
  newThisMonth: number;
  repeatGuests: number;
  topSpenders: SpenderRow[];
  cityDistribution: { city: string; count: number }[];
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function rowsOf(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object');
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return ((payload as { data: unknown[] }).data).filter((row): row is Record<string, unknown> => !!row && typeof row === 'object');
  }
  return [];
}

export function occupancySeries(payload: unknown): OccupancyPoint[] {
  return rowsOf(payload).map((row) => ({
    date: String(row.date ?? ''),
    rate: asNumber(row.rate ?? row.occupancy),
  }));
}

export function revenueSeries(payload: unknown): RevenuePoint[] {
  return rowsOf(payload).map((row) => ({
    date: String(row.date ?? ''),
    room: asNumber(row.room ?? row.ROOM),
    food: asNumber(row.food ?? row.FOOD),
    activities: asNumber(row.activities ?? row.ACTIVITY),
  }));
}

export function revenueGrandTotal(payload: unknown, series: RevenuePoint[]) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'grandTotal' in payload) {
    return asNumber((payload as { grandTotal?: unknown }).grandTotal);
  }
  return series.reduce((sum, row) => sum + row.room + row.food + row.activities, 0);
}

export function foodSalesView(payload: unknown): FoodSalesView {
  const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const topRaw = Array.isArray(body.topItems) ? body.topItems : [];
  const topItems = topRaw.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object').map((row) => ({
    name: String(row.name ?? ''),
    quantity: asNumber(row.quantity),
    revenue: asNumber(row.revenue),
  }));
  const totals = body.categoryTotals;
  const categories: FoodCategoryRow[] = [];
  if (totals && typeof totals === 'object' && !Array.isArray(totals)) {
    for (const [category, value] of Object.entries(totals as Record<string, unknown>)) {
      if (value && typeof value === 'object') {
        const item = value as Record<string, unknown>;
        categories.push({ category, quantity: asNumber(item.quantity), revenue: asNumber(item.revenue) });
      } else {
        categories.push({ category, quantity: 0, revenue: asNumber(value) });
      }
    }
  }
  return { topItems, categories };
}

export function guestAnalyticsView(payload: unknown): GuestAnalyticsView {
  const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const spendersRaw = Array.isArray(body.topBySpent) ? body.topBySpent : Array.isArray(body.topSpenders) ? body.topSpenders : [];
  const topSpenders = spendersRaw.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object').map((row) => ({
    name: String(row.name ?? `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim()),
    stays: asNumber(row.stays ?? row.totalStays),
    totalSpent: asNumber(row.totalSpent),
  }));
  const citiesRaw = Array.isArray(body.cityDistribution) ? body.cityDistribution : [];
  const cityDistribution = citiesRaw.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object').map((row) => ({
    city: String(row.city ?? ''),
    count: asNumber(row.count),
  }));
  return {
    totalGuests: asNumber(body.totalGuests),
    newThisMonth: asNumber(body.newGuestsThisMonth ?? body.newThisMonth),
    repeatGuests: asNumber(body.repeatGuests),
    topSpenders,
    cityDistribution,
  };
}
