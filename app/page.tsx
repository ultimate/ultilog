import { redirect } from "next/navigation";
import { auth, signOut } from "../auth";
import { LogbookApp } from "./components/LogbookApp";

export default async function Home() {
  const session = await auth();
  return (
    <>
      <form action={async () => { "use server"; await signOut({ redirect: false }); redirect("/login"); }} className="fixed right-4 top-4 z-50">
        <span className="mr-3 rounded-full bg-slate-950/70 px-3 py-2 text-sm text-white shadow">{session?.user?.email}</span>
        <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow" type="submit">Logout</button>
      </form>
      <LogbookApp />
    </>
  );
}
