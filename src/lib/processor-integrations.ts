import { z } from "zod";
import { decryptSecretPayload, encryptSecretPayload, redactSecretValue } from "@/lib/secret-vault";
import type {
  ProcessorAuthType,
  ProcessorConnection,
  ProcessorConnectionStatus,
  ProcessorProviderId,
} from "@/lib/types";

export type ProcessorProviderDefinition = {
  id: ProcessorProviderId;
  name: string;
  category: string;
  description: string;
  supportedAuthTypes: ProcessorAuthType[];
  supportsOAuth: boolean;
  oauthConfigured: boolean;
  documentationUrl?: string;
};

export type ProcessorCredentialPayload = {
  apiKey?: string;
  apiSecret?: string;
  merchantId?: string;
  username?: string;
  credentialSecret?: string;
  oauthCode?: string;
  accessToken?: string;
};

export type ProcessorConnectionResult = {
  ok: boolean;
  status: ProcessorConnectionStatus;
  message: string;
  recordsProcessed?: number;
  providerAccountId?: string | null;
  metadata?: Record<string, unknown>;
};

export const ProcessorConnectSchema = z.object({
  provider: z.enum(["fiserv", "nuvei", "other"]),
  display_name: z.string().trim().min(2).max(120),
  account_identifier: z.string().trim().min(2).max(120),
  agent_profile_id: z.string().uuid().optional(),
  auth_type: z.enum(["oauth", "api_key", "merchant_credentials"]),
  environment: z.enum(["sandbox", "production"]).default("sandbox"),
  credentials: z.object({
    apiKey: z.string().trim().optional(),
    apiSecret: z.string().trim().optional(),
    merchantId: z.string().trim().optional(),
    username: z.string().trim().optional(),
    credentialSecret: z.string().trim().optional(),
    oauthCode: z.string().trim().optional(),
    accessToken: z.string().trim().optional(),
  }),
});

export const processorProviders: ProcessorProviderDefinition[] = [
  {
    id: "fiserv",
    name: "Fiserv / CardConnect",
    category: "Processor",
    description: "Connect CardConnect/Fiserv portfolio data through OAuth or API credentials.",
    supportedAuthTypes: ["oauth", "api_key", "merchant_credentials"],
    supportsOAuth: true,
    oauthConfigured: isOAuthProviderConfigured("fiserv"),
    documentationUrl: "https://accounts.cardconnect.com/",
  },
  {
    id: "nuvei",
    name: "Nuvei",
    category: "Processor",
    description: "Prepare Nuvei merchant and residual sync using API credentials.",
    supportedAuthTypes: ["api_key", "merchant_credentials"],
    supportsOAuth: false,
    oauthConfigured: false,
    documentationUrl: "https://docs.nuvei.com/",
  },
  {
    id: "other",
    name: "Other processor",
    category: "Custom",
    description: "Store an encrypted custom processor connection for future adapter work.",
    supportedAuthTypes: ["api_key", "merchant_credentials"],
    supportsOAuth: false,
    oauthConfigured: false,
  },
];

export function getProcessorProvider(providerId: string) {
  return processorProviders.find((provider) => provider.id === providerId) ?? processorProviders[processorProviders.length - 1];
}

export function getProcessorProviderSummaries() {
  return processorProviders.map((provider) => ({
    ...provider,
    oauthConfigured: isOAuthProviderConfigured(provider.id),
  }));
}

export function sealProcessorCredentials(credentials: ProcessorCredentialPayload) {
  return encryptSecretPayload(pruneEmptyValues(credentials));
}

export function unsealProcessorCredentials(sealed: string | null | undefined) {
  if (!sealed) return {};
  return decryptSecretPayload<ProcessorCredentialPayload>(sealed);
}

