import { OutputType, TreeNode } from "./network-tree_GET.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const session = await getServerUserSession(request);
    
    if (session.user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const users = await db
      .selectFrom("users")
      .select([
        "id", 
        "displayName", 
        "firstName", 
        "lastName", 
        "bibercode", 
        "referredByBibercode"
      ])
      .execute();

    const nodesMap = new Map<string, TreeNode>();
    const allNodes: TreeNode[] = [];
    const roots: TreeNode[] = [];

    // First pass: create node objects
    for (const u of users) {
      const name = (u.firstName || u.lastName) 
        ? `${u.firstName || ''} ${u.lastName || ''}`.trim() 
        : u.displayName;
        
      const node: TreeNode = {
        id: u.id,
        name,
        bibercode: u.bibercode,
        childCount: 0,
        children: []
      };
      
      allNodes.push(node);
      
      if (u.bibercode) {
        nodesMap.set(u.bibercode.toLowerCase(), node);
      }
    }

    // Second pass: attach to parents
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const node = allNodes[i];
      let isRoot = true;

      if (u.referredByBibercode) {
        const parent = nodesMap.get(u.referredByBibercode.toLowerCase());
        if (parent) {
          parent.children.push(node);
          parent.childCount++;
          isRoot = false;
        }
      }

      // Root nodes are users who have a bibercode but are not children of any other node
      if (isRoot && u.bibercode) {
        roots.push(node);
      }
    }

    // Sort children by child count recursively to put larger branches on the left
    const sortTree = (node: TreeNode) => {
      node.children.sort((a, b) => b.childCount - a.childCount);
      node.children.forEach(sortTree);
    };

    roots.sort((a, b) => b.childCount - a.childCount);
    roots.forEach(sortTree);

    return new Response(superjson.stringify({
      trees: roots,
      totalUsers: users.length
    } satisfies OutputType));

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: message }), { status: 500 });
  }
}