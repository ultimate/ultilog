import SharedLogbookPage from "../../[sheetId]/page";

export default async function OwnerScopedSharedLogbookPage({ params }: { params: Promise<{ ownerId: string; sheetId: string }> }) {
  const { ownerId, sheetId } = await params;
  return <SharedLogbookPage params={Promise.resolve({ ownerId, sheetId })} />;
}
