import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Serves the node installer so onboarding is a single curl. Public on purpose — the script
 * contains no secrets; the enrollment token is passed in as an argument by the operator.
 */
export async function GET() {
  const script = await readFile(join(process.cwd(), 'agent', 'install.sh'), 'utf8');
  return new Response(script, {
    headers: { 'content-type': 'text/x-shellscript; charset=utf-8', 'cache-control': 'no-store' },
  });
}
