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
const agentBinary = (arch: string) => ({
  path: ['agent', 'dist', `cloud-vpn-agent-linux-${arch}`],
  type: 'application/octet-stream',
});
const agentChecksum = (arch: string) => ({
  path: ['agent', 'dist', `cloud-vpn-agent-linux-${arch}.sha256`],
  type: 'text/plain; charset=utf-8',
});

const ARTIFACTS: Record<string, { path: string[]; type: string }> = {
  'cloud-vpn-agent-linux-amd64': agentBinary('amd64'),
  'cloud-vpn-agent-linux-amd64.sha256': agentChecksum('amd64'),
  'cloud-vpn-agent-linux-arm64': agentBinary('arm64'),
  'cloud-vpn-agent-linux-arm64.sha256': agentChecksum('arm64'),
  // installers from before the per-architecture build ask for these, and they were always amd64
  'cloud-vpn-agent': agentBinary('amd64'),
  'cloud-vpn-agent.sha256': agentChecksum('amd64'),
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
    console.error(`missing build artifact: ${artifact.path.join('/')} — run agent/build.sh`);
    return new Response(`${file} has not been built on this control plane`, { status: 503 });
  }
}
