import { catalogByKey, type Provider } from "./mock-data";
import type {
  ProviderCreateBody,
  ProviderUpdateBody,
  WireProvider,
} from "./providers-api";
import type { ProviderFormValues } from "@/components/widgets/provider-form";

// Translates backend WireProvider rows into the UI Provider shape and form
// values into request bodies. Presentation fields the backend doesn't store
// (name, icon, masked, usage) are derived client-side from the provider kind.

export function wireToUiProvider(wire: WireProvider): Provider {
  const catalog = catalogByKey(wire.providerKind);
  const host = wire.baseUrl ?? catalog?.host ?? "";
  return {
    id: wire.id,
    providerKey: wire.providerKind,
    name: catalog?.name ?? wire.providerKind,
    keyLabel: wire.displayName,
    icon: catalog?.icon ?? "package",
    status: !wire.isEnabled
      ? "disabled"
      : wire.providerKind === "ollama"
        ? "local"
        : "connected",
    masked: wire.hasKey && wire.lastFour ? `•••••••••••••••• ${wire.lastFour}` : host,
    host,
    model: wire.defaultModel ?? "",
    usage: 0,
    scope: wire.scope,
  };
}

export function uiFormToCreateBody(values: ProviderFormValues): ProviderCreateBody {
  return {
    displayName: values.keyLabel,
    providerKind: values.providerKey as ProviderCreateBody["providerKind"],
    ...(values.key ? { apiKey: values.key } : {}),
    ...(values.host ? { baseUrl: values.host } : {}),
    ...(values.model ? { defaultModel: values.model } : {}),
    scope: values.scope,
  };
}

export function uiFormToUpdateBody(values: ProviderFormValues): ProviderUpdateBody {
  return {
    displayName: values.keyLabel,
    ...(values.host ? { baseUrl: values.host } : {}),
    ...(values.model ? { defaultModel: values.model } : {}),
    scope: values.scope,
  };
}
