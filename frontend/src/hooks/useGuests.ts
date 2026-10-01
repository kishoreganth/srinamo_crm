import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Guest, PaginatedResponse, CreateGuestRequest } from '@/types';

export function useGuests(page = 1, search?: string) {
  return useQuery({
    queryKey: ['guests', page, search],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      const res = await api.get<PaginatedResponse<Guest>>('/guests', { params });
      return res.data;
    },
  });
}

export function useGuest(id?: string) {
  return useQuery({
    queryKey: ['guests', id],
    queryFn: async () => {
      const res = await api.get<Guest>(`/guests/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateGuestRequest) => {
      const res = await api.post<Guest>('/guests', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
    },
  });
}

export function useUpdateGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Guest> & { id: string }) => {
      const res = await api.patch<Guest>(`/guests/${id}`, data);
      return res.data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.invalidateQueries({ queryKey: ['guests', variables.id] });
    },
  });
}

export function useGuestBookings(id?: string) {
  return useQuery({
    queryKey: ['guests', id, 'bookings'],
    queryFn: async () => {
      const res = await api.get(`/guests/${id}/history`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useSearchGuests(query?: string) {
  return useQuery({
    queryKey: ['guests', 'search', query],
    queryFn: async () => {
      const res = await api.get<Guest[]>('/guests/search', { params: { q: query } });
      return res.data;
    },
    enabled: !!query && query.length >= 2,
  });
}
