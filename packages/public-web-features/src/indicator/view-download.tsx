import { useLocation } from 'react-router';
import { DownloadShareData } from '../download-share.tsx';
import { indicatorCsvPath, indicatorMetadataPath } from './paths.ts';

export function IndicatorViewDownload({ slug, tab }: { slug: string; tab: string }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set('tab-indicator', tab);
  return (
    <DownloadShareData
      inline
      href={`${indicatorCsvPath(slug, 'table')}?${params}`}
      allDataHref={`${indicatorCsvPath(slug, 'all-data')}?allAreas=yes`}
      metadataHref={indicatorMetadataPath(slug)}
    />
  );
}
