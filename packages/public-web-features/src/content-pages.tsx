import type { AppAudience, FakeUser } from '@fphd/auth';
import { A, Button, PageIntro, Radios } from '@fphd/ui';

export function ReleasesPage() {
  return (
    <PageIntro title="Releases">
      <p className="govuk-body">Public health indicator release history will be published here.</p>
    </PageIntro>
  );
}

export interface SignInSession {
  readonly roles: readonly string[];
  readonly subject: string;
}

interface SignInPageProps {
  audience: AppAudience;
  returnTo: string;
  session?: SignInSession;
  users: readonly FakeUser[];
}

export function SignInPage({ audience, returnTo, session, users }: SignInPageProps) {
  if (session !== undefined) {
    const user = users.find((candidate) => candidate.id === session.subject);

    return (
      <PageIntro title="Your account">
        <p className="govuk-body">
          You are signed in as <strong>{user?.name ?? session.subject}</strong>.
        </p>
        {audience === 'internal' && !session.roles.includes('internal') ? (
          <p className="govuk-body">This account cannot access the internal service.</p>
        ) : (
          <p className="govuk-body">
            <A href={returnTo}>Continue to the service</A>
          </p>
        )}
        <form action="/auth/sign-out" method="post">
          <input name="returnTo" type="hidden" value="/sign-in" />
          <Button type="submit">Sign out</Button>
        </form>
      </PageIntro>
    );
  }

  return (
    <PageIntro title="Sign in">
      <p className="govuk-body">
        Select a fake user to test the {audience} service. No password is required.
      </p>
      <form action="/auth/sign-in" method="post">
        <input name="returnTo" type="hidden" value={returnTo} />
        <Radios
          label="Choose a user"
          name="userId"
          options={users.map((user) => ({
            hint: user.description,
            label: user.name,
            value: user.id,
          }))}
          required
        />
        <Button type="submit">Sign in</Button>
      </form>
    </PageIntro>
  );
}
