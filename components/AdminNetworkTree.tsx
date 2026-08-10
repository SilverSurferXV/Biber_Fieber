import React, { useState, useMemo } from 'react';
import { useAdminNetworkTree } from '../helpers/useAdminNetworkTree';
import { Skeleton } from './Skeleton';
import { TreeNode } from '../endpoints/admin/network-tree_GET.schema';
import styles from './AdminNetworkTree.module.css';

const V_SPACING = 120;
const MIN_WIDTH = 100;
const NODE_RADIUS = 30;

type RenderNode = {
  id: number;
  name: string;
  bibercode: string | null;
  childCount: number;
  x: number;
  y: number;
  isCollapsed: boolean;
  hasChildren: boolean;
};

type RenderLine = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function getInitials(name: string) {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export const AdminNetworkTree = () => {
  const { data, isFetching, error } = useAdminNetworkTree();
  const [collapsedNodes, setCollapsedNodes] = useState<Set<number>>(new Set());

  const toggleCollapse = (id: number) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const layout = useMemo(() => {
    if (!data?.trees || data.trees.length === 0) return null;

    const renderNodes: RenderNode[] = [];
    const renderLines: RenderLine[] = [];
    
    let currentX = 0;
    let maxDepth = 0;
    const widthMap = new Map<number, number>();

    // Calculate required width for each node branch
    const computeWidth = (node: TreeNode): number => {
      const isCollapsed = collapsedNodes.has(node.id);
      if (isCollapsed || !node.children || node.children.length === 0) {
        widthMap.set(node.id, MIN_WIDTH);
        return MIN_WIDTH;
      }
      let w = 0;
      for (const c of node.children) {
        w += computeWidth(c);
      }
      const finalW = Math.max(w, MIN_WIDTH);
      widthMap.set(node.id, finalW);
      return finalW;
    };

    data.trees.forEach(computeWidth);

    // Assign X and Y coordinates recursively based on computed branch widths
    const assignCoords = (node: TreeNode, startX: number, y: number, depth: number) => {
      if (depth > maxDepth) maxDepth = depth;
      
      const nodeW = widthMap.get(node.id) || MIN_WIDTH;
      const x = startX + nodeW / 2;
      const isCollapsed = collapsedNodes.has(node.id);
      const hasChildren = node.children && node.children.length > 0;

      renderNodes.push({
        id: node.id,
        name: node.name,
        bibercode: node.bibercode,
        childCount: node.childCount,
        x,
        y,
        isCollapsed,
        hasChildren
      });

      if (!isCollapsed && hasChildren) {
        let childX = startX;
        for (const c of node.children) {
          const childW = widthMap.get(c.id) || MIN_WIDTH;
          const cx = childX + childW / 2;
          const cy = y + V_SPACING;

          renderLines.push({
            id: `${node.id}-${c.id}`,
            x1: x,
            y1: y + NODE_RADIUS,
            x2: cx,
            y2: cy - NODE_RADIUS
          });

          assignCoords(c, childX, cy, depth + 1);
          childX += childW;
        }
      }
    };

    // Process all isolated or connected trees sequentially side-by-side
    for (const root of data.trees) {
      assignCoords(root, currentX, 50, 0);
      currentX += (widthMap.get(root.id) || MIN_WIDTH);
    }

    return {
      nodes: renderNodes,
      lines: renderLines,
      width: Math.max(currentX, 800),
      height: Math.max((maxDepth + 1) * V_SPACING + 150, 600)
    };
  }, [data, collapsedNodes]);

  if (isFetching && !data) {
    return (
      <div className={styles.skeletonWrapper}>
        <Skeleton style={{ height: '80px', width: '100%' }} />
        <Skeleton style={{ height: '600px', width: '100%' }} />
      </div>
    );
  }

  if (error) {
    return <div className={styles.emptyState}>Fehler beim Laden des Netzwerks: {error.message}</div>;
  }

  if (!layout || layout.nodes.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.treeWrapper}>
          <div className={styles.emptyState}>Keine Netzwerk-Daten vorhanden</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Nutzer im System</span>
                    <span className={styles.statValue}>{data?.totalUsers ?? 0}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Wurzelknoten</span>
          <span className={styles.statValue}>{data?.trees?.length ?? 0}</span>
        </div>
      </div>

      <div className={styles.treeWrapper}>
        <svg width={layout.width} height={layout.height}>
          {/* Render lines first so they appear beneath nodes */}
          {layout.lines.map(line => (
            <line
              key={line.id}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              className={styles.line}
            />
          ))}
          
          {layout.nodes.map(node => (
            <g
              key={node.id}
              className={styles.nodeGroup}
              onClick={() => toggleCollapse(node.id)}
            >
              <circle cx={node.x} cy={node.y} r={NODE_RADIUS} className={styles.nodeCircle} />
              
              <text x={node.x} y={node.y} className={styles.initials}>
                {getInitials(node.name)}
              </text>

              {node.hasChildren && (
                <>
                  <circle cx={node.x} cy={node.y + NODE_RADIUS} r={8} className={styles.badgeCircle} />
                  <text x={node.x} y={node.y + NODE_RADIUS + 1} className={styles.badgeText}>
                    {node.isCollapsed ? '+' : '-'}
                  </text>
                </>
              )}

              <text x={node.x} y={node.y + NODE_RADIUS + 24} className={styles.nodeText}>
                {node.name}
              </text>
              <text x={node.x} y={node.y + NODE_RADIUS + 38} className={styles.nodeBibercode}>
                {node.bibercode || 'Kein Code'}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};