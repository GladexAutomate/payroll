import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { makeEnvScopedEntities, CURRENT_ENV } from '@/lib/envScopedClient';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// Environment isolation: transparently scope every entity read/write to the
// current environment ('test' in editor preview, 'prod' in the published app),
// so preview data and production data never mix. See lib/envScopedClient.js.
const rawEntities = base44.entities;
base44.entities = makeEnvScopedEntities(rawEntities);

// Also inject the current env into every backend function call, so server-side
// functions that write entities can stamp records with the right environment.
const rawInvoke = base44.functions.invoke.bind(base44.functions);
base44.functions.invoke = (name, payload = {}, ...rest) => {
  const body = (payload && typeof payload === 'object' && !Array.isArray(payload))
    ? { env: CURRENT_ENV, ...payload }
    : payload;
  return rawInvoke(name, body, ...rest);
};