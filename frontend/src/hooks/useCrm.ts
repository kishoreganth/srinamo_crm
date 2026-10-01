import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Commission, EventDeal, InventoryBlock, Lead, LeadStage, MessageOutbox, Partner, Scoreboard } from '@/types';

export function useLeadBoard() {
  return useQuery({
    queryKey: ['leads', 'board'],
    queryFn: async () => {
      const res = await api.get<{ board: Record<LeadStage, Lead[]>; dueToday: Lead[] }>('/leads/board');
      return res.data;
    },
  });
}

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const res = await api.get<{ data: Lead[] }>('/leads', { params: { limit: 100 } });
      return res.data.data;
    },
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Lead>) => {
      const res = await api.post<Lead>('/leads', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Lead> & { id: string }) => {
      const res = await api.patch<Lead>(`/leads/${id}`, data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useLeadAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, body }: { id: string; action: string; body?: Record<string, unknown> }) => {
      const res = await api.post(`/leads/${id}/${action}`, body || {});
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function usePartners() {
  return useQuery({
    queryKey: ['partners'],
    queryFn: async () => {
      const res = await api.get<Partner[]>('/partners');
      return res.data;
    },
  });
}

export function useCreatePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Partner>) => {
      const res = await api.post<Partner>('/partners', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partners'] }),
  });
}

export function useCommissions() {
  return useQuery({
    queryKey: ['commissions'],
    queryFn: async () => {
      const res = await api.get<{ data: Commission[]; dueTotal: number }>('/partners/commissions');
      return res.data;
    },
  });
}

export function usePayCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/partners/commissions/${id}/pay`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  });
}

export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const res = await api.get<EventDeal[]>('/events');
      return res.data;
    },
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<EventDeal>) => {
      const res = await api.post<EventDeal>('/events', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useHoldEventRooms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; roomId?: string; nights?: number; exclusive?: boolean }) => {
      const res = await api.post(`/events/${id}/hold-rooms`, body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['bookings', 'calendar'] });
    },
  });
}

export function useMessages(relatedType?: string, relatedId?: string) {
  return useQuery({
    queryKey: ['messages', relatedType, relatedId],
    queryFn: async () => {
      const res = await api.get<MessageOutbox[]>('/actions/messages', { params: { relatedType, relatedId } });
      return res.data;
    },
    enabled: !!relatedType && !!relatedId,
  });
}

export function useSendAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ path, force }: { path: string; force?: boolean }) => {
      const res = await api.post(path, { force: !!force });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  });
}

export function useImportGuests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, commit }: { file: File; commit: boolean }) => {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post(`/guests/import?commit=${commit}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: (_, vars) => {
      if (vars.commit) qc.invalidateQueries({ queryKey: ['guests'] });
    },
  });
}

export function useInventoryBlocks(from?: string, to?: string) {
  return useQuery({
    queryKey: ['inventory', from, to],
    queryFn: async () => {
      const res = await api.get<InventoryBlock[]>('/inventory/blocks', { params: { from, to } });
      return res.data;
    },
    enabled: !!from && !!to,
  });
}

export function useCreateBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { roomId?: string; start: string; end: string; source?: string; holdMinutes?: number }) => {
      const res = await api.post('/inventory/blocks', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['bookings', 'calendar'] });
    },
  });
}

export function useReleaseBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/inventory/blocks/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['bookings', 'calendar'] });
    },
  });
}

export function useScoreboard() {
  return useQuery({
    queryKey: ['reports', 'scoreboard'],
    queryFn: async () => {
      const res = await api.get<Scoreboard>('/reports/scoreboard');
      return res.data;
    },
  });
}
