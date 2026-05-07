import { AppShell } from "@/components/app-shell";
import { DocumentCenter } from "@/components/documents/document-center";
import { getCrmPageContext } from "@/lib/page-context";

export default async function DocumentsPage() {
  const { profile, data } = await getCrmPageContext();

  return (
    <AppShell profile={profile} title="Documents" eyebrow="Merchant files" activeHref="/documents">
      <div className="mx-auto max-w-[1500px]">
        <DocumentCenter data={data} />
      </div>
    </AppShell>
  );
}
