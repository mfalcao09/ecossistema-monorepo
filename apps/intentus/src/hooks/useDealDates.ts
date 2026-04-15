import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useUpdateDealDates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      dealId,
      start_date,
      due_date,
    }: {
      dealId: string;
      start_date: string | null;
      due_date: string | null;
    }) => {
      const { error } = await supabase
        .from("deal_requests")
        .update({ start_date, due_date })
        .eq("id", dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal-requests"] });
      toast.success("Datas atualizadas!");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
