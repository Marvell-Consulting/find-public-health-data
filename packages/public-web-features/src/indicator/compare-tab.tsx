import { ChartSection, FilterChip, FilterChips, GridColumn, GridRow } from '@fphd/ui';
import { useLocation } from 'react-router';
import { AreaControls } from './area-controls.tsx';
import { ComparePicker } from './compare-picker.tsx';
import type {
  AreaSummary,
  IndicatorAreaData,
  IndicatorSummary,
  SelectedIndicator,
} from './loader.ts';
import { IndicatorPairTable } from './tables/indicator-pair-table.tsx';
import { IndicatorViewDownload } from './view-download.tsx';

export interface ComparisonTabProps {
  primary: SelectedIndicator;
  compareAreasData: IndicatorAreaData[];
  compareAreaGroup: string;
  compareAreaOptions: AreaSummary[];
  comparisonDisplayGroups: string[];
}

export function CompareIndicatorsTab({
  primary,
  compared,
  compareAreasData,
  comparedAreasData,
  compareAreaOptions,
  compareAreaGroup,
  comparisonDisplayGroups,
  findResults,
  findSubject,
}: ComparisonTabProps & {
  compared: SelectedIndicator | undefined;
  comparedAreasData: IndicatorAreaData[];
  findResults: IndicatorSummary[];
  findSubject: string;
}) {
  const { detail } = primary;
  const id = detail.shortId;
  const params = new URLSearchParams(useLocation().search);
  return (
    <>
      <h2 className="govuk-heading-l">Compare indicators</h2>
      <GridRow>
        {compared ? (
          <GridColumn width="one-quarter">
            <AreaControls
              slug={detail.slug}
              group={compareAreaGroup}
              groups={comparisonDisplayGroups}
              areas={compareAreaOptions}
              displayOptions={false}
            />
          </GridColumn>
        ) : null}
        <GridColumn width={compared ? 'three-quarters' : 'two-thirds'}>
          <ComparePicker
            slug={detail.slug}
            key={compared?.detail.slug ?? 'unselected'}
            name={detail.name}
            compared={compared?.detail}
            findSubject={findSubject}
            findResults={findResults.filter(({ shortId }) => shortId !== id)}
          />
          {compared ? (
            <>
              <div className="fphd-indicator-showing">
                <p className="govuk-body-s govuk-!-margin-bottom-1">Showing:</p>
                <FilterChips>
                  <FilterChip value="E92000001">England</FilterChip>
                  <FilterChip value={compareAreaGroup}>{compareAreaGroup}</FilterChip>
                </FilterChips>
              </div>
              <IndicatorViewDownload slug={detail.slug} tab="compare" />
              <div className="fphd-indicator-chart fphd-indicator-chart--scatter">
                <h3 className="govuk-heading-s">Chart of indicator comparison</h3>
                <ChartSection
                  id="indicator-comparison-chart"
                  title="Indicator comparison scatter chart"
                  description={`${detail.name} compared with ${compared.detail.name} for the selected geographies.`}
                />
              </div>
              <IndicatorPairTable
                selected={[
                  {
                    ...primary,
                    areaData: [
                      ...primary.areaData.filter(({ areaCode }) => areaCode === 'E92000001'),
                      ...compareAreasData,
                    ],
                  },
                  {
                    ...compared,
                    areaData: [
                      ...compared.areaData.filter(({ areaCode }) => areaCode === 'E92000001'),
                      ...comparedAreasData,
                    ],
                  },
                ]}
                group={compareAreaGroup}
                highlighted={params.getAll('highlight')}
              />
            </>
          ) : null}
        </GridColumn>
      </GridRow>
    </>
  );
}
