import { Button, PageIntro } from '@fphd/ui';

interface SignInLandingPageProps {
  signInHref: string;
}

export function SignInLandingPage({ signInHref }: SignInLandingPageProps) {
  return (
    <PageIntro title="Sign in to manage indicators">
      <Button href={signInHref}>Sign in</Button>
    </PageIntro>
  );
}
