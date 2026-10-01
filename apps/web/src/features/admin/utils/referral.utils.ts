import type { AdminReferralMember } from "../types/admin.types";

export interface RelativeReferralNode {
  readonly member: AdminReferralMember;
  readonly level: 1 | 2 | 3 | 4 | 5;
  readonly path: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly directChildrenCount: number;
}

export interface RelativeReferralHierarchy {
  readonly root: AdminReferralMember | null;
  readonly totalTeamCount: number;
  readonly levelCounts: Record<1 | 2 | 3 | 4 | 5, number>;
  readonly levels: Record<1 | 2 | 3 | 4 | 5, readonly RelativeReferralNode[]>;
}

/**
 * Pure BFS utility to derive relative referral levels (L1 - L5) for a selected root member.
 * - Root member is excluded from L1-L5 (it is level 0).
 * - Direct children of root are L1.
 * - Children of L1 are L2, and so forth up to L5.
 * - Excludes ancestors and unrelated branches.
 * - Prevents cycles with a visited set.
 * - Handles missing sponsor references safely.
 */
export function computeRelativeReferralHierarchy(
  rootId: string,
  allMembers: readonly AdminReferralMember[],
): RelativeReferralHierarchy {
  const memberMap = new Map<string, AdminReferralMember>();
  const childrenMap = new Map<string, AdminReferralMember[]>();

  for (const m of allMembers) {
    memberMap.set(m.id, m);
    if (m.sponsorId) {
      const list = childrenMap.get(m.sponsorId) ?? [];
      list.push(m);
      childrenMap.set(m.sponsorId, list);
    }
  }

  const root = memberMap.get(rootId) ?? null;
  const levelCounts: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  const levelsMutable: Record<1 | 2 | 3 | 4 | 5, RelativeReferralNode[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  };

  if (!root) {
    return {
      root: null,
      totalTeamCount: 0,
      levelCounts,
      levels: {
        1: [],
        2: [],
        3: [],
        4: [],
        5: [],
      },
    };
  }

  const visited = new Set<string>([root.id]);

  type QueueItem = {
    readonly member: AdminReferralMember;
    readonly level: number;
    readonly path: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
    }>;
  };

  const queue: QueueItem[] = [];
  const rootChildren = childrenMap.get(root.id) ?? [];

  for (const child of rootChildren) {
    if (!visited.has(child.id)) {
      visited.add(child.id);
      queue.push({
        member: child,
        level: 1,
        path: [{ id: root.id, name: root.name }],
      });
    }
  }

  let totalTeamCount = 0;

  for (const current of queue) {
    if (current.level > 5) continue;

    const lvl = current.level as 1 | 2 | 3 | 4 | 5;
    const directChildren = childrenMap.get(current.member.id) ?? [];

    const node: RelativeReferralNode = {
      member: current.member,
      level: lvl,
      path: [
        ...current.path,
        { id: current.member.id, name: current.member.name },
      ],
      directChildrenCount: directChildren.length,
    };

    levelsMutable[lvl].push(node);
    levelCounts[lvl]++;
    totalTeamCount++;

    if (current.level < 5) {
      for (const child of directChildren) {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          queue.push({
            member: child,
            level: current.level + 1,
            path: node.path,
          });
        }
      }
    }
  }

  return {
    root,
    totalTeamCount,
    levelCounts,
    levels: {
      1: levelsMutable[1],
      2: levelsMutable[2],
      3: levelsMutable[3],
      4: levelsMutable[4],
      5: levelsMutable[5],
    },
  };
}
