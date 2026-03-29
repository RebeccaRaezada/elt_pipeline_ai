import psycopg2
import os
from dotenv import load_dotenv
from extract.extract_transform import extract_enrollment, extract_assessments, SUBJECTS

load_dotenv()

def get_conn():
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST"),
        port=os.getenv("POSTGRES_PORT"),
        dbname=os.getenv("POSTGRES_DB"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD")
    )

def create_tables(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS raw_enrollment (
            id            SERIAL PRIMARY KEY,
            year          INT,
            ncessch       VARCHAR(20),
            leaid         VARCHAR(20),
            grade         INT,
            race          INT,
            sex           INT,
            enrollment    INT,
            fips          INT,
            extracted_at  DATE
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS raw_assessments (
            id            SERIAL PRIMARY KEY,
            year          INT,
            subject       VARCHAR(20),
            grade         INT,
            jurisdiction  VARCHAR(5),
            avg_score     FLOAT,
            std_error     FLOAT,
            extracted_at  DATE
        )
    """)

def load_enrollment(rows: list[dict], cur):
    for row in rows:
        cur.execute("""
            INSERT INTO raw_enrollment
            (year, ncessch, leaid, grade, race, sex, enrollment, fips, extracted_at)
            VALUES (%(year)s, %(ncessch)s, %(leaid)s, %(grade)s, %(race)s,
                    %(sex)s, %(enrollment)s, %(fips)s, %(extracted_at)s)
        """, row)
    print(f"Loaded {len(rows)} enrollment rows")

def load_assessments(rows: list[dict], cur):
    for row in rows:
        cur.execute("""
            INSERT INTO raw_assessments
            (year, subject, grade, jurisdiction, avg_score, std_error, extracted_at)
            VALUES (%(year)s, %(subject)s, %(grade)s, %(jurisdiction)s,
                    %(avg_score)s, %(std_error)s, %(extracted_at)s)
        """, row)
    print(f"Loaded {len(rows)} assessment rows")

def main():
    conn = get_conn()
    cur = conn.cursor()
    create_tables(cur)
    conn.commit()

    # enrollment
    enrollment_rows = []
    for grade in [4, 8]:
        rows = extract_enrollment(grade=grade, year=2022)
        enrollment_rows.extend(rows)
    load_enrollment(enrollment_rows, cur)

    # assessments
    assessment_rows = []
    for subject in SUBJECTS:
        for grade in subject["grades"]:
            for year in subject["years"]:
                rows = extract_assessments(subject, grade, year)
                assessment_rows.extend(rows)
    load_assessments(assessment_rows, cur)

    conn.commit()
    cur.close()
    conn.close()
    print("Done.")

if __name__ == "__main__":
    main()