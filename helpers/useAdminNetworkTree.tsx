import { useQuery } from '@tanstack/react-query';
import { getAdminNetworkTree } from '../endpoints/admin/network-tree_GET.schema';

export const useAdminNetworkTree = () => {
  return useQuery({
    queryKey: ['admin', 'network-tree'],
    queryFn: () => getAdminNetworkTree()
  });
};