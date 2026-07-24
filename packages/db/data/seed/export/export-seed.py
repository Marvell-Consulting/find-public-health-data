#!/usr/bin/env python3
"""One-off export of the local-dev seed subset from the benchmark MSSQL `fphd_new`
database to gzipped CSVs.

Run on the benchmark VM (needs pyodbc + ODBC Driver 18):

    MSSQL_PASSWORD=... python3 export-seed.py /tmp/seed-out

then copy the resulting *.csv.gz into packages/db/data/seed/.

The subset: 10 indicators chosen for diverse value types and dimension shapes,
observations restricted to core administrative geographies (England, statistical
regions, counties, upper- and lower-tier authorities) from 2015 onwards (2021+ for
the large resident-population indicator). Reference/registry tables export in full.
"""

import csv
import gzip
import json
import os
import sys
from datetime import date, datetime

import pyodbc

INDICATORS = [108, 40501, 90366, 90851, 92026, 92033, 92443, 92708, 93622, 94194]
AREA_TYPES = [6, 15, 160, 170, 180]
YEAR_FLOOR_DEFAULT = "2015-01-01"
YEAR_FLOORS = {92708: "2021-01-01"}

IND = ",".join(str(i) for i in INDICATORS)
ATS = ",".join(str(i) for i in AREA_TYPES)
FLOOR_CASE = "CASE " + " ".join(
    f"WHEN o.indicator_id = {i} THEN '{f}'" for i, f in YEAR_FLOORS.items()
) + f" ELSE '{YEAR_FLOOR_DEFAULT}' END"

OBS_WHERE = (
    f"o.indicator_id IN ({IND}) "
    f"AND o.area_id IN (SELECT id FROM area WHERE area_type_id IN ({ATS})) "
    f"AND o.from_date >= {FLOOR_CASE}"
)

OBS_COLS = (
    "id,indicator_id,area_id,from_date,to_date,value,count,denominator,denominator_2,"
    "lower_ci_95,upper_ci_95,lower_ci_998,upper_ci_998,distribution_rank,published_at,"
    "upload_batch_id,created_at,created_by,deleted_at"
)

TABLES = [
    ("value_type", "SELECT id,name FROM value_type"),
    ("unit", "SELECT id,name,label,multiplier FROM unit"),
    ("year_type", "SELECT id,name FROM year_type"),
    ("ci_method", "SELECT id,name,description FROM ci_method"),
    ("polarity", "SELECT id,name FROM polarity"),
    ("frequency", "SELECT id,name FROM frequency"),
    ("comparator_method", "SELECT id,name FROM comparator_method"),
    ("data_source", "SELECT id,name,url FROM data_source"),
    ("numerator_denominator_source", "SELECT id,name,url FROM numerator_denominator_source"),
    (
        "dimension_type",
        "SELECT id,name,dimension_class,classification_scheme,granularity,scheme_version,"
        "is_required FROM dimension_type",
    ),
    (
        "dimension_value",
        "SELECT id,dimension_type_id,parent_id,name,code,sort_order,is_aggregate "
        "FROM dimension_value",
    ),
    ("area_type", "SELECT id,name,hierarchy_type,level FROM area_type"),
    (
        "area",
        f"SELECT id,code,name,area_type_id,valid_from,valid_to FROM area "
        f"WHERE area_type_id IN ({ATS})",
    ),
    (
        "area_relationship",
        f"SELECT id,parent_area_id,child_area_id,valid_from,valid_to FROM area_relationship "
        f"WHERE parent_area_id IN (SELECT id FROM area WHERE area_type_id IN ({ATS})) "
        f"AND child_area_id IN (SELECT id FROM area WHERE area_type_id IN ({ATS}))",
    ),
    (
        "indicator",
        "SELECT id,name,value_type_id,unit_id,year_type_id,ci_method_id,polarity_id,"
        "frequency_id,comparator_method_id,disclosure_threshold,ci_confidence_level,"
        "supersedes_id,status,reviewed_at,reviewed_by,config,created_at,created_by,"
        f"updated_at,updated_by FROM indicator WHERE id IN ({IND})",
    ),
    (
        "indicator_metadata",
        "SELECT id,indicator_id,definition,rationale,methodology,numerator_definition,"
        "denominator_definition,disclosure_control,caveats,notes,data_source_id,"
        "numerator_source_id,denominator_source_id FROM indicator_metadata "
        f"WHERE indicator_id IN ({IND})",
    ),
    (
        "upload_batch",
        "SELECT id,indicator_id,original_filename,uploaded_by,uploaded_at,status,"
        f"validation_result,superseded_by_id FROM upload_batch WHERE indicator_id IN ({IND})",
    ),
    ("note_type", "SELECT id,text,category FROM note_type"),
    ("observation", f"SELECT {OBS_COLS} FROM observation o WHERE {OBS_WHERE}"),
    (
        "observation_dimension",
        "SELECT od.id,od.observation_id,od.dimension_value_id FROM observation_dimension od "
        f"JOIN observation o ON o.id = od.observation_id WHERE {OBS_WHERE}",
    ),
    (
        "observation_note",
        "SELECT n.id,n.observation_id,n.note_type_id FROM observation_note n "
        f"JOIN observation o ON o.id = n.observation_id WHERE {OBS_WHERE}",
    ),
]


def pholio_config_to_json(raw):
    """fphd_new stores indicator config as Pholio-style `key:value,key:value` text;
    the PG column is jsonb."""
    if raw is None:
        return None
    obj = {}
    for pair in raw.split(","):
        key, _, value = pair.partition(":")
        value = value.strip()
        obj[key.strip()] = int(value) if value.lstrip("-").isdigit() else value
    return json.dumps(obj)


TRANSFORMS = {("indicator", "config"): pholio_config_to_json}


def cell(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return "t" if v else "f"
    if isinstance(v, (datetime, date)):
        return v.isoformat(sep=" ") if isinstance(v, datetime) else v.isoformat()
    return v


def main(out_dir):
    password = os.environ["MSSQL_PASSWORD"]
    conn = pyodbc.connect(
        "DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost;DATABASE=fphd_new;"
        f"UID=sa;PWD={password};TrustServerCertificate=yes;",
        autocommit=True,
    )
    os.makedirs(out_dir, exist_ok=True)
    for table, query in TABLES:
        cur = conn.cursor()
        cur.execute(query)
        headers = [c[0] for c in cur.description]
        transforms = {
            i: fn for i, h in enumerate(headers) if (fn := TRANSFORMS.get((table, h)))
        }
        path = os.path.join(out_dir, f"{table}.csv.gz")
        rows = 0
        with gzip.open(path, "wt", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            while True:
                batch = cur.fetchmany(50_000)
                if not batch:
                    break
                writer.writerows(
                    [
                        cell(transforms[i](v) if i in transforms else v)
                        for i, v in enumerate(row)
                    ]
                    for row in batch
                )
                rows += len(batch)
        cur.close()
        print(f"{table}: {rows} rows -> {path}")
    conn.close()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "seed-out")
