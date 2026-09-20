import { redirect } from 'next/navigation';

/**
 * There is no marketing surface — this is an internal control plane. Land straight on the
 * dashboard; its layout sends anyone without a session to sign-in.
 */
export default function Home() {
  redirect('/dashboard');
}
