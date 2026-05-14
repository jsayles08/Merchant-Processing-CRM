import type { SignatureEntityType } from "@/lib/types";

export type SignatureProviderInput = {
  title: string;
  recipientName: string;
  recipientEmail: string;
  relatedEntityType: SignatureEntityType;
  relatedEntityId: string | null;
  documentId: string | null;
};

export type SignatureProviderResult = {
  provider: string;
  providerRequestId: string;
  signingUrl: string;
};

export async function createSignatureProviderRequest(
  input: SignatureProviderInput,
): Promise<SignatureProviderResult> {
  // TODO: Replace this mock provider with DocuSign, Dropbox Sign, PandaDoc, or Adobe Sign credentials.
  const providerRequestId = `mock-${input.relatedEntityType}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  return {
    provider: "mock",
    providerRequestId,
    signingUrl: `/documents?signature=${providerRequestId}`,
  };
}
