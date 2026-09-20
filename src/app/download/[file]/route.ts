import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Serves the node installer's artifacts. Public on purpose: a node fetches these before it has
 * any credential, and none of them are secret — the agent binary, its checksum, and its
 * systemd unit.
 *
 * The allowlist is an exact-match map, not a path join against user input, so there is no
 * traversal to defend against.
 */
const ARTIFACTS: Record<string, { path: string[]; type: string }> = {
  'cloud-vpn-agent': {
    path: ['agent', 'dist', 'cloud-vpn-agent'],
    type: 'application/octet-stream',
  },
  'cloud-vpn-agent.sha256': {
    path: ['agent', 'dist', 'cloud-vpn-agent.sha256'],
    type: 'text/plain; charset=utf-8',
  },
  'cloud-vpn-agent.service': {
    path: ['agent', 'cloud-vpn-agent.service'],
    type: 'text/plain; charset=utf-8',
  },
};

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const artifact = ARTIFACTS[file];
  if (!artifact) return new Response('not found', { status: 404 });

  try {
    const body = await readFile(join(process.cwd(), ...artifact.path));
    return new Response(new Uint8Array(body), {
      headers: {
        'content-type': artifact.type,
        'content-length': String(body.byteLength),
        'cache-control': 'no-store',
      },
    });
  } catch {
    // Almost always a deploy that shipped without running agent/build.sh — say so plainly
    // rather than returning an empty 200 the installer would happily write to disk.
    console.error(`missing build artifact: ${file} — run agent/build.sh`);
    return new Response(`${file} has not been built on this control plane`, { status: 503 });
  }
}
