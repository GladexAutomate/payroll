// Virtual namespace / environment isolation for Base44 entities.
//
// Goal: the SAME single Base44 project behaves like two separate databases —
//   • In the editor PREVIEW  -> everything is tagged/queried as env: 'test'
//   • In the PUBLISHED app    -> everything is tagged/queried as env: 'prod'
//
// We achieve this WITHOUT touching every page: a JavaScript Proxy wraps
// base44.entities and transparently injects the env tag on writes and an env
// filter on reads.
//
// Migration-free design:
//   • Writes  : create/bulkCreate get { env } stamped on every record.
//   • Reads   : in PREVIEW we return ONLY { env: 'test' } records (clean sandbox).
//               in PUBLISHED we return records that are env 'prod' OR have no env
//               at all — so all of your existing (untagged) production data stays
//               fully visible with no backfill required.
//
// The User entity is intentionally NOT scoped (auth/identity is global), and
// any entity listed in UNSCOPED_ENTITIES is passed through untouched.

import { getAppEnv } from '@/lib/appEnv';

const CURRENT_ENV = getAppEnv() === 'preview' ? 'test' : 'prod';

// Entities that must NEVER be environment-scoped (shared across both worlds).
const UNSCOPED_ENTITIES = new Set([
  'User',
]);

// Methods that READ data — we inject an env filter.
const READ_FILTER_METHODS = new Set(['list', 'filter']);

// Build the env clause used in read queries.
function envReadClause() {
  if (CURRENT_ENV === 'test') {
    // Preview: strict sandbox — only test-tagged records.
    return { env: 'test' };
  }
  // Published: prod-tagged OR legacy untagged records.
  return { env: { $in: ['prod', null] } };
}

function mergeFilterObject(userFilter) {
  const clause = envReadClause();
  // Avoid clobbering an explicit env the caller may have set.
  if (userFilter && Object.prototype.hasOwnProperty.call(userFilter, 'env')) {
    return userFilter;
  }
  return { ...(userFilter || {}), ...clause };
}

function stamp(data) {
  if (Array.isArray(data)) {
    return data.map((d) => stamp(d));
  }
  if (data && typeof data === 'object') {
    // Respect an explicitly provided env, otherwise stamp the current one.
    if (Object.prototype.hasOwnProperty.call(data, 'env') && data.env) return data;
    return { ...data, env: CURRENT_ENV };
  }
  return data;
}

function wrapEntity(entityName, entitySdk) {
  if (UNSCOPED_ENTITIES.has(entityName)) return entitySdk;

  return new Proxy(entitySdk, {
    get(target, prop) {
      const original = target[prop];
      if (typeof original !== 'function') return original;

      // ---- Reads: inject env filter ----
      if (prop === 'filter') {
        return (userFilter, ...rest) => original.call(target, mergeFilterObject(userFilter), ...rest);
      }
      if (prop === 'list') {
        // list() has no filter arg, so route it through filter() with the env clause.
        return (...args) => target.filter(mergeFilterObject({}), ...args);
      }

      // ---- Writes: stamp env ----
      if (prop === 'create') {
        return (data, ...rest) => original.call(target, stamp(data), ...rest);
      }
      if (prop === 'bulkCreate') {
        return (data, ...rest) => original.call(target, stamp(data), ...rest);
      }

      // Everything else (get, update, delete, schema, subscribe, ...) passes through.
      return original.bind(target);
    },
  });
}

// Wrap the whole entities namespace so newly-referenced entities are auto-scoped too.
export function makeEnvScopedEntities(entities) {
  const cache = {};
  return new Proxy(entities, {
    get(target, entityName) {
      if (typeof entityName !== 'string') return target[entityName];
      const sdk = target[entityName];
      if (!sdk) return sdk;
      if (!cache[entityName]) cache[entityName] = wrapEntity(entityName, sdk);
      return cache[entityName];
    },
  });
}

export { CURRENT_ENV };