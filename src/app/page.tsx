import { redirect } from "next/navigation";

// El proxy ya envía a /login si no hay sesión
export default function Home() {
  redirect("/today");
}
