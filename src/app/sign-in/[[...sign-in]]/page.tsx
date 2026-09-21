import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      {/* Accounts are created by an admin in Clerk — a sign-up link here leads nowhere good. */}
      <SignIn appearance={{ elements: { footerAction: { display: 'none' } } }} />
    </main>
  );
}
