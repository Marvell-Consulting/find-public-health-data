import { readFile, writeFile } from 'node:fs/promises';

const api = 'https://fingertips.phe.org.uk/api/';

const profileTopics: Record<number, string> = {
  18: 'smoking-and-tobacco',
  29: 'respiratory-disease',
  30: 'vaccination-and-infectious-disease',
  45: 'sexual-and-reproductive-health',
  50: 'mental-health-and-wellbeing',
  55: 'liver-disease',
  58: 'learning-disability-and-autism',
  65: 'healthcare-access-use-and-quality',
  76: 'musculoskeletal-health',
  84: 'dementia-and-neurological-conditions',
  87: 'alcohol',
  91: 'suicide-self-harm-and-injury',
  92: 'cancer',
  95: 'end-of-life-and-palliative-care',
  101: 'vaccination-and-infectious-disease',
  105: 'children-and-young-peoples-health',
  125: 'mortality-and-life-expectancy',
  132: 'population-and-demographics',
  135: 'cardiovascular-disease',
  139: 'diabetes',
  159: 'mental-health-and-wellbeing',
  165: 'vision-and-hearing',
};

const groupTopics: Record<string, string> = Object.fromEntries(
  (
    [
      [20, 'Practice summary', 'healthcare-access-use-and-quality'],
      [20, 'GP patient survey', 'healthcare-access-use-and-quality'],
      [20, 'Cancer', 'cancer'],
      [20, 'Diabetes', 'diabetes'],
      [20, 'Mental Health', 'mental-health-and-wellbeing'],
      [20, 'Respiratory Disease', 'respiratory-disease'],
      [20, 'Vaccinations', 'vaccination-and-infectious-disease'],
      [26, 'Child health', 'children-and-young-peoples-health'],
      [26, 'Life expectancy and causes of death', 'mortality-and-life-expectancy'],
      [32, 'Physical activity', 'physical-activity'],
      [32, 'Adult obesity', 'diet-nutrition-and-healthy-weight'],
      [32, 'Diet and nutrition', 'diet-nutrition-and-healthy-weight'],
      [32, 'Child BMI categories', 'diet-nutrition-and-healthy-weight'],
      [32, 'Child BMI categories small area data', 'diet-nutrition-and-healthy-weight'],
      [32, 'Child BMI tracking', 'diet-nutrition-and-healthy-weight'],
      [32, 'Child height', 'diet-nutrition-and-healthy-weight'],
      [45, 'Teenage Pregnancy', 'maternal-and-perinatal-health'],
      [76, 'Physical activity', 'physical-activity'],
      [95, 'Dementia', 'dementia-and-neurological-conditions'],
      [105, 'Pregnancy and birth', 'maternal-and-perinatal-health'],
      [125, 'Cancer', 'cancer'],
      [125, 'Cardiovascular disease', 'cardiovascular-disease'],
      [125, 'Child mortality', 'children-and-young-peoples-health'],
      [125, "Dementia and Alzheimer's disease", 'dementia-and-neurological-conditions'],
      [125, 'Liver disease', 'liver-disease'],
      [125, 'Respiratory disease', 'respiratory-disease'],
      [130, 'Natural and built environment', 'housing-environment-and-place'],
      [130, 'Work and the labour market', 'work-and-worklessness'],
      [130, 'Income and vulnerability', 'income-poverty-and-deprivation'],
      [130, 'Crime', 'crime-safety-and-vulnerability'],
      [130, 'Education', 'education-and-early-development'],
      [135, 'Diabetes', 'diabetes'],
      [135, 'Kidney', 'kidney-disease'],
      [143, 'Our community', 'population-and-demographics'],
      [155, 'Spend', 'public-health-spend-and-finance'],
      [159, 'Factors affecting perinatal mental health', 'maternal-and-perinatal-health'],
    ] satisfies [number, string, string][]
  ).map(([profile, group, topic]) => [`${profile}\u0000${group}`, topic]),
);

