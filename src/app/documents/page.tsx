import { AppShell } from "@/components/app-shell";
import { DocumentCenter } from "@/components/documents/document-center";
import { getCrmPageContext } from "@/lib/page-context";

export default async function DocumentsPage() {
  const { profile, data } = await getCrmPageContext("documents.view");

  return (
    <AppShell profile={profile} rolePermissions={data.rolePermissions} title="Documents" eyebrow="Merchant files" activeHref="/documents">
      <div className="w-full">
        <DocumentCenter data={data} />
      </div>
    </AppShell>
  );
}
