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

interface EnableConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 开启 Memory Free 版确认弹窗
 * 完全按照 HTML 设计文件实现
 */
export const EnableConfirmDialog: React.FC<EnableConfirmDialogProps> = ({
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
    toast.success('已开启 Memory Free 版，正在为所有实例开启记忆插件');
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
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1447E6] to-[#1447E6] flex items-center justify-center flex-shrink-0">
            <span className="text-xl">✓</span>
          </div>
          <div>
            <DialogTitle className="text-xl font-bold text-[#1a1a2e]">
              开启 Memory Free 版
            </DialogTitle>
            <DialogDescription className="text-sm text-[#6b7280] mt-1">
              确认后将在所有实例上安装并启用记忆功能
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* 蓝色提示框 - 开启后效果 */}
          <div className="bg-[#dbeafe] border border-[#93c5fd] rounded-[10px] p-4">
            <div className="flex gap-3">
              <span className="text-lg flex-shrink-0">📦</span>
              <div>
                <h4 className="font-semibold text-[#1e40af] mb-2">开启后效果</h4>
                <ul className="text-sm text-[#1e40af] space-y-1">
                  <li>• 新创建的 Agent 将<strong>默认安装并启用</strong> Memory Free 版记忆插件。</li>
                  <li>• 所有现有 Agent 将会<strong>自动安装</strong>此插件，安装过程需要重启 Agent Gateway 服务。</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 黄色警告框 */}
          <div className="bg-[#fef3c7] border border-[#fed7aa] rounded-[10px] p-4 flex gap-3">
            <span className="text-lg flex-shrink-0">⚠️</span>
            <div className="text-sm text-[#9a3412] leading-relaxed">
              <strong className="text-[#c2410c]">请注意：此操作涉及所有现有实例。</strong>安装过程中，实例的 Gateway 服务将重启，会导致<strong className="text-[#c2410c]">服务短暂中断（约 1 分钟/实例）</strong>。建议避开业务高峰期进行操作。
            </div>
          </div>

          {/* 确认复选框 */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="enableCheck"
              checked={isChecked}
              onCheckedChange={(checked) => setIsChecked(checked as boolean)}
            />
            <label htmlFor="enableCheck" className="text-sm text-[#5c5c7a] cursor-pointer">
              我已了解上述说明，确认开启
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
            className="bg-[#1447E6] text-white hover:bg-[#0051d5]"
          >
            确认开启
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
