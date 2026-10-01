import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Room, RoomType } from '@/types';

export function useRoomTypes() {
  return useQuery({
    queryKey: ['roomTypes'],
    queryFn: async () => {
      const res = await api.get<RoomType[]>('/room-types');
      return res.data;
    },
  });
}

export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const res = await api.get<Room[]>('/rooms');
      return res.data;
    },
  });
}

export function useRoomStatusBoard() {
  return useQuery({
    queryKey: ['rooms', 'status-board'],
    queryFn: async () => {
      const res = await api.get('/rooms/status-board');
      return res.data;
    },
  });
}

export function useAvailableRooms(checkIn?: string, checkOut?: string, roomTypeId?: string) {
  return useQuery({
    queryKey: ['rooms', 'available', checkIn, checkOut, roomTypeId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (checkIn) params.checkIn = checkIn;
      if (checkOut) params.checkOut = checkOut;
      if (roomTypeId) params.roomTypeId = roomTypeId;
      const res = await api.get<Room[]>('/rooms/available', { params });
      return res.data;
    },
    enabled: !!checkIn && !!checkOut,
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Room>) => {
      const res = await api.post('/rooms', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useUpdateRoomStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/rooms/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useCreateRoomType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<RoomType>) => {
      const res = await api.post('/room-types', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roomTypes'] });
    },
  });
}

export function useUpdateRoomType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<RoomType> & { id: string }) => {
      const res = await api.patch(`/room-types/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roomTypes'] });
    },
  });
}
