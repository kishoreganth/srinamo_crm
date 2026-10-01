import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Activity, ActivityBooking, CreateActivityBookingRequest } from '@/types';

export function useActivities() {
  return useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const res = await api.get<Activity[]>('/activities');
      return res.data;
    },
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Activity>) => {
      const res = await api.post('/activities', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useUpdateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Activity> & { id: string }) => {
      const res = await api.patch(`/activities/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useActivityBookings() {
  return useQuery({
    queryKey: ['activities', 'bookings'],
    queryFn: async () => {
      const res = await api.get<ActivityBooking[]>('/activities/bookings');
      return res.data;
    },
  });
}

export function useBookActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateActivityBookingRequest) => {
      const res = await api.post('/activities/bookings', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities', 'bookings'] });
    },
  });
}
