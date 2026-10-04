"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateDbError } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

export interface HabitListItem {
  id: string;
  icon: string | null;
  name: string;
  isPrivate: boolean;
  high: boolean;
  frequency: string;
  streak: string | null;
}

/**
 * Lista de hábitos activos con modo "Ordenar": arrastrar ⋮⋮ (ratón o dedo)
 * o usar ↑↓. Al pulsar "Listo" se guarda el orden (Hoy y el correo lo usan).
 */
export function HabitList({ items }: { items: HabitListItem[] }) {
  const router = useRouter();
  const t = useT();
  const [supabase] = useState(() => createClient());
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState(items);
  const [dragId, setDragId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const drag = useRef<{ id: string; startY: number } | null>(null);

  const list = editing ? order : items;

  function start() {
    setOrder(items);
    setError(null);
    setEditing(true);
  }

  async function finish() {
    const ids = order.map((h) => h.id);
    if (ids.join() === items.map((h) => h.id).join()) return setEditing(false);
    setSaving(true);
    const { error } = await supabase.rpc("reorder_habits", { p_ids: ids });
    setSaving(false);
    if (error) return setError(translateDbError(error.message, t));
    setEditing(false);
    router.refresh();
  }

  function move(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= order.length) return;
    setOrder((o) => {
      const n = [...o];
      [n[index], n[to]] = [n[to], n[index]];
      return n;
    });
  }

  // --- Arrastre con pointer events (funciona igual con dedo y ratón) ---
  function onPointerDown(e: React.PointerEvent, id: string) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id, startY: e.clientY };
    setDragId(id);
    setOffset(0);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    let dy = e.clientY - d.startY;
    const i = order.findIndex((h) => h.id === d.id);
    // Si pasa la mitad del vecino, intercambian sitio y el punto de partida se corrige
    const below = order[i + 1] && rows.current.get(order[i + 1].id);
    const above = order[i - 1] && rows.current.get(order[i - 1].id);
    if (dy > 0 && below && dy > below.offsetHeight / 2) {
      d.startY += below.offsetHeight;
      dy -= below.offsetHeight;
      move(i, 1);
    } else if (dy < 0 && above && -dy > above.offsetHeight / 2) {
      d.startY -= above.offsetHeight;
      dy += above.offsetHeight;
      move(i, -1);
    }
    setOffset(dy);
  }

  function onPointerUp() {
    drag.current = null;
    setDragId(null);
    setOffset(0);
  }

  return (
    <section className="space-y-3">
      {items.length > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-3">{editing ? t.habits.dragHint : ""}</p>
          <button
            type="button"
            onClick={editing ? finish : start}
            disabled={saving}
            className={`shrink-0 text-sm underline underline-offset-4 ${editing ? "text-ink" : "text-ink-2"}`}
          >
            {saving ? t.habits.savingOrder : editing ? t.habits.doneReorder : t.habits.reorder}
          </button>
        </div>
      )}
      {error && <p className="border-l-2 border-ink pl-3 text-sm">{error}</p>}

      <ul className="divide-y divide-line border-y border-line">
        {list.map((h, i) => {
          const isDragging = dragId === h.id;
          const body = (
            <>
              <span className="mono w-6 text-center text-xl">{h.icon ?? "·"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">
                  {h.name}
                  {h.high && <span className="eyebrow ml-2 border border-line px-1 py-px text-[10px]">{t.habits.high}</span>}
                  {h.isPrivate && <span className="ml-2 text-xs text-ink-3">{t.habits.private}</span>}
                </span>
                <span className="text-xs text-ink-3">{h.frequency}</span>
              </span>
            </>
          );
          return (
            <li
              key={h.id}
              ref={(el) => {
                if (el) rows.current.set(h.id, el);
                else rows.current.delete(h.id);
              }}
              style={isDragging ? { transform: `translateY(${offset}px)` } : undefined}
              className={`relative bg-bg ${isDragging ? "z-10 shadow-lg ring-1 ring-line" : ""}`}
            >
              {editing ? (
                <div className="flex items-center gap-3 py-3">
                  <button
                    type="button"
                    aria-label={t.habits.handle(h.name)}
                    onPointerDown={(e) => onPointerDown(e, h.id)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    className="mono -ml-2 cursor-grab touch-none select-none px-2 py-2 text-lg text-ink-3 active:cursor-grabbing"
                  >
                    ⋮⋮
                  </button>
                  {body}
                  <span className="flex shrink-0">
                    <button
                      type="button"
                      aria-label={t.habits.moveUp(h.name)}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      className="px-2 py-2 text-ink-2 disabled:opacity-25"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={t.habits.moveDown(h.name)}
                      disabled={i === list.length - 1}
                      onClick={() => move(i, 1)}
                      className="px-2 py-2 text-ink-2 disabled:opacity-25"
                    >
                      ↓
                    </button>
                  </span>
                </div>
              ) : (
                <Link href={`/habits/${h.id}`} className="flex items-center gap-4 py-4">
                  {body}
                  {h.streak && <span className="shrink-0 text-sm tabular-nums text-ink-2">{h.streak}</span>}
                  <span className="text-ink-3" aria-hidden>
                    →
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
