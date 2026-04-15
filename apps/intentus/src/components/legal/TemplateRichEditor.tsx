import { useRef, useCallback, useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import TemplateVariablesPanel from "./TemplateVariablesPanel";
import {
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Undo2, Redo2, Upload, Minus, Table2, Indent, Outdent, Type,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  initialContent: string;
  onContentChange: (html: string) => void;
}

const FONTS = [
  "Times New Roman", "Arial", "Calibri", "Georgia", "Courier New", "Helvetica", "Verdana", "Garamond",
];

const SIZES = ["8", "9", "10", "11", "12", "14", "16", "18", "20", "24", "28", "32", "36", "48", "72"];

interface ActiveStates {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  justifyLeft: boolean;
  justifyCenter: boolean;
  justifyRight: boolean;
  justifyFull: boolean;
  insertUnorderedList: boolean;
  insertOrderedList: boolean;
}

export default function TemplateRichEditor({ initialContent, onContentChange }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [activeStates, setActiveStates] = useState<ActiveStates>({
    bold: false, italic: false, underline: false, strikeThrough: false,
    justifyLeft: true, justifyCenter: false, justifyRight: false, justifyFull: false,
    insertUnorderedList: false, insertOrderedList: false,
  });
  const [currentFont, setCurrentFont] = useState("Times New Roman");
  const [currentSize, setCurrentSize] = useState("12");

  const updateCounts = useCallback(() => {
    const text = editorRef.current?.innerText || "";
    setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
    setCharCount(text.length);
  }, []);

  const updateActiveStates = useCallback(() => {
    try {
      setActiveStates({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikeThrough: document.queryCommandState("strikeThrough"),
        justifyLeft: document.queryCommandState("justifyLeft"),
        justifyCenter: document.queryCommandState("justifyCenter"),
        justifyRight: document.queryCommandState("justifyRight"),
        justifyFull: document.queryCommandState("justifyFull"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        insertOrderedList: document.queryCommandState("insertOrderedList"),
      });

      const fontName = document.queryCommandValue("fontName").replace(/['"]/g, "");
      const fontSize = document.queryCommandValue("fontSize");
      if (fontName) setCurrentFont(fontName);
      if (fontSize) {
        const sizeMap: Record<string, string> = { "1": "8", "2": "10", "3": "12", "4": "14", "5": "18", "6": "24", "7": "36" };
        setCurrentSize(sizeMap[fontSize] || "12");
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (sel && editorRef.current?.contains(sel.anchorNode)) {
        updateActiveStates();
      }
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [updateActiveStates]);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRangeRef.current);
    }
  }, []);

  const exec = useCallback((command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    onContentChange(editorRef.current?.innerHTML || "");
    updateActiveStates();
  }, [onContentChange, updateActiveStates]);

  const applyFont = useCallback((font: string) => {
    setCurrentFont(font);
    restoreSelection();
    editorRef.current?.focus();
    document.execCommand("fontName", false, font);
    onContentChange(editorRef.current?.innerHTML || "");
  }, [onContentChange, restoreSelection]);

  const applySize = useCallback((size: string) => {
    setCurrentSize(size);
    restoreSelection();
    editorRef.current?.focus();
    // Map pt size to execCommand fontSize (1-7 scale)
    const n = parseInt(size);
    let fsVal = "3";
    if (n <= 8) fsVal = "1";
    else if (n <= 10) fsVal = "2";
    else if (n <= 12) fsVal = "3";
    else if (n <= 14) fsVal = "4";
    else if (n <= 18) fsVal = "5";
    else if (n <= 24) fsVal = "6";
    else fsVal = "7";
    document.execCommand("fontSize", false, fsVal);
    // Override with inline style for precision
    const spans = editorRef.current?.querySelectorAll("font[size]");
    spans?.forEach((s) => {
      (s as HTMLElement).removeAttribute("size");
      (s as HTMLElement).style.fontSize = `${size}pt`;
    });
    onContentChange(editorRef.current?.innerHTML || "");
  }, [onContentChange, restoreSelection]);

  const insertTable = useCallback(() => {
    editorRef.current?.focus();
    let html = `<table style="width:100%;border-collapse:collapse;margin:8px 0">`;
    for (let r = 0; r < tableRows; r++) {
      html += "<tr>";
      for (let c = 0; c < tableCols; c++) {
        html += `<td style="border:1px solid #999;padding:6px 8px;min-width:40px">&nbsp;</td>`;
      }
      html += "</tr>";
    }
    html += "</table><p><br></p>";
    document.execCommand("insertHTML", false, html);
    onContentChange(editorRef.current?.innerHTML || "");
    setShowTableDialog(false);
  }, [tableRows, tableCols, onContentChange]);

  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const editor = editorRef.current;
    if (!editor) return;
    setIsImporting(true);

    try {
      if (file.name.endsWith(".txt")) {
        const text = await file.text();
        editor.innerHTML = text.split("\n").map((l) => `<p>${l || "<br/>"}</p>`).join("");
        onContentChange(editor.innerHTML);
        toast.success("Arquivo importado!");
      } else if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) {
        const arrayBuffer = await file.arrayBuffer();

        // Use docx-preview to render DOCX faithfully
        const { renderAsync } = await import("docx-preview");
        const tempContainer = document.createElement("div");
        const tempStyleContainer = document.createElement("div");
        tempContainer.style.cssText = "position:absolute;left:-9999px;top:-9999px;visibility:hidden";
        tempStyleContainer.style.cssText = "position:absolute;left:-9999px;top:-9999px;visibility:hidden";
        document.body.appendChild(tempContainer);
        document.body.appendChild(tempStyleContainer);

        try {
          await renderAsync(arrayBuffer, tempContainer, tempStyleContainer, {
            className: "docx-import",
            inWrapper: false,
            ignoreWidth: true,
            ignoreHeight: false,
            renderHeaders: true,
            renderFooters: true,
            renderFootnotes: true,
            renderComments: false,
            breakPages: false,
            experimental: true,
            useBase64URL: true,
          } as Parameters<typeof renderAsync>[3]);

          // Inject styles
          let styleEl = document.getElementById("docx-import-styles");
          if (!styleEl) {
            styleEl = document.createElement("style");
            styleEl.id = "docx-import-styles";
            document.head.appendChild(styleEl);
          }
          styleEl.innerHTML = tempStyleContainer.innerHTML;

          // Apply rendered HTML
          editor.innerHTML = tempContainer.innerHTML;
          onContentChange(editor.innerHTML);
          toast.success("Documento Word importado com fidelidade!");
        } finally {
          document.body.removeChild(tempContainer);
          document.body.removeChild(tempStyleContainer);
        }
      } else {
        const text = await file.text();
        editor.innerHTML = `<pre style="font-family:monospace;font-size:12px">${text}</pre>`;
        onContentChange(editor.innerHTML);
        toast.success("Arquivo importado!");
      }
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Erro ao importar arquivo. Verifique se é um .docx válido.");
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  }, [onContentChange]);

  const insertVariable = useCallback((key: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    const span = document.createElement("span");
    span.contentEditable = "false";
    span.className = "inline-block px-1.5 py-0.5 mx-0.5 rounded text-xs font-mono bg-primary/15 text-primary border border-primary/30 select-all";
    span.textContent = `{{${key}}}`;
    span.setAttribute("data-variable", key);
    const range = sel!.getRangeAt(0);
    range.deleteContents();
    range.insertNode(span);
    range.setStartAfter(span);
    range.collapse(true);
    sel!.removeAllRanges();
    sel!.addRange(range);
    onContentChange(editor.innerHTML);
  }, [onContentChange]);

  const insertHtmlBlock = useCallback((html: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand("insertHTML", false, html);
    onContentChange(editor.innerHTML);
  }, [onContentChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case "b": e.preventDefault(); exec("bold"); break;
        case "i": e.preventDefault(); exec("italic"); break;
        case "u": e.preventDefault(); exec("underline"); break;
        case "z": e.preventDefault(); exec(e.shiftKey ? "redo" : "undo"); break;
        case "y": e.preventDefault(); exec("redo"); break;
      }
    }
  }, [exec]);

  const ToolBtn = ({ command, value, icon: Icon, title, active }: {
    command: string; value?: string; icon: React.ElementType; title: string; active?: boolean;
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); exec(command, value); }}
          className={cn(
            "h-7 w-7 flex items-center justify-center rounded text-sm transition-colors hover:bg-accent",
            active ? "bg-accent text-accent-foreground font-bold" : "text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{title}</TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-1 overflow-hidden border rounded-md bg-background flex-col">

        {/* ── Toolbar Row 1 ── */}
        <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-muted/30 flex-wrap shrink-0">
          {/* Font family */}
          <select
            value={currentFont}
            onMouseDown={saveSelection}
            onChange={(e) => applyFont(e.target.value)}
            className="h-7 text-xs border rounded px-1 bg-background text-foreground max-w-[120px]"
          >
            {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
          </select>

          {/* Font size */}
          <select
            value={currentSize}
            onMouseDown={saveSelection}
            onChange={(e) => applySize(e.target.value)}
            className="h-7 text-xs border rounded px-1 bg-background text-foreground w-14"
          >
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <Separator orientation="vertical" className="h-5 mx-1" />

          <ToolBtn command="bold" icon={Bold} title="Negrito (Ctrl+B)" active={activeStates.bold} />
          <ToolBtn command="italic" icon={Italic} title="Itálico (Ctrl+I)" active={activeStates.italic} />
          <ToolBtn command="underline" icon={Underline} title="Sublinhado (Ctrl+U)" active={activeStates.underline} />
          <ToolBtn command="strikeThrough" icon={Strikethrough} title="Tachado" active={activeStates.strikeThrough} />

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* Text color */}
          <Tooltip>
            <TooltipTrigger asChild>
              <label className="h-7 w-7 flex items-center justify-center rounded cursor-pointer hover:bg-accent relative" onMouseDown={saveSelection}>
                <Type className="h-3.5 w-3.5" />
                <input type="color" defaultValue="#000000"
                  className="absolute opacity-0 w-0 h-0"
                  onChange={(e) => { restoreSelection(); exec("foreColor", e.target.value); }}
                />
              </label>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Cor do texto</TooltipContent>
          </Tooltip>

          {/* Highlight color */}
          <Tooltip>
            <TooltipTrigger asChild>
              <label className="h-7 w-7 flex items-center justify-center rounded cursor-pointer hover:bg-accent relative" onMouseDown={saveSelection}>
                <span className="text-xs font-bold" style={{ background: "linear-gradient(transparent 60%,#ffff00 60%)", paddingBottom: "1px" }}>A</span>
                <input type="color" defaultValue="#ffff00"
                  className="absolute opacity-0 w-0 h-0"
                  onChange={(e) => { restoreSelection(); exec("hiliteColor", e.target.value); }}
                />
              </label>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Cor de realce</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* Block styles */}
          {[
            { cmd: "formatBlock", val: "<p>", label: "¶", title: "Parágrafo normal" },
            { cmd: "formatBlock", val: "<h1>", label: "H1", title: "Título 1" },
            { cmd: "formatBlock", val: "<h2>", label: "H2", title: "Título 2" },
            { cmd: "formatBlock", val: "<h3>", label: "H3", title: "Título 3" },
          ].map(({ cmd, val, label, title }) => (
            <Tooltip key={val}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); exec(cmd, val); }}
                  className="h-7 px-1.5 text-xs font-semibold rounded hover:bg-accent transition-colors text-foreground"
                >{label}</button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{title}</TooltipContent>
            </Tooltip>
          ))}

          <Separator orientation="vertical" className="h-5 mx-1" />

          <ToolBtn command="undo" icon={Undo2} title="Desfazer (Ctrl+Z)" />
          <ToolBtn command="redo" icon={Redo2} title="Refazer (Ctrl+Y)" />

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* Import button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="h-7 px-2 text-xs flex items-center gap-1 rounded hover:bg-accent transition-colors text-foreground border"
              >
                <Upload className="h-3.5 w-3.5" />
                {isImporting ? "Importando..." : "Importar .docx"}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Importar arquivo Word (.docx) ou texto (.txt)</TooltipContent>
          </Tooltip>
          <input ref={fileInputRef} type="file" accept=".docx,.doc,.txt" className="hidden" onChange={handleFileImport} />
        </div>

        {/* ── Toolbar Row 2 ── */}
        <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-muted/20 flex-wrap shrink-0">
          <ToolBtn command="justifyLeft" icon={AlignLeft} title="Alinhar à esquerda" active={activeStates.justifyLeft} />
          <ToolBtn command="justifyCenter" icon={AlignCenter} title="Centralizar" active={activeStates.justifyCenter} />
          <ToolBtn command="justifyRight" icon={AlignRight} title="Alinhar à direita" active={activeStates.justifyRight} />
          <ToolBtn command="justifyFull" icon={AlignJustify} title="Justificar" active={activeStates.justifyFull} />

          <Separator orientation="vertical" className="h-5 mx-1" />

          <ToolBtn command="insertUnorderedList" icon={List} title="Lista com marcadores" active={activeStates.insertUnorderedList} />
          <ToolBtn command="insertOrderedList" icon={ListOrdered} title="Lista numerada" active={activeStates.insertOrderedList} />
          <ToolBtn command="outdent" icon={Outdent} title="Diminuir recuo" />
          <ToolBtn command="indent" icon={Indent} title="Aumentar recuo" />

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* Insert table */}
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setShowTableDialog((v) => !v)}
                  className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent transition-colors text-foreground"
                >
                  <Table2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Inserir tabela</TooltipContent>
            </Tooltip>
            {showTableDialog && (
              <div className="absolute top-8 left-0 z-50 bg-popover border rounded-md shadow-lg p-3 space-y-2 min-w-[180px]">
                <p className="text-xs font-medium">Inserir tabela</p>
                <div className="flex items-center gap-2 text-xs">
                  <label>Linhas:</label>
                  <input type="number" min={1} max={20} value={tableRows}
                    onChange={(e) => setTableRows(+e.target.value)}
                    className="w-12 h-6 border rounded px-1 text-xs bg-background" />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <label>Colunas:</label>
                  <input type="number" min={1} max={10} value={tableCols}
                    onChange={(e) => setTableCols(+e.target.value)}
                    className="w-12 h-6 border rounded px-1 text-xs bg-background" />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={insertTable}
                    className="flex-1 h-6 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90">
                    Inserir
                  </button>
                  <button type="button" onClick={() => setShowTableDialog(false)}
                    className="flex-1 h-6 text-xs border rounded hover:bg-accent">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Horizontal rule */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); exec("insertHorizontalRule"); }}
                className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent transition-colors text-foreground"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Linha horizontal</TooltipContent>
          </Tooltip>
        </div>

        {/* ── Editor + Variables Panel ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Paper area */}
          <div
            className="flex-1 overflow-auto bg-[#e8e8e8] p-8"
            onClick={() => { if (showTableDialog) setShowTableDialog(false); }}
          >
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={() => {
                onContentChange(editorRef.current?.innerHTML || "");
                updateCounts();
              }}
              onKeyDown={handleKeyDown}
              onFocus={updateActiveStates}
              dangerouslySetInnerHTML={{ __html: initialContent }}
              style={{
                width: "210mm",
                minHeight: "297mm",
                margin: "0 auto",
                padding: "25.4mm",
                backgroundColor: "white",
                boxShadow: "0 4px 24px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.07)",
                fontFamily: "'Times New Roman', serif",
                fontSize: "12pt",
                lineHeight: "1.6",
                color: "#000",
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            {/* Word count bar */}
            <div className="flex items-center justify-center mt-3">
              <span className="text-xs text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">
                {wordCount} {wordCount === 1 ? "palavra" : "palavras"} · {charCount} {charCount === 1 ? "caractere" : "caracteres"}
              </span>
            </div>
          </div>

          {/* Variables panel */}
          <div className="w-72 border-l bg-muted/20 shrink-0 hidden lg:flex flex-col overflow-hidden">
            <TemplateVariablesPanel onInsertVariable={insertVariable} onInsertHtml={insertHtmlBlock} />
          </div>
        </div>
      </div>

      {/* Styles for docx-preview imported content */}
      <style>{`
        [contenteditable] table { border-collapse: collapse; }
        [contenteditable] td, [contenteditable] th { border: 1px solid #ccc; padding: 4px 8px; }
        [contenteditable] h1 { font-size: 2em; font-weight: bold; margin: 0.67em 0; }
        [contenteditable] h2 { font-size: 1.5em; font-weight: bold; margin: 0.75em 0; }
        [contenteditable] h3 { font-size: 1.17em; font-weight: bold; margin: 0.83em 0; }
        [contenteditable] p { margin: 0 0 0.5em 0; }
        [contenteditable] ul { list-style: disc; padding-left: 2em; }
        [contenteditable] ol { list-style: decimal; padding-left: 2em; }
        .docx-import section.docx { padding: 0 !important; background: transparent !important; }
        .docx-import .docx-wrapper { padding: 0 !important; background: transparent !important; }
      `}</style>
    </TooltipProvider>
  );
}
