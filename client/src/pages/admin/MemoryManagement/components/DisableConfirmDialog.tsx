import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface DisableConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 关闭 Memory Free 版确认弹窗
 * 完全按照 HTML 设计文件实现
 */
export const DisableConfirmDialog: React.FC<DisableConfirmDialogProps> = ({
  open,
  onConfirm,
  onCancel,
}) => {
  const [isChecked, setIsChecked] = useState(false);

  const handleConfirm = () => {
    if (!isChecked) {
      toast.error('请勾选确认框');
      return;
    }
    onConfirm();
    toast.success('已关闭 Memory Free 版');
    setIsChecked(false);
  };

  const handleCancel = () => {
    setIsChecked(false);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">!</span>
          </div>
          <div>
            <DialogTitle className="text-xl font-bold text-[#1a1a2e]">
              关闭Memory Free 版
            </DialogTitle>
            <DialogDescription className="text-sm text-[#6b7280] mt-1">
              此操作将立即禁用所有实例的记忆功能
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* 黄色警告框 - 关闭后效果 */}
          <div className="bg-[#fef3c7] border border-[#fed7aa] rounded-[10px] p-4">
            <div className="flex gap-3">
              <span className="text-lg flex-shrink-0">⚠️</span>
              <div>
                <h4 className="font-semibold text-[#92400e] mb-2">关闭后效果</h4>
                <ul className="text-sm text-[#92400e] space-y-1">
                  <li>• 新创建的 Agent 将<strong>不再默认启用</strong>记忆功能。</li>
                  <li>• 所有现有实例的记忆插件将被<strong>禁用</strong>（插件保留，但停止工作）。</li>
                  <li>• 已产生的记忆数据不会删除，重新开启后可恢复使用。</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 红色警告框 - 重要提示 */}
          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-[10px] p-4 flex gap-3">
            <span className="text-lg flex-shrink-0">🚨</span>
            <div className="text-sm text-[#991b1b] leading-relaxed">
              <strong className="text-[#dc2626]">重要提示：</strong>关闭后，所有现有实例将<strong className="text-[#dc2626]">立即失去记忆能力</strong>，对话将回退到无记忆状态。请务必提前通知相关用户。
            </div>
          </div>

          {/* 确认复选框 */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="disableCheck"
              checked={isChecked}
              onCheckedChange={(checked) => setIsChecked(checked as boolean)}
            />
            <label htmlFor="disableCheck" className="text-sm text-[#5c5c7a] cursor-pointer">
              我已了解上述说明，确认关闭
            </label>
          </div>
        </div>

        <DialogFooter className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="border-[#e8eaf0] text-[#5c5c7a] hover:bg-[#f9fafb]"
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isChecked}
            className="bg-[#dc2626] text-white hover:bg-[#b91c1c]"
          >
            确认关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
