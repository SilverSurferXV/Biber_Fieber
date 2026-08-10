import { z } from "zod";
import superjson from 'superjson';

export const schema = z.object({});

export type TreeNode = {
  id: number;
  name: string;
  bibercode: string | null;
  childCount: number;
  children: TreeNode[];
};

export type OutputType = {
  trees: TreeNode[];
  totalUsers: number;
};

export const getAdminNetworkTree = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/network-tree`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  
  return superjson.parse<OutputType>(await result.text());
};