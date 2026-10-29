import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface EnquiryRecording {
  id: string;
  originalName: string;
  sizeBytes: number;
  mime: string;
  createdAt?: string | null;
}

export interface EnquiryMatch {
  type: 'guest' | 'lead' | 'enquiry';
  id: string;
  name: string;
}

export interface Enquiry {
  id: string;
  callerName: string;
  phone: string;
  alternatePhone?: string | null;
  email?: string | null;
  enquiryType: string;
  source: string;
  preferredCheckIn?: string | null;
  preferredCheckOut?: string | null;
  adults: number;
  children: number;
  interest?: string | null;
  budget?: number | null;
  heardAbout?: string | null;
  callDirection: string;
  callAt?: string | null;
  durationSeconds?: number | null;
  takenByUserId?: string | null;
  takenBy?: { id: string; name: string } | null;
  status: string;
  nextFollowUpAt?: string | null;
  notes?: string | null;
  guestId?: string | null;
  bookingId?: string | null;
  canPlay?: boolean;
  recordings?: EnquiryRecording[];
  createdAt?: string;
}

export interface EnquiryFilters {
  page?: number;
  q?: string;
  status?: string;
  source?: string;
  from?: string;
  to?: string;
  due?: boolean;
}

export function useEnquiries(filters: EnquiryFilters) {
  return useQuery({
    queryKey: ['enquiries', filters],
    queryFn: async () => {
      const params: Record<string, string | number | boolean> = { page: filters.page || 1, limit: 20 };
      if (filters.q) params.q = filters.q;
      if (filters.status && filters.status !== 'ALL') params.status = filters.status;
      if (filters.source && filters.source !== 'ALL') params.source = filters.source;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.due) params.due = true;
      const res = await api.get<{ data: Enquiry[]; total: number; page: number; limit: number }>('/enquiries', { params });
      return res.data;
    },
  });
}

export function useEnquiry(id?: string) {
  return useQuery({
    queryKey: ['enquiries', id],
    queryFn: async () => {
      const res = await api.get<Enquiry>(`/enquiries/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useEnquiryLookup(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return useQuery({
    queryKey: ['enquiries', 'lookup', digits],
    queryFn: async () => {
      const res = await api.get<{ matches: EnquiryMatch[] }>('/enquiries/lookup', { params: { phone } });
      return res.data.matches;
    },
    enabled: digits.length >= 8,
  });
}

export function useSaveEnquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: Record<string, unknown> }) => {
      const res = id ? await api.patch<Enquiry>(`/enquiries/${id}`, body) : await api.post<Enquiry>('/enquiries', body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enquiries'] }),
  });
}

export function useConvertEnquiryGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<{ guestId: string; created: boolean }>(`/enquiries/${id}/guest`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enquiries'] });
      qc.invalidateQueries({ queryKey: ['guests'] });
    },
  });
}

export async function uploadEnquiryRecording(id: string, file: File, onProgress?: (pct: number) => void) {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post(`/enquiries/${id}/recordings`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
  return res.data as EnquiryRecording;
}
