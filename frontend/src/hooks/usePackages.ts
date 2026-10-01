import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { DayPackage } from '@/types';

export function usePackages() {
  return useQuery({
    queryKey: ['packages'],
    queryFn: async () => {
      const res = await api.get<DayPackage[]>('/packages');
      return res.data;
    },
  });
}

export function useUpdatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pkg: DayPackage) => {
      const res = await api.patch<DayPackage>(`/packages/${pkg.id}`, pkg);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
}
