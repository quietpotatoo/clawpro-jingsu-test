/**
 * AgentCombobox - Agent 名称筛选组件
 * 功能：支持搜索和单选 Agent 名称
 * 特点：默认显示「全部 Agent」，支持模糊搜索，有清空按钮
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentComboboxProps {
  value?: string; // 选中的 Agent 名称，为空表示「全部」
  onValueChange?: (value: string) => void; // 回调函数
  placeholder?: string;
  className?: string;
}

// Mock Agent 列表（实际应从 API 获取）
const OPENCLAW_LIST = [
  { id: "001", name: "Agent-A" },
  { id: "002", name: "Agent-B" },
  { id: "003", name: "Agent-C" },
  { id: "004", name: "Agent-D" },
  { id: "005", name: "Agent-E" },
  { id: "006", name: "Agent-F" },
  { id: "007", name: "Agent-G" },
  { id: "008", name: "Agent-H" },
];

export function AgentCombobox({
  value = "",
  onValueChange,
  placeholder = "搜索 Agent 名称...",
  className,
}: AgentComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // 获取显示的文本
  const displayText = value ? value : "全部 Agent";

  // 过滤列表
  const filteredList = searchValue
    ? OPENCLAW_LIST.filter((item) =>
        item.name.toLowerCase().includes(searchValue.toLowerCase())
      )
    : OPENCLAW_LIST;

  // 处理选择
  const handleSelect = (selectedValue: string) => {
    onValueChange?.(selectedValue === value ? "" : selectedValue);
    setOpen(false);
    setSearchValue("");
  };

  // 处理清空
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange?.("");
    setSearchValue("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between px-3 py-2 h-9 text-sm font-normal bg-white hover:bg-white",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{displayText}</span>
          <div className="flex items-center gap-1">
            {value && (
              <X
                className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-pointer"
                onClick={handleClear}
              />
            )}
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput
            placeholder={placeholder}
            value={searchValue}
            onValueChange={setSearchValue}
            className="h-9"
          />
          <CommandList className="max-h-[200px]">
            <CommandEmpty>未找到匹配的 Agent</CommandEmpty>
            <CommandGroup>
              {/* 全部选项 */}
              <CommandItem
                value="all"
                onSelect={() => {
                  onValueChange?.("");
                  setOpen(false);
                  setSearchValue("");
                }}
                className={cn(
                  "cursor-pointer",
                  !value && "bg-blue-50"
                )}
              >
                <Check
                  className={cn(
                    "w-4 h-4 mr-2",
                    !value ? "opacity-100 text-blue-600" : "opacity-0"
                  )}
                />
                全部 Agent
              </CommandItem>

              {/* Agent 列表 */}
              {filteredList.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.name}
                  onSelect={() => handleSelect(item.name)}
                  className={cn(
                    "cursor-pointer",
                    value === item.name && "bg-blue-50"
                  )}
                >
                  <Check
                    className={cn(
                      "w-4 h-4 mr-2",
                      value === item.name
                        ? "opacity-100 text-blue-600"
                        : "opacity-0"
                    )}
                  />
                  {item.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
