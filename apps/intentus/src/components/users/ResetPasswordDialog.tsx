import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, RefreshCw, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

function generateStrongPassword(): string {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const special = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  const all = lower + upper + digits + special;

  // Ensure at least one of each category
  const arr: string[] = [
    lower[Math.floor(Math.random() * lower.length)],
    upper[Math.floor(Math.random() * upper.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  for (let i = 0; i < 8; i++) {
    arr.push(all[Math.floor(Math.random() * all.length)]);
  }
  // Shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Mínimo 8 caracteres";
  if (!/[a-z]/.test(pw)) return "Necessário ao menos uma letra minúscula";
  if (!/[A-Z]/.test(pw)) return "Necessário ao menos uma letra maiúscula";
  if (!/\d/.test(pw)) return "Necessário ao menos um número";
  if (!/[^a-zA-Z0-9]/.test(pw)) return "Necessário ao menos um caractere especial";
  return null;
}

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  userId: string;
}

export function ResetPasswordDialog({ open, onOpenChange, userName, userId }: ResetPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordError = password ? validatePassword(password) : null;
  const confirmError = confirmPassword && password !== confirmPassword ? "As senhas não coincidem" : null;
  const isManualValid = password && !passwordError && confirmPassword && !confirmError;

  const handleGenerate = () => {
    const pw = generateStrongPassword();
    setGeneratedPassword(pw);
    setPassword(pw);
    setConfirmPassword(pw);
    setCopied(false);
  };

  const handleCopy = () => {
    const pw = generatedPassword || password;
    if (pw) {
      navigator.clipboard.writeText(pw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async () => {
    const finalPassword = password;
    const error = validatePassword(finalPassword);
    if (error) {
      toast.error(error);
      return;
    }
    if (finalPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("reset-user-password", {
        body: { user_id: userId, new_password: finalPassword },
      });
      if (fnError) throw new Error(fnError.message || "Erro ao resetar senha");
      if (data?.error) throw new Error(data.error);
      setSuccess(true);
      toast.success("Senha alterada com sucesso!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setConfirmPassword("");
    setGeneratedPassword(null);
    setCopied(false);
    setShowPassword(false);
    setShowConfirm(false);
    setSuccess(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resetar Senha</DialogTitle>
          <DialogDescription>
            Defina uma nova senha para <strong>{userName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-primary font-medium">Senha alterada com sucesso!</p>
            {generatedPassword && (
              <div>
                <Label className="text-xs text-muted-foreground">Nova senha gerada</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">{generatedPassword}</code>
                  <Button variant="outline" size="icon" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Compartilhe esta senha com o usuário.</p>
              </div>
            )}
            <DialogFooter>
              <Button onClick={handleClose}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Generate random password */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Gerar senha aleatória</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleGenerate} className="gap-2">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Gerar Senha Forte
                </Button>
                {generatedPassword && (
                  <div className="flex items-center gap-1 flex-1">
                    <code className="flex-1 bg-muted px-3 py-1.5 rounded text-sm font-mono truncate">{generatedPassword}</code>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy}>
                      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou defina manualmente</span>
              </div>
            </div>

            {/* Manual password */}
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setGeneratedPassword(null); }}
                  placeholder="Mínimo 8 caracteres"
                />
                <Button
                  variant="ghost" size="icon"
                  className="absolute right-0 top-0 h-10 w-10"
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
              <p className="text-xs text-muted-foreground">Maiúscula, minúscula, número e caractere especial obrigatórios.</p>
            </div>

            <div className="space-y-2">
              <Label>Confirmar senha</Label>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                />
                <Button
                  variant="ghost" size="icon"
                  className="absolute right-0 top-0 h-10 w-10"
                  onClick={() => setShowConfirm(!showConfirm)}
                  type="button"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {confirmError && <p className="text-xs text-destructive">{confirmError}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={!isManualValid || loading}>
                {loading ? "Salvando..." : "Salvar Nova Senha"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
