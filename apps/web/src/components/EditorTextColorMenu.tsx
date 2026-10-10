import { useId, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Check, Highlighter, PaintBucket, Type } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const COLORS = ["#202325", "#64748b", "#ffffff", "#dc2626", "#ea580c", "#eab308", "#16a34a", "#0891b2", "#2563eb", "#7c3aed", "#db2777", "#fef08a"];
const isHexColor = (value: string) => /^#[\da-f]{6}$/i.test(value);

export const EditorTextColorMenu = ({ editor, disabled, background = false }: {
  editor: Editor | null;
  disabled: boolean;
  background?: boolean;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(background ? "#fef08a" : "#dc2626");
  const customId = useId();
  const applied = useRef(false);
  const selection = useRef<{ from: number; to: number; doc: Editor["state"]["doc"] } | null>(null);
  const current = !editor || editor.isDestroyed ? null : editor.getAttributes("textStyle")[background ? "backgroundColor" : "color"] as string | null;
  const label = t(background ? "editorToolbar.backgroundColor" : "editorToolbar.textColor");
  const Icon = background ? Highlighter : Type;

  const apply = (color: string | null) => {
    const saved = selection.current;
    if (disabled || !editor || editor.isDestroyed || !saved || editor.state.doc !== saved.doc) return;
    applied.current = true;
    // Menu focus must not replace the selection that opened the palette.
    const chain = editor.chain().focus().setTextSelection({ from: saved.from, to: saved.to });
    if (background) {
      if (color) chain.setBackgroundColor(color).run();
      else chain.unsetBackgroundColor().run();
    } else {
      if (color) chain.setColor(color).run();
      else chain.unsetColor().run();
    }
    setOpen(false);
  };

  return (
    <DropdownMenu open={open && !disabled} onOpenChange={(next) => {
      if (next && editor && !editor.isDestroyed && !disabled) {
        applied.current = false;
        const { from, to } = editor.state.selection;
        selection.current = { from, to, doc: editor.state.doc };
        if (current && isHexColor(current)) setCustom(current);
      }
      setOpen(next);
    }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={label} disabled={disabled}
              className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:pointer-events-none disabled:opacity-40", current && "bg-slate-200/80 text-slate-900")}
              onMouseDown={(event) => event.preventDefault()}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span aria-hidden="true" className="absolute bottom-1 h-0.5 w-4 rounded-sm" style={{ backgroundColor: current || (background ? "transparent" : "currentColor") }} />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-60 max-w-[calc(100vw-1rem)] p-2" aria-label={label} onCloseAutoFocus={(event) => { if (applied.current) event.preventDefault(); }}>
        <DropdownMenuLabel className="px-1 text-xs text-slate-500">{label}</DropdownMenuLabel>
        <div className="grid grid-cols-6 gap-1">
          {COLORS.map(color => (
            <DropdownMenuItem key={color} aria-label={color} onSelect={() => apply(color)} className="flex h-8 justify-center rounded p-1">
              <span className="flex h-6 w-6 items-center justify-center rounded border border-slate-400/40" style={{ backgroundColor: color }}>
                {current?.toLowerCase() === color && <Check aria-hidden="true" className="h-3.5 w-3.5" style={{ color: ["#ffffff", "#fef08a", "#eab308"].includes(color) ? "#202325" : "#ffffff" }} />}
              </span>
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <label htmlFor={customId} className="mb-1 block px-1 text-xs text-slate-500">{t("editorToolbar.customColor")}</label>
        <div className="flex items-center gap-2">
          <input id={customId} type="color" aria-label={t("editorToolbar.customColor")} value={isHexColor(custom) ? custom : "#000000"} onChange={(event) => setCustom(event.target.value)} className="h-8 w-8 shrink-0 cursor-pointer rounded border border-slate-200 bg-transparent p-0.5" />
          <input type="text" aria-label={t("editorToolbar.colorHex")} value={custom} maxLength={7} spellCheck={false}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => { if (event.key !== "Escape") event.stopPropagation(); if (event.key === "Enter" && isHexColor(custom)) { event.preventDefault(); apply(custom); } }}
            className="h-8 min-w-0 flex-1 rounded border border-slate-200 bg-transparent px-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={t("editorToolbar.applyColor")} disabled={!isHexColor(custom)} onClick={() => apply(custom)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-40"><Check className="h-4 w-4" /></button>
            </TooltipTrigger>
            <TooltipContent>{t("editorToolbar.applyColor")}</TooltipContent>
          </Tooltip>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => apply(null)}><PaintBucket className="mr-2 h-3.5 w-3.5" />{t("editorToolbar.defaultColor")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
