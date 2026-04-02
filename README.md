AI chat in UI
<img width="3006" height="1254" alt="image" src="https://github.com/user-attachments/assets/71e971d8-fe28-4a77-a34b-936659383e4b" />

Final UI rendred from analysed dataset.
<img width="1818" height="1646" alt="image" src="https://github.com/user-attachments/assets/f8a38bd6-a527-4fc3-9f80-72e21b04d2a1" />

AIrflow Snapshot with successful DAG flow.
<img width="2998" height="1616" alt="image" src="https://github.com/user-attachments/assets/8b2f5431-f0fd-4ee6-9190-4ea48ccd1c18" />


# elt-pipeline-ai

An end-to-end ELT pipeline built to answer a real question: **how did California K-12 student performance change before and after the pandemic?**

This project extracts public education data, loads it into PostgreSQL, transforms it with dbt, orchestrates everything with Airflow, and runs an automated anomaly detection layer that explains data quality failures in plain English.

---

## The problem

Education data is publicly available but hard to use. It lives across multiple APIs, uses inconsistent schemas, and has no automated quality checks. A data engineer stepping into this space needs a pipeline that can extract, clean, test, and flag anomalies — reliably, every day.

## The solution

A fully containerized ELT pipeline with five layers:

```
Urban Institute CCD API  ──┐
                            ├──► PostgreSQL ──► dbt staging ──► dbt marts ──► anomaly report
NAEP Assessment API     ──┘
                                   ▲
                            Airflow DAG orchestrates all of it
```

## What the data shows

After building the pipeline, the mart tables tell a clear story:

| Subject | Grade | 2019 score | 2022 score | Change |
|---------|-------|-----------|-----------|--------|
| Math    | 4     | 234.72    | 230.36    | -4.36  |
| Math    | 8     | 275.61    | 269.81    | -5.80  |
| Reading | 4     | 216.48    | 214.39    | -2.09  |
| Reading | 8     | 258.83    | 258.79    | -0.04  |

Math scores declined across both grades. Grade 8 math was hit hardest. Reading at grade 8 was the most resilient — barely moved. This kind of pre/post comparison is exactly what district analysts and policy teams need, and it comes out of a fully automated pipeline.

---

## Stack

| Layer | Tool |
|-------|------|
| Containerization | Docker + Docker Compose |
| Database | PostgreSQL 15 |
| Transformation | dbt 1.11 + dbt-utils |
| Orchestration | Apache Airflow 2.10 |
| Language | Python 3.13 |
| Package management | Poetry 2.3 |
| Anomaly detection | Rule-based (Claude API ready) |

---

## Data sources

**Urban Institute Education Data API** — free, no key required. Provides CCD school-level enrollment data for California public schools, disaggregated by grade, race, and sex.

**NAEP Data Service API** — free, no key required. Provides state-level average assessment scores for math and reading at grades 4 and 8, for 2019 and 2022.

---

## Data model

### Raw layer (`public` schema)

`raw_enrollment` — one row per school per grade. 9,978 rows covering all California public schools for grades 4 and 8 in 2022.

`raw_assessments` — one row per subject/grade/year combination. 8 rows total — California state-level average NAEP scores for math and reading across grades 4 and 8 for 2019 and 2022.

### Staging layer (`k12_staging` schema)

`stg_enrollment` — cleaned view on raw enrollment. Filters nulls, validates grade values, casts types.

`stg_assessments` — cleaned view on raw assessments. Rounds scores to 2 decimal places, filters to California only.

### Marts layer (`k12_marts` schema)

`mart_enrollment_summary` — aggregated by year and grade. Total enrollment, school count, district count, average enrollment per school.

`mart_assessment_trends` — joins 2019 and 2022 scores side by side. Computes score change and labels each as improved, declined, or unchanged.

---

## Anomaly detection

After `dbt test` runs, `llm/explainer.py` reads the test output and generates a structured report.

