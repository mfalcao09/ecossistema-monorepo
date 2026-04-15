import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { escapeIlike } from "@/lib/searchUtils";

const categories = [
  { value: "clientes", label: "Clientes", table: "people" as const },
  { value: "imoveis", label: "Imóveis", table: "properties" as const },
  { value: "negocios", label: "Negócios", table: "deal_requests" as const },
] as const;

type Category = typeof categories[number];

interface SearchResult {
  id: string;
  label: string;
  sub?: string;
}

export function GlobalSearch() {
  const [category, setCategory] = useState<Category>(categories[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => doSearch(), 300);
    return () => clearTimeout(timeout);
  }, [query, category]);

  async function doSearch() {
    setLoading(true);
    try {
      if (category.value === "clientes") {
        const { data } = await supabase
          .from("people")
          .select("id, name, cpf_cnpj, email")
          .ilike("name", `%${escapeIlike(query)}%`)
          .limit(8);
        setResults(
          (data || []).map((p) => ({
            id: p.id,
            label: p.name,
            sub: p.cpf_cnpj || p.email || undefined,
          }))
        );
      } else if (category.value === "imoveis") {
        const { data } = await supabase
          .from("properties")
          .select("id, title, neighborhood, city")
          .ilike("title", `%${escapeIlike(query)}%`)
          .limit(8);
        setResults(
          (data || []).map((p) => ({
            id: p.id,
            label: p.title,
            sub: [p.neighborhood, p.city].filter(Boolean).join(", ") || undefined,
          }))
        );
      } else {
        const { data } = await supabase
          .from("deal_requests")
          .select("id, deal_type, status, properties(title)")
          .limit(8);
        setResults(
          (data || []).map((d: any) => ({
            id: d.id,
            label: d.properties?.title || "Negócio",
            sub: d.deal_type,
          }))
        );
      }
      setShowResults(true);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(result: SearchResult) {
    setShowResults(false);
    setQuery("");
    if (category.value === "clientes") navigate(`/pessoas`);
    else if (category.value === "imoveis") navigate(`/imoveis/${result.id}`);
    else navigate(`/negocios`);
  }

  return (
    <div ref={wrapperRef} className="relative flex items-center max-w-md w-full">
      {/* Category selector */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1 h-9 px-3 text-xs font-medium rounded-l-md border border-r-0 border-border bg-muted/50 text-foreground hover:bg-muted transition-colors whitespace-nowrap"
        >
          {category.label}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[120px]">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => {
                  setCategory(cat);
                  setDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors ${
                  cat.value === category.value ? "bg-accent font-medium" : ""
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search input */}
      <div className="relative flex-1">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Pesquisar por..."
          className="h-9 rounded-l-none rounded-r-md border-border text-sm pr-8"
        />
        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {/* Results dropdown */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">Buscando...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum resultado encontrado</div>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelect(r)}
                className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border last:border-b-0"
              >
                <div className="text-sm font-medium text-foreground">{r.label}</div>
                {r.sub && <div className="text-xs text-muted-foreground">{r.sub}</div>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
