import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { DashboardData } from '@/types';
import {
  foodSalesView,
  guestAnalyticsView,
  occupancySeries,
  revenueGrandTotal,
  revenueSeries,
} from '@/lib/report-series';

export function useDashboard() {
  return useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: async () => {
      const res = await api.get<DashboardData>('/reports/dashboard');
      return res.data;
    },
  });
}

export function useOccupancyReport(from?: string, to?: string, enabled = true) {
  return useQuery({
    queryKey: ['reports', 'occupancy', from, to],
    queryFn: async () => {
      const res = await api.get('/reports/occupancy', { params: { from, to } });
      return occupancySeries(res.data);
    },
    enabled: !!from && !!to && enabled,
  });
}

export function useRevenueReport(from?: string, to?: string, enabled = true) {
  return useQuery({
    queryKey: ['reports', 'revenue', from, to],
    queryFn: async () => {
      const res = await api.get('/reports/revenue', { params: { from, to } });
      const rows = revenueSeries(res.data);
      return { rows, total: revenueGrandTotal(res.data, rows) };
    },
    enabled: !!from && !!to && enabled,
  });
}

export function useFoodSalesReport(from?: string, to?: string) {
  return useQuery({
    queryKey: ['reports', 'food-sales', from, to],
    queryFn: async () => {
      const res = await api.get('/reports/food-sales', { params: { from, to } });
      return foodSalesView(res.data);
    },
    enabled: !!from && !!to,
  });
}

export function useGuestAnalytics() {
  return useQuery({
    queryKey: ['reports', 'guest-analytics'],
    queryFn: async () => {
      const res = await api.get('/reports/guest-analytics');
      return guestAnalyticsView(res.data);
    },
  });
}
