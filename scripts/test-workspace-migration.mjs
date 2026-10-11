import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const path='supabase/migrations/202610110001_rate_limits_and_retention.sql';
const sql=readFileSync(path,'utf8');
const functionBodies=(sql.match(/as \$\$/g)||[]).length;
const closingDelimiters=(sql.match(/^\$\$;$/gm)||[]).length;

assert.equal(functionBodies,2,'expected both rate-limit and workspace-deletion functions');
assert.equal(closingDelimiters,2,'each PL/pgSQL function must close its dollar-quoted body');
assert.match(sql,/create table if not exists public\.reasonlens_rate_limit_windows/i);
assert.match(sql,/alter table public\.reasonlens_rate_limit_windows enable row level security/i);
assert.match(sql,/grant select, insert, update, delete on table public\.reasonlens_rate_limit_windows to service_role/i);
assert.match(sql,/revoke all on function public\.reasonlens_consume_rate_limit\(uuid, text, integer, integer\) from public, anon, authenticated/i);
assert.match(sql,/grant execute on function public\.reasonlens_consume_rate_limit\(uuid, text, integer, integer\) to service_role/i);
assert.match(sql,/revoke all on function public\.reasonlens_delete_workspace\(uuid\) from public, anon, authenticated/i);
assert.match(sql,/grant execute on function public\.reasonlens_delete_workspace\(uuid\) to service_role/i);
assert.match(sql,/security invoker/ig);
console.log('Workspace migration structural checks passed.');
