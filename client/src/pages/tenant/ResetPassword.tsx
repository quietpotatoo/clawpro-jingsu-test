/**
 * ResetPassword - 租户端重置密码页
 */
import TenantLayout from "@/components/TenantLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SurfaceConfig } from "@/components/ui/Surface";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { KeyRound, Eye, EyeOff } from "lucide-react";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPwd || !newPwd || !confirmPwd) {
      toast.error("请填写所有字段");
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error("两次输入的新密码不一致");
      return;
    }
    if (newPwd.length < 8) {
      toast.error("新密码长度不能少于 8 位");
      return;
    }
    toast.success("密码重置成功，请重新登录");
    navigate("/");
  };

  return (
    <TenantLayout>
      <div className="max-w-md mx-auto py-16 page-enter">
        <SurfaceConfig className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-[4px] bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">重置密码</h1>
              <p className="text-xs text-gray-400">请输入当前密码和新密码</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-gray-700">当前密码</Label>
              <div className="relative">
                <Input
                  type={showOld ? "text" : "password"}
                  value={oldPwd}
                  onChange={(e) => setOldPwd(e.target.value)}
                  placeholder="请输入当前密码"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowOld(!showOld)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-gray-700">新密码</Label>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="请输入新密码（至少 8 位）"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-gray-700">确认新密码</Label>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="请再次输入新密码"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1">
                确认重置
              </Button>
              <Button type="button" variant="claw-outline" onClick={() => navigate("/my-openclaw")}>
                取消
              </Button>
            </div>
          </form>
        </SurfaceConfig>
      </div>
    </TenantLayout>
  );
}
