import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { PublicFooter } from "@/components/PublicFooter";
import { SetupNotice } from "@/components/SetupNotice";
import { HashRedirect } from "@/components/HashRedirect";
import { getSiteData } from "@/lib/get-site";

export const revalidate = 60;

export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <SetupNotice message="NEXT_PUBLIC_SUPABASE_URL no definida (.env.local)" />
    );
  }

  try {
    await getSiteData();
  } catch (e) {
    return (
      <SetupNotice message={e instanceof Error ? e.message : String(e)} />
    );
  }

  return (
    <>
      <HashRedirect />
      <Navbar />
      <div className="public-body">{children}</div>
      <PublicFooter />
    </>
  );
}
