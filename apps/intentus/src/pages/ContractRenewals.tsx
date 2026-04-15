import ContractRenewalTab from "@/components/contracts/ContractRenewalTab";

export default function ContractRenewals() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Renovações</h1>
        <p className="text-muted-foreground text-sm">Gerencie as renovações contratuais</p>
      </div>
      <ContractRenewalTab />
    </div>
  );
}
