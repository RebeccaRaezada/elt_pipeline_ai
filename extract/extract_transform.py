import requests
from datetime import date

FIPS_CA = 6
GRADES = [4, 8]
SUBJECTS = [
    {"name": "mathematics", "subscale": "MRPCM",  "grades": [4, 8], "years": [2019, 2022]},
    {"name": "reading",     "subscale": "RRPCM",  "grades": [4, 8], "years": [2019, 2022]},
]
NAEP_YEARS = [2019, 2022]


def extract_enrollment(grade: int, year: int = 2022) -> list[dict]:
    url = f"https://educationdata.urban.org/api/v1/schools/ccd/enrollment/{year}/grade-{grade}/"
    params = {"fips": FIPS_CA, "limit": 500}
    rows = []
    retries = 3

    while url:
        for attempt in range(retries):
            try:
                r = requests.get(url, params=params, timeout=60)
                r.raise_for_status()
                break
            except requests.exceptions.RequestException as e:
                if attempt < retries - 1:
                    print(f"Attempt {attempt + 1} failed: {e}. Retrying...")
                    import time
                    time.sleep(5)
                else:
                    raise
        data = r.json()
        for rec in data["results"]:
            rows.append({
                "year":         rec["year"],
                "ncessch":      rec["ncessch"],
                "leaid":        rec["leaid"],
                "grade":        rec["grade"],
                "race":         rec["race"],
                "sex":          rec["sex"],
                "enrollment":   rec["enrollment"],
                "fips":         rec["fips"],
                "extracted_at": date.today().isoformat()
            })
        url = data.get("next")
        params = {}
    return rows


def extract_assessments(subject: dict, grade: int, year: int) -> list[dict]:
    url = "https://www.nationsreportcard.gov/Dataservice/GetAdhocData.aspx"
    params = {
        "type":         "data",
        "subject":      subject["name"],
        "grade":        grade,
        "subscale":     subject["subscale"],
        "variable":     "TOTAL",
        "jurisdiction": "CA",
        "stattype":     "MN:MN",
        "Year":         year
    }
    r = requests.get(url, params=params)
    r.raise_for_status()
    data = r.json()
    rows = []
    for rec in data.get("result", []):
        rows.append({
            "year":         rec["year"],
            "subject":      rec["subject"],
            "grade":        rec["grade"],
            "jurisdiction": rec["jurisdiction"],
            "avg_score":    rec["value"],
            "std_error":    rec.get("se"),
            "extracted_at": date.today().isoformat()
        })
    return rows


if __name__ == "__main__":
    # enrollment
    enrollment_rows = []
    for grade in GRADES:
        rows = extract_enrollment(grade=grade, year=2022)
        enrollment_rows.extend(rows)
        print(f"Enrollment grade {grade}: {len(rows)} rows")

    # assessments
    assessment_rows = []
    for subject in SUBJECTS:
        for grade in subject["grades"]:
            for year in subject["years"]:
                rows = extract_assessments(subject, grade, year)
                assessment_rows.extend(rows)
                print(f"Assessment {subject['name']} grade {grade} {year}: {len(rows)} rows")

    print(f"\nTotal enrollment rows:  {len(enrollment_rows)}")
    print(f"Total assessment rows:  {len(assessment_rows)}")
    print("\nSample enrollment:", enrollment_rows[0])
    print("Sample assessment:", assessment_rows[0])