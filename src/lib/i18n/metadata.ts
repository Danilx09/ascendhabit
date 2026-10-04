import type { Metadata } from "next";
import type { Dict } from "./index";
import { getT } from "./server";

/** Título de página traducido: "Hoy · AscendHabit" / "Today · AscendHabit" */
export function pageTitle(key: keyof Dict["titles"]) {
  return async function generateMetadata(): Promise<Metadata> {
    const t = await getT();
    return { title: `${t.titles[key]} · AscendHabit` };
  };
}