**Sample output when all tests pass:**
```
ELT Anomaly Report — 2026-03-30 05:01:14
============================================================
Status: ALL TESTS PASSED — pipeline healthy.
```

**Sample output when tests fail:**
```
ELT Anomaly Report — 2026-03-30 05:06:50
============================================================
Total failures detected: 2

FAILURE 1: dbt_utils_accepted_range_stg_enrollment_enrollment__10000__0
  Status:         ERROR
  Explanation:    A numeric field is out of the expected range.
  Recommendation: Check for data entry errors or API changes in the source.

FAILURE 2: not_null_stg_enrollment_enrollment
  Status:         ERROR
  Explanation:    A required field contains NULL values.
  Recommendation: Check the source data and extract logic for missing values.
```

The Claude API hook is built in and ready — swap 3 lines in `llm/explainer.py` to get LLM-generated explanations instead of rule-based ones.

---

## Project structure

```
elt-pipeline-ai/
├── extract/
│   └── extract_transform.py     # pulls from Urban Institute + NAEP APIs
├── load/
│   └── load.py                  # loads raw data into PostgreSQL
├── dbt_project/
│   └── elt_k12/
│       ├── models/
│       │   ├── staging/         # stg_enrollment, stg_assessments
│       │   └── marts/           # mart_enrollment_summary, mart_assessment_trends
│       ├── seeds/               # raw_enrollment.csv, raw_assessments.csv
│       └── tests/
├── airflow/
│   └── dags/
│       └── elt_k12_dag.py       # full orchestration DAG
├── llm/
│   └── explainer.py             # anomaly detection + Claude API hook
├── docker-compose.yml           # PostgreSQL + Airflow stack
├── pyproject.toml               # Poetry dependencies
└── .env                         # credentials (not committed)
```

---

## How to run locally

**Prerequisites:** Python 3.13, Docker Desktop, Poetry

**1. Clone and install dependencies**
```bash
git clone https://github.com/RebeccaRaezada/elt_pipeline_ai.git
cd elt_pipeline_ai
poetry install
eval $(poetry env activate)
```

**2. Set up environment variables**

Create a `.env` file in the project root:
```
ANTHROPIC_API_KEY=add_when_ready
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=elt_db
POSTGRES_USER=elt_user
POSTGRES_PASSWORD=elt_pass
```

**3. Start the stack**
```bash
docker compose up -d
```

This starts PostgreSQL on port 5432 and Airflow on port 8080.

**4. Set up dbt**
```bash
cd dbt_project/elt_k12
poetry run dbt deps
poetry run dbt seed
poetry run dbt run
poetry run dbt test
```

**5. Run the anomaly detector**
```bash
cd ../..
python llm/explainer.py
```

**6. Open Airflow**

Go to [http://localhost:8080](http://localhost:8080) — login `admin` / `admin`. Enable and trigger the `elt_k12_pipeline` DAG to run the full pipeline end to end.

---

## Enabling the Claude API

When you're ready to replace the rule-based explainer with Claude:

1. Add your API key to `.env`: `ANTHROPIC_API_KEY=sk-ant-...`
2. In `llm/explainer.py`, uncomment the `claude_analysis` function
3. Replace `report = rule_based_analysis(failures)` with `report = claude_analysis(dbt_output)`

That's it. The prompt is already written and tested.

---

## Airflow DAG

The `elt_k12_pipeline` DAG runs daily and executes four tasks in sequence:

```
dbt_deps → dbt_seed → dbt_run → dbt_test → llm_anomaly_check
```

Each task depends on the previous one. If `dbt_test` fails, the anomaly detector still runs and writes a report explaining what went wrong.

---

## Future improvements

- Add `dbt source freshness` checks to detect stale data
- Expand to all 50 states using the same APIs
- Add grade 12 assessment data for full K-12 coverage
- Enable the Claude API for richer anomaly explanations
- Add Slack alerting when anomaly report detects failures
- Containerize the dbt runs using the official dbt Docker image
