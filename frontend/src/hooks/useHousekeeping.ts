import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { HousekeepingTask, CreateHousekeepingTaskRequest } from '@/types';

export function useHousekeepingBoard() {
  return useQuery({
    queryKey: ['housekeeping', 'board'],
    queryFn: async () => {
      const res = await api.get('/housekeeping/board');
      return res.data;
    },
  });
}

export function useHousekeepingTasks(filters?: { status?: string; type?: string }) {
  return useQuery({
    queryKey: ['housekeeping', 'tasks', filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters?.status) params.status = filters.status;
      if (filters?.type) params.type = filters.type;
      const res = await api.get<HousekeepingTask[]>('/housekeeping/tasks', { params });
      return res.data;
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateHousekeepingTaskRequest) => {
      const res = await api.post('/housekeeping/tasks', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['housekeeping'] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<HousekeepingTask> & { id: string }) => {
      const res = await api.patch(`/housekeeping/tasks/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['housekeeping'] });
    },
  });
}
