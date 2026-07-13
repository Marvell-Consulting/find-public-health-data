import { InsetText, PageIntro } from '@fphd/ui';

export function ManageDataPage() {
  return (
    <PageIntro title="Manage public health data">
      <p className="govuk-body-l">
        This route exists only in the internal application. Publishing and administration features
        will be composed here.
      </p>
      <InsetText>Internal feature packages are ready to be added.</InsetText>
    </PageIntro>
  );
}
