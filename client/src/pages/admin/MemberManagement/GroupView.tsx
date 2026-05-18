/**
 * 分组视图容器（v3.0）
 *
 * 布局：
 *   - 常驻 Alert：当存在任何多归属用户时显示（不可关闭）
 *   - 主体：左右合为一个大卡片，中间可拖拽分割线，支持收起/展开左侧面板
 *   - 左面板顶部：标题"分组" + "新建"按钮 + 收起按钮；下方搜索框 + 刷新按钮
 *   - 右面板：分组详情/成员表格
 */
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Info, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import GroupList, { UNASSIGNED_GROUP_ID } from "./GroupList";
import NodeContentPanel from "./NodeContentPanel";
import { GroupFormDialog, DeleteGroupDialog } from "./GroupDialog";

import type { UserGroup, UserOrg, UserOverrideInfo, AnomalousGroup } from "./types";
import {
  getUsersOfGroupDeep,
  buildGroupTree,
  findGroupNode,
  getGroupInitHealth,
} from "./health";
import { MOCK_GROUPS, MOCK_MANUAL_GROUPS, MOCK_USERS_MANUAL, MOCK_SYNC_RESULT, MOCK_USER_GROUP_AGENTS, getPrimaryDeptPath } from "./mock";

// OneID 全量组织架构 mock（同步时一次性全部拉取）
const ONEID_ALL_DEPT_NODES: Array<{
  id: string;
  name: string;
  parentId: string | null;
}> = [
  { id: "dept-root", name: "A公司", parentId: null },
  { id: "dept-tech", name: "技术部", parentId: "dept-root" },
  { id: "dept-fe", name: "前端组", parentId: "dept-tech" },
  { id: "dept-be", name: "后端组", parentId: "dept-tech" },
  { id: "dept-ai", name: "AI 组", parentId: "dept-tech" },
  { id: "dept-devops", name: "运维组", parentId: "dept-tech" },
  { id: "dept-qa", name: "测试组", parentId: "dept-tech" },
  { id: "dept-product", name: "产品部", parentId: "dept-root" },
  { id: "dept-pm", name: "产品策划", parentId: "dept-product" },
  { id: "dept-design", name: "设计组", parentId: "dept-product" },
  { id: "dept-operation", name: "运营组", parentId: "dept-product" },
  { id: "dept-operation-1", name: "运营一组", parentId: "dept-operation" },
  { id: "dept-operation-2", name: "运营二组", parentId: "dept-operation" },
  { id: "dept-hr", name: "人力资源", parentId: "dept-root" },
  { id: "dept-finance", name: "财务部", parentId: "dept-root" },
  { id: "dept-legal", name: "法务部", parentId: "dept-root" },
];

interface GroupViewProps {
  /** 是否开启 OneID 模式。OneID：使用 oneid-dept + oneid-group；普通：使用 manual */
  hasOneid: boolean;
  users: UserOrg[];
  overrides: Record<string, UserOverrideInfo>;
  onResolveConflict: (userId: string, winnerResourceId: string) => void;
  /** 通知父组件弹出同步结果弹窗（传入分组异常数据） */
  onShowSyncResult?: (anomalousGroups: AnomalousGroup[]) => void;
  /** 通知父组件组织架构是否已同步为分组 */
  onDeptSyncedChange?: (synced: boolean) => void;
  /** 父组件下发的异常分组数据（手动同步按钮触发时传入） */
  externalAnomalousGroups?: AnomalousGroup[];
}

