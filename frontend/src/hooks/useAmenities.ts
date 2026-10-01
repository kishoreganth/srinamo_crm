import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Amenity } from '@/types';

export function useAmenities(includeInactive = false) {
  return useQuery({
    queryKey: ['amenities', includeInactive],
    queryFn: async () => {
      const res = await api.get<Amenity[]>('/amenities', { params: includeInactive ? { all: 1 } : {} });
      return res.data;
    },
  });
}

export function useSaveAmenity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id?: string; name: string; description?: string; price: number; isActive: boolean; chargeType?: string; included?: boolean }) => {
      if (data.id) {
        const res = await api.patch<Amenity>(`/amenities/${data.id}`, data);
        return res.data;
      }
      const res = await api.post<Amenity>('/amenities', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['amenities'] }),
  });
}

export function useDisableAmenity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/amenities/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['amenities'] }),
  });
}
