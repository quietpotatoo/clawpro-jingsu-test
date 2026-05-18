/**
 * ServerManagement - 管控端云服务器管理页
 * 包含：镜像管理 Tab + 安全组管理 Tab
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Download, Server, Shield } from "lucide-react";

// Mock data
const MOCK_IMAGES = [
  { id: "img-001", name: "openclaw-base-v2.1", status: "available", disk: "系统盘 150GiB", os: "CentOS 7.9 64位", createTime: "2025-12-01", active: true },
  { id: "img-002", name: "openclaw-base-v2.0", status: "available", disk: "系统盘 100GiB", os: "CentOS 7.9 64位", createTime: "2025-09-15", active: false },
  { id: "img-003", name: "openclaw-dev-v1.5", status: "creating", disk: "系统盘 200GiB", os: "Ubuntu 22.04 64位", createTime: "2026-03-01", active: false },
];

const DEFAULT_INBOUND = [
  { id: "1", source: "0.0.0.0/0", protocol: "ICMP", port: "ALL", policy: "允许", remark: "放通Ping服务" },
  { id: "2", source: "::/0", protocol: "ICMPv6", port: "ALL", policy: "允许", remark: "放通Ping服务" },
  { id: "3", source: "0.0.0.0/0", protocol: "TCP", port: "22", policy: "允许", remark: "放通Linux SSH登录" },
  { id: "4", source: "::/0", protocol: "TCP", port: "22", policy: "允许", remark: "放通Linux SSH登录" },
  { id: "5", source: "0.0.0.0/0", protocol: "TCP", port: "3389", policy: "允许", remark: "放通Windows远程登录" },
  { id: "6", source: "::/0", protocol: "TCP", port: "3389", policy: "允许", remark: "放通Windows远程登录" },
  { id: "7", source: "10.0.0.0/8", protocol: "ALL", port: "ALL", policy: "允许", remark: "放通内网（云私有网络）" },
  { id: "8", source: "172.16.0.0/12", protocol: "ALL", port: "ALL", policy: "允许", remark: "放通内网（云私有网络）" },
  { id: "9", source: "192.168.0.0/16", protocol: "ALL", port: "ALL", policy: "允许", remark: "放通内网（云私有网络）" },
  { id: "10", source: "0.0.0.0/0", protocol: "TCP", port: "80", policy: "允许", remark: "Web服务HTTP(80)，如Apache、Nginx" },
  { id: "11", source: "0.0.0.0/0", protocol: "TCP", port: "443", policy: "允许", remark: "Web服务HTTPS(443)，如Apache、Nginx" },
  { id: "12", source: "0.0.0.0/0", protocol: "TCP", port: "18789", policy: "允许", remark: "" },
  { id: "13", source: "0.0.0.0/0", protocol: "ALL", port: "ALL", policy: "拒绝", remark: "" },
];

const DEFAULT_OUTBOUND = [
  { id: "1", source: "-", protocol: "ALL", port: "ALL", policy: "允许", remark: "" },
  { id: "2", source: "0.0.0.0/0", protocol: "ALL", port: "ALL", policy: "拒绝", remark: "" },
];

export default function ServerManagement() {
  const [images, setImages] = useState(MOCK_IMAGES);
  const [inboundRules, setInboundRules] = useState(DEFAULT_INBOUND);
  const [outboundRules, setOutboundRules] = useState(DEFAULT_OUTBOUND);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAddRuleDialog, setShowAddRuleDialog] = useState(false);
  const [ruleType, setRuleType] = useState<"inbound" | "outbound">("inbound");
  const [editRule, setEditRule] = useState<any>(null);
  const [newRule, setNewRule] = useState({ source: "", protocol: "TCP", port: "", policy: "允许", remark: "" });

  const handleSaveRule = () => {
    if (!newRule.source && ruleType === "inbound") { toast.error("请填写来源"); return; }
    const rule = { ...newRule, id: String(Date.now()) };
    if (editRule) {
      if (ruleType === "inbound") setInboundRules(inboundRules.map((r) => r.id === editRule.id ? { ...rule, id: editRule.id } : r));
      else setOutboundRules(outboundRules.map((r) => r.id === editRule.id ? { ...rule, id: editRule.id } : r));
      toast.success("规则已更新");
    } else {
      if (ruleType === "inbound") setInboundRules([...inboundRules, rule]);
      else setOutboundRules([...outboundRules, rule]);
      toast.success("规则已添加");
    }
    setShowAddRuleDialog(false);
    setEditRule(null);
    setNewRule({ source: "", protocol: "TCP", port: "", policy: "允许", remark: "" });
  };

  const openAddRule = (type: "inbound" | "outbound") => {
    setRuleType(type);
    setEditRule(null);
    setNewRule({ source: "", protocol: "TCP", port: "", policy: "允许", remark: "" });
    setShowAddRuleDialog(true);
  };

  const openEditRule = (rule: any, type: "inbound" | "outbound") => {
    setRuleType(type);
    setEditRule(rule);
    setNewRule({ source: rule.source || rule.target || "", protocol: rule.protocol, port: rule.port, policy: rule.policy, remark: rule.remark });
    setShowAddRuleDialog(true);
  };

  return (
    <>
      <div className="page-enter">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">云服务器管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理企业版 Agent 所使用的云服务器镜像和安全组策略。</p>
        </div>

        <Tabs defaultValue="images">
          <TabsList className="mb-6">
            <TabsTrigger value="images" className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" />
              镜像管理
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              安全组管理
            </TabsTrigger>
          </TabsList>

          {/* 镜像管理 */}
          <TabsContent value="images">
            <div className="bg-white rounded-[4px] border border-gray-100 overflow-hidden"
              style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50">
                <h2 className="font-semibold text-gray-900">镜像列表</h2>
                <Button size="sm" onClick={() => setShowImportDialog(true)}
                 >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  导入镜像
                </Button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">镜像 ID / 名称</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">状态</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">硬盘</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">操作系统</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">创建时间</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {images.map((img) => (
                    <tr key={img.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{img.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{img.id}</p>
                      </td>
                      <td className="px-6 py-4">
                        {img.status === "available" ? (
                          <span className="badge-running text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                            可用
                          </span>
                        ) : (
                          <span className="badge-pending text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
                            创建中
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{img.disk}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{img.os}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{img.createTime}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">生效</span>
                            <Switch
                              checked={img.active}
                              onCheckedChange={(v) => {
                                setImages(images.map((i) => ({ ...i, active: i.id === img.id ? v : false })));
                                if (v) toast.success(`镜像 ${img.name} 已设为生效`);
                              }}
                            />
                          </div>
                          <button
                            onClick={() => { setImages(images.filter((i) => i.id !== img.id)); toast.success("镜像已删除"); }}
                            className="text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* 安全组管理 */}
          <TabsContent value="security">
            <Tabs defaultValue="inbound">
              <TabsList className="mb-4">
                <TabsTrigger value="inbound">入站规则</TabsTrigger>
                <TabsTrigger value="outbound">出站规则</TabsTrigger>
              </TabsList>

              <TabsContent value="inbound">
                <div className="bg-white rounded-[4px] border border-gray-100 overflow-hidden"
                  style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                    <span className="text-sm font-medium text-gray-700">入站规则</span>
                    <Button size="sm" variant="outline" onClick={() => openAddRule("inbound")}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      添加规则
                    </Button>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-50 bg-gray-50/50">
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">来源</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">协议端口</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">端口</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">策略</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">备注</th>
                        <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {inboundRules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-3 text-sm text-gray-700 font-mono">{rule.source}</td>
                          <td className="px-6 py-3 text-sm text-gray-600">{rule.protocol}</td>
                          <td className="px-6 py-3 text-sm text-gray-600">{rule.port}</td>
                          <td className="px-6 py-3">
                            <span className={`text-sm font-medium ${rule.policy === "允许" ? "text-green-600" : "text-red-500"}`}>
                              {rule.policy}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-400">{rule.remark || "-"}</td>
                          <td className="px-6 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openEditRule(rule, "inbound")} className="text-blue-400 hover:text-blue-600 text-xs">编辑</button>
                              <button onClick={() => { setInboundRules(inboundRules.filter((r) => r.id !== rule.id)); toast.success("规则已删除"); }}
                                className="text-red-400 hover:text-red-600 text-xs">删除</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="outbound">
                <div className="bg-white rounded-[4px] border border-gray-100 overflow-hidden"
                  style={{ boxShadow: "0px 1px 4px rgba(0,0,0,0.05), 0px 0px 2px rgba(0,0,0,0.1)" }}>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                    <span className="text-sm font-medium text-gray-700">出站规则</span>
                    <Button size="sm" variant="outline" onClick={() => openAddRule("outbound")}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      添加规则
                    </Button>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-50 bg-gray-50/50">
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">目标</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">协议端口</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">端口</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">策略</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500">备注</th>
                        <th className="text-right px-6 py-3 text-xs font-medium text-gray-500">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {outboundRules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-3 text-sm text-gray-700 font-mono">{rule.source}</td>
                          <td className="px-6 py-3 text-sm text-gray-600">{rule.protocol}</td>
                          <td className="px-6 py-3 text-sm text-gray-600">{rule.port}</td>
                          <td className="px-6 py-3">
                            <span className={`text-sm font-medium ${rule.policy === "允许" ? "text-green-600" : "text-red-500"}`}>
                              {rule.policy}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-400">{rule.remark || "-"}</td>
                          <td className="px-6 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openEditRule(rule, "outbound")} className="text-blue-400 hover:text-blue-600 text-xs">编辑</button>
                              <button onClick={() => { setOutboundRules(outboundRules.filter((r) => r.id !== rule.id)); toast.success("规则已删除"); }}
                                className="text-red-400 hover:text-red-600 text-xs">删除</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      {/* Import Image Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>导入镜像</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>镜像名称</Label>
              <Input placeholder="请输入镜像名称" className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label>镜像 ID</Label>
              <Input placeholder="请输入镜像 ID" className="bg-gray-50 font-mono" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>取消</Button>
            <Button onClick={() => { setShowImportDialog(false); toast.success("镜像导入任务已提交"); }}
             >
              确认导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Rule Dialog */}
      <Dialog open={showAddRuleDialog} onOpenChange={setShowAddRuleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editRule ? "编辑规则" : `添加${ruleType === "inbound" ? "入站" : "出站"}规则`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{ruleType === "inbound" ? "来源" : "目标"}</Label>
              <Input
                placeholder={ruleType === "inbound" ? "例如 0.0.0.0/0" : "例如 0.0.0.0/0"}
                value={newRule.source}
                onChange={(e) => setNewRule({ ...newRule, source: e.target.value })}
                className="bg-gray-50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>协议</Label>
                <Select value={newRule.protocol} onValueChange={(v) => setNewRule({ ...newRule, protocol: v })}>
                  <SelectTrigger className="bg-gray-50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["TCP", "UDP", "ICMP", "ICMPv6", "ALL"].map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>端口</Label>
                <Input
                  placeholder="例如 80 或 ALL"
                  value={newRule.port}
                  onChange={(e) => setNewRule({ ...newRule, port: e.target.value })}
                  className="bg-gray-50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>策略</Label>
              <Select value={newRule.policy} onValueChange={(v) => setNewRule({ ...newRule, policy: v })}>
                <SelectTrigger className="bg-gray-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="允许">允许</SelectItem>
                  <SelectItem value="拒绝">拒绝</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>备注（可选）</Label>
              <Input
                placeholder="规则备注"
                value={newRule.remark}
                onChange={(e) => setNewRule({ ...newRule, remark: e.target.value })}
                className="bg-gray-50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRuleDialog(false)}>取消</Button>
            <Button onClick={handleSaveRule}>
              {editRule ? "保存" : "确认添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
