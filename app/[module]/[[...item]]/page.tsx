import { auth } from "../../../auth";
import { LogbookApp } from "../../components/LogbookApp";
import { getBuildInfo } from "../../lib/build-info";

export default async function RoutedLogbookPage() {
  const session = await auth();
  return <LogbookApp buildInfo={getBuildInfo()} userId={session?.user?.id} userEmail={session?.user?.email ?? undefined} userName={session?.user?.name ?? undefined} userGroups={session?.user?.groups ?? []} />;
}
