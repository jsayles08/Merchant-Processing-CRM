import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { getCrmData } from "@/lib/data";
import { hasPermission, type PermissionKey } from "@/lib/permissions";

export async function getCrmPageContext(requiredPermission?: PermissionKey) {
  const { supabase, profile } = await getSessionContext();
  const data = await getCrmData(supabase);
  const currentAgent = data.agents.find((agent) => agent.profile_id === profile.id) ?? data.agents[0];

  if (requiredPermission && !hasPermission(profile.role, data.rolePermissions, requiredPermission)) {
    redirect("/dashboard");
  }

  return {
    supabase,
    profile,
    data,
    currentAgent,
    currentAgentId: currentAgent?.id ?? "",
  };
}