const nameTopics: Record<string, RegExp> = {
  'drugs-and-substance-misuse':
    /\b(drug misuse|drug treatment|drug-related|inject drugs|drugs and alcohol|substance misuse|opiate|opioid|cocaine|heroin|cannabis)\b/i,
  'oral-and-dental-health': /\b(dental|oral health|tooth|teeth|caries)\b/i,
  'older-peoples-health-and-healthy-ageing':
    /\b(older people|aged (65|75|85)|frailty|hip fracture|falls in people)\b/i,
  'kidney-disease': /\b(kidney|renal|CKD)\b/i,
  'physical-activity': /\b(physical activity|physically active|physical inactivity)\b/i,
  'maternal-and-perinatal-health': /\b(maternal|perinatal|pregnan|birthweight|stillbirth)\b/i,
  'smoking-and-tobacco': /\b(smoking|tobacco|smokers?)\b/i,
  'education-and-early-development':
    /\b(education|school|pupils?|GCSE|key stage|early years foundation|EYFSP)\b/i,
  'housing-environment-and-place':
    /\b(housing|homeless|rent|dwellings?|non-decent homes|affordable homes|air pollution|green space)\b/i,
  'healthcare-access-use-and-quality':
    /\b(GP services|hospital admissions?|healthcare|patient experience|social care services?)\b/i,
};

interface Profile {
  Id: number;
  GroupMetadata: { Id: number; Name: string }[];
}
interface IndicatorName {
  IndicatorId: number;
  IndicatorName: string;
  GroupId: number;
}

async function get<T>(path: string, query?: URLSearchParams): Promise<T> {
  const url = new URL(path, api);
  if (query) url.search = query.toString();
  const response = await fetch(url, {
    headers: { 'user-agent': 'fphd-demo-topic-mapping/1.0' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`Fingertips returned HTTP ${response.status} for ${url}`);
  return (await response.json()) as T;
}

export async function generateDemoTopics(
  topicsPath: string,
  existingLinksPath: string,
  outputPath: string,
): Promise<void> {
  const topics = Object.fromEntries(
    (JSON.parse(await readFile(topicsPath, 'utf8')) as { id: string; slug: string }[]).map(
      ({ id, slug }) => [slug, id],
    ),
  );
  const profiles = await get<Profile[]>('profiles');
  const groups = new Map<number, [number, string]>();
  for (const profile of profiles) {
    for (const group of profile.GroupMetadata) groups.set(group.Id, [profile.Id, group.Name]);
  }
  const links = new Map<number, Set<string>>();
  const names = new Map<number, string>();
  const groupIds = [...groups.keys()];
  for (let index = 0; index < groupIds.length; index += 20) {
    const batch = groupIds.slice(index, index + 20);
    const rows = await get<IndicatorName[]>(
      'indicator_names/by_group_id',
      new URLSearchParams({ group_ids: batch.join(',') }),
    );
    for (const row of rows) {
      const [profile, group] = groups.get(row.GroupId) ?? [];
      if (profile === undefined || group === undefined) continue;
      names.set(row.IndicatorId, row.IndicatorName);
      const assigned = links.get(row.IndicatorId) ?? new Set<string>();
      const profileTopic = profileTopics[profile];
      const groupTopic = groupTopics[`${profile}\u0000${group}`];
      if (profileTopic) assigned.add(profileTopic);
      if (groupTopic) assigned.add(groupTopic);
      links.set(row.IndicatorId, assigned);
    }
  }
  for (const [id, name] of names) {
    for (const [slug, pattern] of Object.entries(nameTopics)) {
      if (pattern.test(name)) links.get(id)?.add(slug);
    }
  }
  const existing = JSON.parse(await readFile(existingLinksPath, 'utf8')) as {
    indicatorTopics: { topicId: string; fingertipsId: number }[];
  };
  const slugById = new Map(Object.entries(topics).map(([slug, id]) => [id, slug]));
  for (const link of existing.indicatorTopics) {
    const slug = slugById.get(link.topicId);
    if (slug)
      (
        links.get(link.fingertipsId) ??
        links.set(link.fingertipsId, new Set()).get(link.fingertipsId)
      )?.add(slug);
  }
  const mapped = [...links].flatMap(([fingertipsId, slugs]) =>
    [...slugs].sort().map((slug) => ({ topicId: topics[slug], fingertipsId })),
  );
  const used = new Set(mapped.map(({ topicId }) => topicId));
  const missing = Object.entries(topics).filter(([, id]) => !used.has(id));
  if (missing.length > 0)
    throw new Error(`Topics with no demo indicators: ${missing.map(([slug]) => slug).join(', ')}`);
  await writeFile(
    outputPath,
    `${JSON.stringify({ source: api, generatedOn: new Date().toISOString().slice(0, 10), indicatorTopics: mapped }, null, 2)}\n`,
  );
}
