import type { Metadata } from "next";
import { ChangelogPage } from "../templates/ChangelogPage";

export const metadata: Metadata = {
  title: "What's new · Ultilog",
  description:
    "User-visible Ultilog changes grouped by their introducing source revision.",
};

export default function PublicChangelogPage() {
  return (
    <main className="public-changelog-shell">
      <ChangelogPage />
    </main>
  );
}
