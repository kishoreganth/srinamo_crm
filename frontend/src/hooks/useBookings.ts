import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Booking, PaginatedResponse, CreateBookingRequest } from '@/types';

interface BookingFilters {
  page?: number;
  status?: string;
  from?: string;
  to?: string;
  search?: string;
}

export function useBookings(filters: BookingFilters = {}) {
  return useQuery({
    queryKey: ['bookings', filters],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: filters.page || 1, limit: 20 };
      if (filters.status && filters.status !== 'ALL') params.status = filters.status;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.search) params.search = filters.search;
      const res = await api.get<PaginatedResponse<Booking>>('/bookings', { params });
      return res.data;
    },
  });
}

export function useBooking(id?: string) {
  return useQuery({
    queryKey: ['bookings', id],
    queryFn: async () => {
      const res = await api.get<Booking>(`/bookings/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateBookingRequest) => {
      const res = await api.post<Booking>('/bookings', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useUpdateBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: string;
      status: string;
      actualAdults?: number;
      actualChildren?: number;
      primaryIdDocumentUrl?: string;
      companions?: { guestName: string; idType?: string; idNumber?: string; idDocumentUrl?: string }[];
    }) => {
      const { id, ...body } = data;
      const res = await api.patch(`/bookings/${id}/status`, body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useUpdateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; checkIn?: string; checkOut?: string; roomId?: string; adults?: number; children?: number; specialRequests?: string }) => {
      const res = await api.put(`/bookings/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useCalendarData(from?: string, to?: string) {
  return useQuery({
    queryKey: ['bookings', 'calendar', from, to],
    queryFn: async () => {
      const res = await api.get('/bookings/calendar', { params: { from, to } });
      const data = res.data;
      if (Array.isArray(data)) return { bookings: data as Booking[], blocks: [] };
      return { bookings: (data.bookings || []) as Booking[], blocks: data.blocks || [] };
    },
    enabled: !!from && !!to,
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/bookings/${id}/status`, { status: 'CANCELLED' });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useTodayBookings() {
  return useQuery({
    queryKey: ['bookings', 'today'],
    queryFn: async () => {
      const res = await api.get('/bookings/today');
      return res.data;
    },
  });
}