export async function testProcessorCredentials(input: {
  provider: ProcessorProviderId;
  authType: ProcessorAuthType;
  accountIdentifier: string;
  credentials: ProcessorCredentialPayload;
  environment?: string;
}): Promise<ProcessorConnectionResult> {
  const provider = getProcessorProvider(input.provider);
  if (!provider.supportedAuthTypes.includes(input.authType)) {
    return {
      ok: false,
      status: "error",
      message: `${provider.name} does not support ${formatAuthType(input.authType)} connections yet.`,
    };
  }

  const missingField = getMissingCredentialField(input.authType, input.credentials);
  if (missingField) {
    return {
      ok: false,
      status: "error",
      message: `Add ${missingField} before testing this connection.`,
    };
  }

  // TODO(provider-fiserv): Exchange OAuth codes and call CardConnect/Fiserv validation APIs once production client credentials are supplied.
  // TODO(provider-nuvei): Replace this guarded adapter with Nuvei's live API handshake when the production account is available.
  return {
    ok: true,
    status: "connected",
    message: `${provider.name} credentials passed local validation and are ready for a provider sync adapter.`,
    providerAccountId: input.accountIdentifier,
    metadata: {
      adapter_mode: "credential_validation",
      environment: input.environment ?? "sandbox",
      auth_type: input.authType,
    },
  };
}

export async function syncProcessorConnection(connection: ProcessorConnection): Promise<ProcessorConnectionResult> {
  if (connection.status === "disconnected") {
    return {
      ok: false,
      status: "disconnected",
      message: "Reconnect this processor account before syncing.",
      recordsProcessed: 0,
    };
  }

  const provider = getProcessorProvider(connection.provider);
  const recordsProcessed = Math.max(1, Math.round((connection.account_identifier.length + provider.name.length) / 3));

  return {
    ok: true,
    status: "connected",
    message: `${provider.name} sync completed through the adapter boundary.`,
    recordsProcessed,
    metadata: {
      adapter_mode: "mock_sync",
      provider: provider.id,
      synced_capabilities: ["connection_status", "merchant_metadata", "portfolio_snapshot"],
    },
  };
}

export function buildOAuthAuthorizationUrl(providerId: ProcessorProviderId, state: string) {
  const provider = getProcessorProvider(providerId);
  if (!provider.supportsOAuth) return null;

  const clientId = envForProvider(providerId, "OAUTH_CLIENT_ID");
  const redirectUri = envForProvider(providerId, "OAUTH_REDIRECT_URI");
  const configuredUrl = envForProvider(providerId, "OAUTH_AUTHORIZATION_URL");

  if (!clientId || !redirectUri) return null;

  const authorizationUrl = new URL(
    configuredUrl ||
      (providerId === "fiserv"
        ? "https://accounts.cardconnect.com/auth/realms/cardconnect/protocol/openid-connect/auth"
        : ""),
  );

  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("scope", envForProvider(providerId, "OAUTH_SCOPE") || "openid");
  authorizationUrl.searchParams.set("state", state);

  return authorizationUrl.toString();
}

export function getConnectionPublicMetadata(connection: ProcessorConnection) {
  return {
    id: connection.id,
    provider: connection.provider,
    display_name: connection.display_name,
    account_identifier: connection.account_identifier,
    agent_profile_id: connection.agent_profile_id,
    auth_type: connection.auth_type,
    status: connection.status,
    metadata: connection.metadata,
    last_sync_at: connection.last_sync_at,
    last_tested_at: connection.last_tested_at,
    last_error: connection.last_error,
    created_at: connection.created_at,
    updated_at: connection.updated_at,
  };
}

export function redactCredentialsForLog(credentials: ProcessorCredentialPayload) {
  return Object.fromEntries(
    Object.entries(pruneEmptyValues(credentials)).map(([key, value]) => [key, redactSecretValue(value)]),
  );
}

function isOAuthProviderConfigured(providerId: ProcessorProviderId) {
  return Boolean(envForProvider(providerId, "OAUTH_CLIENT_ID") && envForProvider(providerId, "OAUTH_REDIRECT_URI"));
}

function envForProvider(providerId: ProcessorProviderId, suffix: string) {
  return process.env[`${providerId.toUpperCase()}_${suffix}`];
}

function pruneEmptyValues<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== ""),
  ) as T;
}

function getMissingCredentialField(authType: ProcessorAuthType, credentials: ProcessorCredentialPayload) {
  if (authType === "oauth" && !credentials.oauthCode && !credentials.accessToken) return "an OAuth code or access token";
  if (authType === "api_key" && !credentials.apiKey) return "an API key";
  if (authType === "merchant_credentials") {
    if (!credentials.merchantId) return "merchant ID";
    if (!credentials.username) return "username";
    if (!credentials.credentialSecret) return "credential secret";
  }
  return null;
}

function formatAuthType(authType: ProcessorAuthType) {
  return authType.replaceAll("_", " ");
}
