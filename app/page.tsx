import { auth } from "../auth";
import { LogbookApp } from "./components/LogbookApp";

export default async function Home() {
  const session = await auth();
  return <LogbookApp userEmail={session?.user?.email ?? undefined} />;
}
