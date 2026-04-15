/**
 * Export data as CSV file download
 */
export function exportToCSV(data: Record<string, any>[], filename: string, headers?: Record<string, string>) {
  if (!data.length) return;

  const keys = Object.keys(headers || data[0]);
  const headerLabels = keys.map(k => headers?.[k] || k);

  const rows = data.map(row =>
    keys.map(k => {
      const val = row[k];
      if (val === null || val === undefined) return "";
      const str = String(val);
      // Escape quotes and wrap if contains comma/quote/newline
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",")
  );

  const csv = [headerLabels.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
