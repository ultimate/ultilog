import { auth } from "../../../auth";
import { LogbookApp } from "../../components/LogbookApp";

export default async function RoutedLogbookPage() {
  const session = await auth();
  return <LogbookApp userId={session?.user?.id} userEmail={session?.user?.email ?? undefined} userName={session?.user?.name ?? undefined} userGroups={session?.user?.groups ?? []} />;
}
