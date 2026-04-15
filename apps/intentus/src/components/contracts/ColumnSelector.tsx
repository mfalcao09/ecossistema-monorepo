import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Columns3, RotateCcw } from "lucide-react";

export interface ColumnDef<T> {
  key: string;
  label: string;
  defaultVisible: boolean;
  fixed?: boolean;
  render: (item: T) => React.ReactNode;
}

interface ColumnSelectorProps {
  columns: ColumnDef<any>[];
  visibleColumns: string[];
  onColumnsChange: (columns: string[]) => void;
  defaultColumns: string[];
}

export function ColumnSelector({
  columns,
  visibleColumns,
  onColumnsChange,
  defaultColumns,
}: ColumnSelectorProps) {
  const selectableColumns = columns.filter((c) => !c.fixed);

  const toggleColumn = (key: string) => {
    const next = visibleColumns.includes(key)
      ? visibleColumns.filter((k) => k !== key)
      : [...visibleColumns, key];
    onColumnsChange(next);
  };

  const restoreDefaults = () => {
    onColumnsChange(defaultColumns);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Columns3 className="h-4 w-4" />
          Colunas
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground mb-2">Colunas visíveis</p>
          {selectableColumns.map((col) => (
            <label
              key={col.key}
              className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted cursor-pointer text-sm"
            >
              <Checkbox
                checked={visibleColumns.includes(col.key)}
                onCheckedChange={() => toggleColumn(col.key)}
              />
              {col.label}
            </label>
          ))}
        </div>
        <div className="mt-3 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={restoreDefaults}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrão
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
