import { NextResponse } from 'next/server';
import { z } from 'zod';

import { enrollNode, EnrollmentError } from '@/server/enrollment';

/**
 * Public by design — the enrollment token is the credential. A node calls this once, right
 * after install, to register itself. Nothing is trusted on the token's word alone: the control
 * plane probes the agent before creating the node.
 */
const Body = z.object({
  token: z.string().min(1),
  endpoint: z.string().min(1),
  agent_url: z.string().min(1),
  agent_token: z.string().min(1),
  agent_cert: z.string().min(1),
  interface_address: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'malformed enrollment request' }, { status: 400 });
  }

  try {
    const node = await enrollNode({
      token: parsed.data.token,
      endpoint: parsed.data.endpoint,
      agentUrl: parsed.data.agent_url,
      agentToken: parsed.data.agent_token,
      agentCert: parsed.data.agent_cert,
      interfaceAddress: parsed.data.interface_address,
    });
    return NextResponse.json({ ok: true, node: { id: node.id, name: node.name } });
  } catch (error) {
    if (error instanceof EnrollmentError) {
      // 422 when the token was fine but the node isn't ready — the installer can say which.
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'preflight' ? 422 : error.code === 'duplicate' ? 409 : 401 },
      );
    }
    console.error('enrollment failed', error);
    return NextResponse.json({ error: 'enrollment failed' }, { status: 500 });
  }
}
