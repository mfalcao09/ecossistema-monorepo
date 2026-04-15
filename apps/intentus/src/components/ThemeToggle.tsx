import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { isDark, toggle } = useTheme();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
        >
          {isDark ? (
            <Sun className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
          ) : (
            <Moon className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isDark ? "Tema claro" : "Tema escuro"}
      </TooltipContent>
    </Tooltip>
  );
}
