#!/usr/bin/env python3
"""Map public Fingertips profiles and groups to the provisional demo topics."""

import json
import re
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

API = "https://fingertips.phe.org.uk/api/"
ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "published-indicator-topics.json"

# A profile is broad enough to serve as a topic when the two names describe the
# same subject. The narrower group mappings below cover topics inside mixed profiles.
PROFILE_TOPICS = {
    18: "smoking-and-tobacco",
    29: "respiratory-disease",
    30: "vaccination-and-infectious-disease",
    45: "sexual-and-reproductive-health",
    50: "mental-health-and-wellbeing",
    55: "liver-disease",
    58: "learning-disability-and-autism",
    65: "healthcare-access-use-and-quality",
    76: "musculoskeletal-health",
    84: "dementia-and-neurological-conditions",
    87: "alcohol",
    91: "suicide-self-harm-and-injury",
    92: "cancer",
    95: "end-of-life-and-palliative-care",
    101: "vaccination-and-infectious-disease",
    105: "children-and-young-peoples-health",
    125: "mortality-and-life-expectancy",
    132: "population-and-demographics",
    135: "cardiovascular-disease",
    139: "diabetes",
    159: "mental-health-and-wellbeing",
    165: "vision-and-hearing",
}

GROUP_TOPICS = {
    (20, "Practice summary"): "healthcare-access-use-and-quality",
    (20, "GP patient survey"): "healthcare-access-use-and-quality",
    (20, "Cancer"): "cancer",
    (20, "Diabetes"): "diabetes",
    (20, "Mental Health"): "mental-health-and-wellbeing",
    (20, "Respiratory Disease"): "respiratory-disease",
    (20, "Vaccinations"): "vaccination-and-infectious-disease",
    (26, "Child health"): "children-and-young-peoples-health",
    (26, "Life expectancy and causes of death"): "mortality-and-life-expectancy",
    (32, "Physical activity"): "physical-activity",
    (32, "Adult obesity"): "diet-nutrition-and-healthy-weight",
    (32, "Diet and nutrition"): "diet-nutrition-and-healthy-weight",
    (32, "Child BMI categories"): "diet-nutrition-and-healthy-weight",
    (32, "Child BMI categories small area data"): "diet-nutrition-and-healthy-weight",
    (32, "Child BMI tracking"): "diet-nutrition-and-healthy-weight",
    (32, "Child height"): "diet-nutrition-and-healthy-weight",
    (45, "Teenage Pregnancy"): "maternal-and-perinatal-health",
    (76, "Physical activity"): "physical-activity",
    (95, "Dementia"): "dementia-and-neurological-conditions",
    (105, "Pregnancy and birth"): "maternal-and-perinatal-health",
    (125, "Cancer"): "cancer",
    (125, "Cardiovascular disease"): "cardiovascular-disease",
    (125, "Child mortality"): "children-and-young-peoples-health",
    (125, "Dementia and Alzheimer's disease"): "dementia-and-neurological-conditions",
    (125, "Liver disease"): "liver-disease",
    (125, "Respiratory disease"): "respiratory-disease",
    (130, "Natural and built environment"): "housing-environment-and-place",
    (130, "Work and the labour market"): "work-and-worklessness",
    (130, "Income and vulnerability"): "income-poverty-and-deprivation",
    (130, "Crime"): "crime-safety-and-vulnerability",
    (130, "Education"): "education-and-early-development",
    (135, "Diabetes"): "diabetes",
    (135, "Kidney"): "kidney-disease",
    (143, "Our community"): "population-and-demographics",
    (155, "Spend"): "public-health-spend-and-finance",
    (159, "Factors affecting perinatal mental health"): "maternal-and-perinatal-health",
}

NAME_TOPICS = {
    "drugs-and-substance-misuse": re.compile(r"\b(drug misuse|drug treatment|drug-related|inject drugs|drugs and alcohol|substance misuse|opiate|opioid|cocaine|heroin|cannabis)\b", re.I),
    "oral-and-dental-health": re.compile(r"\b(dental|oral health|tooth|teeth|caries)\b", re.I),
    "older-peoples-health-and-healthy-ageing": re.compile(r"\b(older people|aged (65|75|85)|frailty|hip fracture|falls in people)\b", re.I),
    "kidney-disease": re.compile(r"\b(kidney|renal|CKD)\b", re.I),
    "physical-activity": re.compile(r"\b(physical activity|physically active|physical inactivity)\b", re.I),
    "maternal-and-perinatal-health": re.compile(r"\b(maternal|perinatal|pregnan|birthweight|stillbirth)\b", re.I),
    "smoking-and-tobacco": re.compile(r"\b(smoking|tobacco|smokers?)\b", re.I),
    "education-and-early-development": re.compile(r"\b(education|school|pupils?|GCSE|key stage|early years foundation|EYFSP)\b", re.I),
    "housing-environment-and-place": re.compile(r"\b(housing|homeless|rent|dwellings?|non-decent homes|affordable homes|air pollution|green space)\b", re.I),
    "healthcare-access-use-and-quality": re.compile(r"\b(GP services|hospital admissions?|healthcare|patient experience|social care services?)\b", re.I),
}


def fetch(path, params=None):
    url = API + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": "fphd-demo-topic-mapping/1.0"})
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)


def main():
    topics = {row["slug"]: row["id"] for row in json.loads((ROOT / "topics.json").read_text())}
    profiles = fetch("profiles")
    groups = {
        group["Id"]: (profile["Id"], group["Name"])
        for profile in profiles
        for group in profile["GroupMetadata"]
    }
    indicator_topics = defaultdict(set)
    indicator_names = {}
    group_ids = list(groups)
    for start in range(0, len(group_ids), 20):
        rows = fetch("indicator_names/by_group_id", {"group_ids": ",".join(map(str, group_ids[start:start + 20]))})
        for row in rows:
            fingertips_id = row["IndicatorId"]
            profile_id, group_name = groups[row["GroupId"]]
            indicator_names[fingertips_id] = row["IndicatorName"]
            if profile_id in PROFILE_TOPICS:
                indicator_topics[fingertips_id].add(PROFILE_TOPICS[profile_id])
            if (profile_id, group_name) in GROUP_TOPICS:
                indicator_topics[fingertips_id].add(GROUP_TOPICS[profile_id, group_name])

    for fingertips_id, name in indicator_names.items():
        for slug, pattern in NAME_TOPICS.items():
            if pattern.search(name):
                indicator_topics[fingertips_id].add(slug)

    for link in json.loads((ROOT / "indicator-topics.json").read_text())["indicatorTopics"]:
        slug = next(slug for slug, topic_id in topics.items() if topic_id == link["topicId"])
        indicator_topics[link["fingertipsId"]].add(slug)

    missing = set(topics) - {slug for slugs in indicator_topics.values() for slug in slugs}
    if missing:
        raise RuntimeError(f"Topics with no demo indicators: {', '.join(sorted(missing))}")
    links = [
        {"topicId": topics[slug], "fingertipsId": fingertips_id}
        for fingertips_id, slugs in sorted(indicator_topics.items())
        for slug in sorted(slugs)
    ]
    OUTPUT.write_text(json.dumps({
        "source": API,
        "generatedOn": date.today().isoformat(),
        "indicatorTopics": links,
    }, indent=2) + "\n")
    print(f"{len(links)} links for {len(indicator_topics)} indicators across {len(topics)} topics")


if __name__ == "__main__":
    main()
