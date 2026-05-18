/**
 * 删除 Skill 确认对话框（F-04）
 * - 被技能包引用时，列出包名称 + 警告
 * - 无引用时，简洁确认
 * - 使用 AlertDialog 实现危险操作确认
 */
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface DeleteSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillName: string;
  /** 引用了该 Skill 的技能包名称列表 */
  referencedPackages?: string[];
  onConfirm: () => void;
}

export default function DeleteSkillDialog({
  open,
  onOpenChange,
  skillName,
  referencedPackages = [],
  onConfirm,
}: DeleteSkillDialogProps) {
  const hasReferences = referencedPackages.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {hasReferences ? (
                <>
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-[4px]">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium mb-1">该 Skill 被以下技能包引用：</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {referencedPackages.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    删除后将自动从上述技能包中移除该技能。
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    确定要删除 MCP「{skillName}」吗？
                  </p>
                  <p className="text-sm text-gray-500">此操作不可撤销。</p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            确认删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