export default function GroupView({
  hasOneid,
  users,
  overrides,
  onResolveConflict,
  onShowSyncResult,
  onDeptSyncedChange,
  externalAnomalousGroups,
}: GroupViewProps) {
  // ─── 左侧面板：拖拽调宽 + 折叠 ─────────────────────────
  const [leftWidth, setLeftWidth] = useState(288);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = leftWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = ev.clientX - startX.current;
      const newWidth = Math.min(Math.max(startWidth.current + delta, 200), 480);
      setLeftWidth(newWidth);
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // OneID 模式下，组织架构初始未同步，需管理员手动触发
  const [deptSynced, setDeptSynced] = useState(false);
  const [isSyncingDepts, setIsSyncingDepts] = useState(false);

  // OneID 模式下，用户组初始也未同步
  const [ogSynced, setOgSynced] = useState(false);
  const [isRefreshingOg, setIsRefreshingOg] = useState(false);

  // ─── 同步异常分组 ────────────────────────────────────────
  /** 当前异常分组列表（配置未解绑的） */
  const [anomalousGroups, setAnomalousGroups] = useState<AnomalousGroup[]>([]);

  // 父组件通过手动同步按钮下发异常分组数据时，同步到内部状态（显示红点）
  useEffect(() => {
    if (externalAnomalousGroups && externalAnomalousGroups.length > 0) {
      setAnomalousGroups(externalAnomalousGroups);
    }
  }, [externalAnomalousGroups]);

  // 分组集合：OneID 模式初始为空（组织架构和用户组都需要手动同步），组织架构需要同步后才加入
  const [groups, setGroups] = useState<UserGroup[]>(() => {
    if (hasOneid) {
      // 初始为空，组织架构和用户组都需要手动触发
      return [];
    }
    return MOCK_MANUAL_GROUPS;
  });

  /** 直接异常分组 id 集合：异常分组自身 + 其子分组（不含父分组冒泡） */
  const directAnomalousGroupIds = useMemo(() => {
    if (anomalousGroups.length === 0) return new Set<string>();
    const ids = new Set<string>();

    anomalousGroups.forEach((ag) => {
      ids.add(ag.groupId);
      const addChildren = (parentId: string) => {
        groups.forEach((g) => {
          if (g.parentId === parentId) {
            ids.add(g.id);
            addChildren(g.id);
          }
        });
      };
      addChildren(ag.groupId);
    });

    return ids;
  }, [anomalousGroups, groups]);

  /** 计算需要显示红点的完整 id 集合：异常分组自身 + 其子分组 + 其父分组链 */
  const anomalousGroupIds = useMemo(() => {
    if (anomalousGroups.length === 0) return new Set<string>();
    const ids = new Set<string>(directAnomalousGroupIds);
    const groupMap = new Map(groups.map((g) => [g.id, g]));

    anomalousGroups.forEach((ag) => {
      // 所有父分组链（冒泡）
      let cur = groupMap.get(ag.groupId);
      while (cur && cur.parentId) {
        ids.add(cur.parentId);
        cur = groupMap.get(cur.parentId);
      }
    });

    return ids;
  }, [anomalousGroups, groups, directAnomalousGroupIds]);

  /** 异常分组详情 Map（groupId -> AnomalousGroup），供 Tooltip 动态文案使用 */
  const anomalousGroupDetails = useMemo(() => {
    const map = new Map<string, AnomalousGroup>();
    anomalousGroups.forEach((ag) => map.set(ag.groupId, ag));
    return map;
  }, [anomalousGroups]);

  /** 直接初始化未完成分组 id 集合（自身，不含父分组冒泡） */
  const directUninitializedGroupIds = useMemo(() => {
    const ids = new Set<string>();
    groups.forEach((g) => {
      const initHealth = getGroupInitHealth(g.id, groups);
      if (!initHealth.initialized) {
        ids.add(g.id);
      }
    });
    return ids;
  }, [groups]);

  /** 完整初始化未完成分组 id 集合（自身 + 父分组链冒泡） */
  const uninitializedGroupIds = useMemo(() => {
    if (directUninitializedGroupIds.size === 0) return new Set<string>();
    const ids = new Set<string>(directUninitializedGroupIds);
    const groupMap = new Map(groups.map((g) => [g.id, g]));

    directUninitializedGroupIds.forEach((gId) => {
      let cur = groupMap.get(gId);
      while (cur && cur.parentId) {
        ids.add(cur.parentId);
        cur = groupMap.get(cur.parentId);
      }
    });

    return ids;
  }, [directUninitializedGroupIds, groups]);

  // OneID 切换时切换分组集合
  React.useEffect(() => {
    if (hasOneid) {
      // 重置为初始状态：空
      setGroups([]);
      setDeptSynced(false);
      setOgSynced(false);
    } else {
      setGroups(MOCK_MANUAL_GROUPS);
      setDeptSynced(false);
      setOgSynced(false);
    }
  }, [hasOneid]);

  // 用户数据源
  const effectiveUsers = useMemo<UserOrg[]>(
    () => (hasOneid ? users : MOCK_USERS_MANUAL),
    [hasOneid, users]
  );

  const [selectedId, setSelectedId] = useState<string>(() => groups[0]?.id ?? "");

  // 选中项回退保护
  React.useEffect(() => {
    if (
      selectedId !== UNASSIGNED_GROUP_ID &&
      !groups.find((g) => g.id === selectedId)
    ) {
      setSelectedId(groups[0]?.id ?? "");
    }
  }, [groups, selectedId]);

  const selectedGroup = selectedId === UNASSIGNED_GROUP_ID
    ? null
    : groups.find((g) => g.id === selectedId);
  const tree = useMemo(() => buildGroupTree(groups), [groups]);
  const selectedNode = selectedGroup
    ? findGroupNode(tree, selectedGroup.id)
    : null;

  // 节点成员统计（含子孙聚合）
  const groupUsers = useMemo(() => {
    if (selectedId === UNASSIGNED_GROUP_ID) {
      // 未分组用户：不属于当前已加载分组的用户
      const loadedGroupIds = new Set(groups.map((g) => g.id));
      if (loadedGroupIds.size === 0) return effectiveUsers; // 没有分组 → 全部
      return effectiveUsers.filter(
        (u) => !u.groupIds.some((gid) => loadedGroupIds.has(gid))
      );
    }
    return selectedGroup
      ? getUsersOfGroupDeep(selectedGroup.id, groups, effectiveUsers)
      : [];
  }, [selectedId, selectedGroup, groups, effectiveUsers]);

  // 一键同步全部组织架构
  const handleSyncDepts = () => {
    setIsSyncingDepts(true);
    // 模拟同步延迟
    setTimeout(() => {
      const deptGroups: UserGroup[] = ONEID_ALL_DEPT_NODES.map((n) => ({
        id: n.id,
        name: n.name,
        parentId: n.parentId,
        source: "oneid-dept" as const,
        readonly: true,
        externalId: n.id,
        syncBatchId: "oneid-org",
        createdAt: new Date().toISOString(),
      }));
      setGroups((prev) => {
        // 移除旧的 oneid-dept，加入全量
        const withoutDept = prev.filter((g) => g.source !== "oneid-dept");
        return [...withoutDept, ...deptGroups];
      });
      setDeptSynced(true);
      setIsSyncingDepts(false);
      onDeptSyncedChange?.(true);
      toast.success("已同步部门作为分组");
    }, 1200);
  };

  // 加载用户组（mock：加载 oneid-group 类型的自建分组数据）
  const handleRefreshOg = () => {
    setIsRefreshingOg(true);
    setTimeout(() => {
      const ogGroups = MOCK_GROUPS.filter((g) => g.source === "oneid-group");
      setGroups((prev) => {
        const withoutOg = prev.filter((g) => g.source !== "oneid-group");
        return [...withoutOg, ...ogGroups];
      });
      setOgSynced(true);
      setIsRefreshingOg(false);
      toast.success(`已加载 ${ogGroups.length} 个用户组`);
    }, 800);
  };

  // 刷新同步（模拟：检测到腾讯统一身份管理平台删除了某个组织架构）
  const handleRefreshSync = useCallback(() => {
    if (!deptSynced) return;
    setIsSyncingDepts(true);
    setTimeout(() => {
      // 模拟从 OneID 获取最新组织架构（不包含已删除的运营组及其子分组）
      const deletedIds = new Set(["dept-operation", "dept-operation-1", "dept-operation-2"]);
      const latestNodes = ONEID_ALL_DEPT_NODES.filter(
        (n) => !deletedIds.has(n.id)
      );
      const deptGroups: UserGroup[] = latestNodes.map((n) => ({
        id: n.id,
        name: n.name,
        parentId: n.parentId,
        source: "oneid-dept" as const,
        readonly: true,
        externalId: n.id,
        syncBatchId: "oneid-org",
        createdAt: new Date().toISOString(),
      }));

      // 但这些异常分组仍保留在树中（因为有配置绑定，无法删除）
      const anomalousNodes: UserGroup[] = [
        {
          id: "dept-operation",
          name: "运营组",
          parentId: "dept-product",
          source: "oneid-dept",
          readonly: true,
          externalId: "dept-operation",
          syncBatchId: "oneid-org",
          createdAt: new Date().toISOString(),
        },
        {
          id: "dept-operation-1",
          name: "运营一组",
          parentId: "dept-operation",
          source: "oneid-dept",
          readonly: true,
          externalId: "dept-operation-1",
          syncBatchId: "oneid-org",
          createdAt: new Date().toISOString(),
        },
        {
          id: "dept-operation-2",
          name: "运营二组",
          parentId: "dept-operation",
          source: "oneid-dept",
          readonly: true,
          externalId: "dept-operation-2",
          syncBatchId: "oneid-org",
          createdAt: new Date().toISOString(),
        },
      ];

      setGroups((prev) => {
        const withoutDept = prev.filter((g) => g.source !== "oneid-dept");
        return [...withoutDept, ...deptGroups, ...anomalousNodes];
      });

      // 模拟：组织架构被删除后，用户从这些分组中被移除（groupIds 去掉运营相关 id）
      users.forEach((u, idx) => {
        if (u.groupIds.some((gid) => deletedIds.has(gid))) {
          users[idx] = {
            ...u,
            groupIds: u.groupIds.filter((gid) => !deletedIds.has(gid)),
          };
        }
      });

      // 设置异常分组
      setAnomalousGroups(MOCK_SYNC_RESULT.anomalousGroups);

      // 通知父组件弹出同步结果弹窗
      if (onShowSyncResult) {
        onShowSyncResult(MOCK_SYNC_RESULT.anomalousGroups);
      }

      setIsSyncingDepts(false);
    }, 1200);
  }, [deptSynced, onShowSyncResult, users]);

  // 模拟解绑配置：移除异常分组中的指定配置
  const handleUnbindConfig = useCallback((groupId: string, configName: string) => {
    setAnomalousGroups((prev) => {
      const updated = prev.map((ag) => {
        if (ag.groupId !== groupId) return ag;
        const newConfigs = ag.boundConfigs.filter((c) => c !== configName);
        return { ...ag, boundConfigs: newConfigs };
      }).filter((ag) => ag.boundConfigs.length > 0);
      return updated;
    });
    // 如果全部解绑，移除该分组
    setAnomalousGroups((prev) => {
      if (prev.length === 0) {
        // 从树中移除异常分组
        setGroups((g) => g.filter((grp) => grp.id !== groupId));
      }
      return prev;
    });
  }, []);

  // ─── 分组 CRUD（普通模式） ────────────────────────────────
  type FormMode = "create" | "edit" | "addChild";
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [formTarget, setFormTarget] = useState<{
    id: string;
    name: string;
    parentId: string | null;
  } | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // 编辑分组存量 Agent 实例处理弹窗
  const [editGroupAgentDialog, setEditGroupAgentDialog] = useState<{
    open: boolean;
    agents: Array<{ userId: string; instances: Array<{ id: string; name: string }>; groupName: string }>;
    pendingAction: () => void;
  } | null>(null);
  const [editGroupAgentChoice, setEditGroupAgentChoice] = useState<"keep" | "delete">("keep");

  // 新建分组
  const handleCreateGroup = () => {
    setFormMode("create");
    setFormTarget(null);
    setFormOpen(true);
  };

  // 添加子分组
  const handleAddChildGroup = (parentId: string) => {
    const parent = groups.find((g) => g.id === parentId);
    if (!parent) return;
    setFormMode("addChild");
    setFormTarget({ id: parent.id, name: parent.name, parentId: parent.parentId });
    setFormOpen(true);
  };

  // 编辑分组
  const handleEditGroup = (groupId: string) => {
    const g = groups.find((g) => g.id === groupId);
    if (!g) return;
    setFormMode("edit");
    setFormTarget({ id: g.id, name: g.name, parentId: g.parentId });
    setFormOpen(true);
  };

  // 确认新建/编辑/添加子分组
  const handleFormConfirm = (name: string, parentId: string | null) => {
    if (formMode === "edit" && formTarget) {
      const parentChanged = formTarget.parentId !== parentId;

      const doEdit = () => {
        setGroups((prev) =>
          prev.map((g) =>
            g.id === formTarget.id ? { ...g, name, parentId } : g
          )
        );
        toast.success("分组已更新");
      };

      if (parentChanged) {
        // 检测该分组下所有用户的 Agent 实例
        const groupId = formTarget.id;
        const groupUsers = effectiveUsers.filter((u) => u.groupIds.includes(groupId));
        const affectedAgents: Array<{ userId: string; instances: Array<{ id: string; name: string }>; groupName: string }> = [];
        const gName = getPrimaryDeptPath(groupId, groups);

        groupUsers.forEach((u) => {
          const userAgents = MOCK_USER_GROUP_AGENTS[u.userId];
          const instances = userAgents?.[groupId];
          if (instances && instances.length > 0) {
            affectedAgents.push({ userId: u.userId, instances, groupName: gName });
          }
        });

        if (affectedAgents.length > 0) {
          setEditGroupAgentDialog({
            open: true,
            agents: affectedAgents,
            pendingAction: doEdit,
          });
          setEditGroupAgentChoice("keep");
          return;
        }
      }

      doEdit();
    } else {
      // 新建 / 添加子分组
      const newGroup: UserGroup = {
        id: `manual-${Date.now()}`,
        name,
        parentId,
        source: "manual",
        readonly: false,
        createdAt: new Date().toISOString(),
      };
      setGroups((prev) => [...prev, newGroup]);
      setSelectedId(newGroup.id);
      toast.success("分组已创建");
    }
    setFormOpen(false);
  };

  // 删除分组
  const handleOpenDelete = (groupId: string) => {
    const g = groups.find((g) => g.id === groupId);
    if (!g) return;
    setDeleteTarget({ id: g.id, name: g.name });
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = (groupId: string) => {
    // 删除该分组及其所有子孙
    const toDelete = new Set<string>();
    const addDescendants = (id: string) => {
      toDelete.add(id);
      groups.filter((g) => g.parentId === id).forEach((g) => addDescendants(g.id));
    };
    addDescendants(groupId);

    setGroups((prev) => prev.filter((g) => !toDelete.has(g.id)));
    setDeleteOpen(false);
    setDeleteTarget(null);
    if (toDelete.has(selectedId)) {
      const remaining = groups.filter((g) => !toDelete.has(g.id));
      setSelectedId(remaining.length > 0 ? remaining[0].id : UNASSIGNED_GROUP_ID);
    }
    toast.success("分组已删除，用户保留");
  };

  // 删除时的成员数统计
  const deleteMemberCount = useMemo(() => {
    if (!deleteTarget) return 0;
    return getUsersOfGroupDeep(deleteTarget.id, groups, effectiveUsers).length;
  }, [deleteTarget, groups, effectiveUsers]);

  // ─── 用户操作（普通模式） ────────────────────────────────
  const [, setUsersVersion] = useState(0);

  // 添加用户到分组
  const handleAddUsersToGroup = useCallback(
    (userIds: string[]) => {
      if (!selectedId || selectedId === UNASSIGNED_GROUP_ID) return;
      // 将 selectedId 加入这些用户的 groupIds
      const usersToUpdate = new Set(userIds);
      const updatedUsers = effectiveUsers.map((u) => {
        if (usersToUpdate.has(u.userId) && !u.groupIds.includes(selectedId)) {
          return { ...u, groupIds: [...u.groupIds, selectedId] };
        }
        return u;
      });
      // 因为 MOCK_USERS_MANUAL 是引用，直接更新对象属性来模拟后端操作
      updatedUsers.forEach((u, idx) => {
        if (usersToUpdate.has(u.userId)) {
          effectiveUsers[idx] = u;
        }
      });
      setUsersVersion((v) => v + 1);
      toast.success(`已添加 ${userIds.length} 名用户到分组`);
    },
    [selectedId, effectiveUsers]
  );

  // 从分组中移除用户
  const handleRemoveFromGroup = useCallback(
    (userId: string) => {
      if (!selectedId || selectedId === UNASSIGNED_GROUP_ID) return;
      const idx = effectiveUsers.findIndex((u) => u.userId === userId);
      if (idx >= 0) {
        effectiveUsers[idx] = {
          ...effectiveUsers[idx],
          groupIds: effectiveUsers[idx].groupIds.filter(
            (gid) => gid !== selectedId
          ),
        };
        setUsersVersion((v) => v + 1);
        toast.success("已从分组中移除");
      }
    },
    [selectedId, effectiveUsers]
  );

  const handleEditUserGroups = useCallback(
    (userId: string, newGroupIds: string[]) => {
      const idx = effectiveUsers.findIndex((u) => u.userId === userId);
      if (idx >= 0) {
        effectiveUsers[idx] = {
          ...effectiveUsers[idx],
          groupIds: newGroupIds,
        };
        setUsersVersion((v) => v + 1);
        toast.success("用户分组已更新");
      }
    },
    [effectiveUsers]
  );

  return (
    <div className="space-y-3">
      {/* 常驻分组命名提醒 */}
      {groups.length > 0 && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-[4px] px-4 py-3">
          <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-amber-700 leading-relaxed">
              分组名称将在用户端展示，用户可查看自己所属的分组。请确保分组命名规范、清晰，避免使用内部代号或敏感信息。
            </div>
          </div>
        </div>
      )}

      {/* 主体：合并为一个卡片，左右面板 + 可拖拽分割线 */}
      <div
        className="flex bg-white rounded-[4px] border border-gray-100 overflow-hidden"
        style={{
          boxShadow:
            "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)",
          height: "calc(100vh - 220px)",
        }}
      >
        {/* 左侧面板 */}
        {!leftCollapsed && (
          <div
            className="shrink-0 relative"
            style={{ width: leftWidth }}
          >
            <div className="h-full overflow-hidden">
              <GroupList
                groups={groups}
                users={effectiveUsers}
                selectedId={selectedId}
                onSelect={setSelectedId}
                deptSynced={hasOneid ? deptSynced : undefined}
                onSyncDepts={handleSyncDepts}
                isSyncingDepts={isSyncingDepts}
                hasOneid={hasOneid}
                isManualMode={true}
                onCreateGroup={handleCreateGroup}
                onAddChildGroup={handleAddChildGroup}
                onEditGroup={handleEditGroup}
                onDeleteGroup={handleOpenDelete}
                anomalousGroupIds={anomalousGroupIds}
                directAnomalousGroupIds={directAnomalousGroupIds}
                onRefreshSync={handleRefreshSync}
                uninitializedGroupIds={uninitializedGroupIds}
                directUninitializedGroupIds={directUninitializedGroupIds}
                anomalousGroupDetails={anomalousGroupDetails}
              />
            </div>
            {/* 收起按钮 —— 右边缘贴住分割线竖线 */}
            <button
              type="button"
              onClick={() => setLeftCollapsed(true)}
              className="absolute top-[18px] -right-2 w-6 h-7 flex items-center justify-center rounded-l-md rounded-r-none bg-gray-50 text-gray-300 hover:bg-gray-100 hover:text-gray-500 transition-colors z-10"
              title="收起分组列表"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 可拖拽分割线 */}
        {!leftCollapsed && (
          <div className="shrink-0 flex flex-col items-center relative w-4 z-20">
            {/* 中间竖线 + 拖拽手柄 */}
            <div
              className="flex-1 flex flex-col items-center justify-center cursor-col-resize group relative w-full"
              onMouseDown={handleMouseDown}
            >
              {/* 上段竖线 */}
              <div className="flex-1 w-px bg-gray-100" />
              {/* 拖拽手柄：圆角矩形 + 2×3 六点阵列 */}
              <div className="w-3 py-1.5 flex flex-col items-center justify-center gap-[2px] rounded-[4px] bg-gray-50 group-hover:bg-gray-100 transition-colors">
                <div className="flex gap-[2px]">
                  <span className="w-[1.5px] h-[1.5px] rounded-full bg-gray-300 group-hover:bg-gray-500 transition-colors" />
                  <span className="w-[1.5px] h-[1.5px] rounded-full bg-gray-300 group-hover:bg-gray-500 transition-colors" />
                </div>
                <div className="flex gap-[2px]">
                  <span className="w-[1.5px] h-[1.5px] rounded-full bg-gray-300 group-hover:bg-gray-500 transition-colors" />
                  <span className="w-[1.5px] h-[1.5px] rounded-full bg-gray-300 group-hover:bg-gray-500 transition-colors" />
                </div>
                <div className="flex gap-[2px]">
                  <span className="w-[1.5px] h-[1.5px] rounded-full bg-gray-300 group-hover:bg-gray-500 transition-colors" />
                  <span className="w-[1.5px] h-[1.5px] rounded-full bg-gray-300 group-hover:bg-gray-500 transition-colors" />
                </div>
              </div>
              {/* 下段竖线 */}
              <div className="flex-1 w-px bg-gray-100" />
              {/* 扩大拖拽热区 */}
              <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
            </div>
          </div>
        )}

        {/* 右侧面板 */}
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col relative">
          {/* 折叠态：展开按钮 —— 贴在左侧边缘，圆角方形灰底 */}
          {leftCollapsed && (
            <div className="absolute left-0 top-3.5 z-10">
              <button
                type="button"
                onClick={() => setLeftCollapsed(false)}
                className="w-6 h-6 flex items-center justify-center rounded-r-md bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors border border-l-0 border-gray-200"
                title="展开分组列表"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {selectedId === UNASSIGNED_GROUP_ID ? (
            <NodeContentPanel
              nodeId={UNASSIGNED_GROUP_ID}
              nodeName="未分组"
              nodeSource="manual"
              nodeReadonly={false}
              groups={groups}
              nodePath="未分组"
              users={groupUsers}
              hasOneid={hasOneid}
              isManualMode={!hasOneid}
            />
          ) : selectedGroup ? (
            <NodeContentPanel
              nodeId={selectedGroup.id}
              nodeName={selectedGroup.name}
              nodeSource={selectedGroup.source}
              nodeReadonly={selectedGroup.readonly}
              groups={groups}
              nodePath={selectedNode?.path ?? selectedGroup.name}
              users={groupUsers}
              hasOneid={hasOneid}
              isManualMode={!hasOneid}
              allUsers={effectiveUsers}
              onAddUsersToGroup={handleAddUsersToGroup}
              onRemoveFromGroup={handleRemoveFromGroup}
              onEditUserGroups={handleEditUserGroups}
              isAnomalous={anomalousGroups.some((ag) => ag.groupId === selectedGroup.id)}
              anomalousBoundConfigs={anomalousGroups.find((ag) => ag.groupId === selectedGroup.id)?.boundConfigs}
              isUninitialized={directUninitializedGroupIds.has(selectedGroup.id)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              请选择分组
            </div>
          )}
        </div>
      </div>

      {/* 新建 / 编辑 / 添加子分组弹窗 */}
      <GroupFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        groups={groups}
        mode={formMode}
        target={formTarget}
        onConfirm={handleFormConfirm}
      />

      {/* 删除分组确认弹窗 */}
      <DeleteGroupDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        group={deleteTarget}
        memberCount={deleteMemberCount}
        groups={groups}
        onConfirm={handleDeleteConfirm}
      />

      {/* 编辑分组存量 Agent 实例处理弹窗 */}
      <Dialog open={!!editGroupAgentDialog?.open} onOpenChange={(open) => { if (!open) setEditGroupAgentDialog(null); }}>
        <DialogContent className="sm:max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>存量 Agent 实例处理</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-gray-700">
              该分组的上级分组发生变更，以下用户在该分组中创建了 Agent 实例，请选择如何处理：
            </p>
            <div className="rounded-[4px] border border-gray-100 overflow-hidden max-h-[200px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 sticky top-0">
                    <th className="text-left px-3 py-2 font-medium text-gray-500">用户 ID</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Agent 实例名称 / ID</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">分组</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {editGroupAgentDialog?.agents.flatMap((a) =>
                    a.instances.map((inst) => (
                      <tr key={inst.id}>
                        <td className="px-3 py-2 text-gray-700">{a.userId}</td>
                        <td className="px-3 py-2 text-gray-700">{inst.name}<span className="text-gray-400 ml-1">({inst.id})</span></td>
                        <td className="px-3 py-2 text-gray-700">{a.groupName}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="py-2 space-y-2">
            <p className="text-xs font-medium text-gray-700 mb-1">处理方式</p>
            {[
              { value: "keep", title: "保留原配置", desc: "存量 Agent 实例保留在原分组名下，可继续使用原分组的配置和权限，但无法在原分组创建新的 Agent" },
              { value: "delete", title: "删除实例", desc: "确认后将跳转到 Agent 列表页面，系统会帮您自动筛选出这些实例，您可以全选并批量删除" },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-2.5 p-3 rounded-[4px] border cursor-pointer transition-colors ${editGroupAgentChoice === opt.value ? "border-blue-300 bg-blue-50/50" : "border-gray-200 hover:border-gray-300"}`}
                onClick={() => setEditGroupAgentChoice(opt.value as "keep" | "delete")}
              >
                <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${editGroupAgentChoice === opt.value ? "border-blue-500" : "border-gray-300"}`}>
                  {editGroupAgentChoice === opt.value && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{opt.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroupAgentDialog(null)}>取消</Button>
            <Button
             
              className="text-white"
              onClick={() => {
                editGroupAgentDialog?.pendingAction();
                setEditGroupAgentDialog(null);
                if (editGroupAgentChoice === "delete") {
                  const ids = editGroupAgentDialog?.agents.flatMap(a => a.instances.map(i => i.id)).join(",") ?? "";
                  window.location.href = `/admin/openclaw-monitor?filter=pending-delete&ids=${ids}`;
                }
              }}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
