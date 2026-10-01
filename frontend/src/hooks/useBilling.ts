import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { FolioItem, Payment, Invoice, CreateFolioItemRequest, CreatePaymentRequest } from '@/types';

export function useFolioItems(bookingId?: string) {
  return useFolio(bookingId);
}

export function useFolio(bookingId?: string) {
  return useQuery({
    queryKey: ['billing', 'folio', bookingId],
    queryFn: async () => {
      const res = await api.get<{ items: FolioItem[] }>(`/billing/folio/${bookingId}`);
      return res.data.items;
    },
    enabled: !!bookingId,
  });
}

export function useAddFolioItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateFolioItemRequest) => {
      const res = await api.post(`/billing/folio/${data.bookingId}/item`, {
        description: data.description,
        category: data.category,
        amount: data.amount,
        quantity: data.quantity ?? 1,
      });
      return res.data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['billing', 'folio', variables.bookingId] });
      qc.invalidateQueries({ queryKey: ['billing', 'summary', variables.bookingId] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function usePayments(bookingId?: string) {
  return useQuery({
    queryKey: ['billing', 'payments', bookingId],
    queryFn: async () => {
      const res = await api.get<Payment[]>(`/billing/payments/${bookingId}`);
      return res.data;
    },
    enabled: !!bookingId,
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePaymentRequest) => {
      const res = await api.post('/billing/payments', data);
      return res.data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['billing', 'payments', variables.bookingId] });
      qc.invalidateQueries({ queryKey: ['billing', 'summary', variables.bookingId] });
      qc.invalidateQueries({ queryKey: ['bookings', variables.bookingId] });
    },
  });
}

export function usePaymentSummary(bookingId?: string) {
  return useQuery({
    queryKey: ['billing', 'summary', bookingId],
    queryFn: async () => {
      const res = await api.get(`/billing/summary/${bookingId}`);
      return res.data;
    },
    enabled: !!bookingId,
  });
}

export function useGenerateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { bookingId: string; type?: string }) => {
      const res = await api.post<Invoice>('/billing/invoices', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}

export function useInvoice(id?: string) {
  return useQuery({
    queryKey: ['billing', 'invoices', id],
    queryFn: async () => {
      const res = await api.get<Invoice>(`/billing/invoices/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}
