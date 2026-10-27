import api from '@/lib/api';

export async function openPrivateFile(url: string) {
  const name = url.split('?')[0].split('/').pop() || '';
  const path = url.includes('/api/') ? url.replace(/^.*\/api/, '') : `/upload/id-document/${name}`;
  const res = await api.get(path, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(res.data);
  window.open(blobUrl, '_blank', 'noopener');
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
