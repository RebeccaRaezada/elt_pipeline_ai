import os
import re
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DBT_OUTPUT_FILE = "/tmp/dbt_test_output.txt"
REPORT_FILE = "/opt/airflow/logs/anomaly_report.txt"


def read_dbt_output() -> str | None:
    if not os.path.exists(DBT_OUTPUT_FILE):
        print(f"No dbt output found at {DBT_OUTPUT_FILE}")
        return None
    with open(DBT_OUTPUT_FILE) as f:
        content = f.read()
    if "ERROR" not in content and "FAIL" not in content:
        print("All dbt tests passed — pipeline healthy.")
        return None
    return content


def parse_failures(dbt_output: str) -> list[dict]:
    failures = []
    for line in dbt_output.splitlines():
        if "FAIL" in line or "ERROR" in line:
            test_match = re.search(r"(FAIL|ERROR)\s+(\S+)", line)
            if test_match:
                failures.append({
                    "status": test_match.group(1),
                    "test":   test_match.group(2)
                })
    return failures


def rule_based_analysis(failures: list[dict]) -> str:
    rules = {
        "not_null":       ("A required field contains NULL values.",
                           "Check the source data and extract logic for missing values."),
        "unique":         ("Duplicate records detected.",
                           "Add deduplication logic in the staging model or extract layer."),
        "accepted_values":("A field contains values outside the accepted list.",
                           "Verify the source API hasn't introduced new categories."),
        "accepted_range": ("A numeric field is out of the expected range.",
                           "Check for data entry errors or API changes in the source."),
    }

    lines = [
        f"ELT Anomaly Report — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "=" * 60,
        f"Total failures detected: {len(failures)}",
        ""
    ]

    for i, f in enumerate(failures, 1):
        test_name = f["test"]
        rule_key = next((k for k in rules if k in test_name), None)
        explanation, recommendation = rules.get(
            rule_key,
            ("Unexpected test failure.", "Review the dbt test definition and source data.")
        )
        lines += [
            f"FAILURE {i}: {test_name}",
            f"  Status:         {f['status']}",
            f"  Explanation:    {explanation}",
            f"  Recommendation: {recommendation}",
            ""
        ]

    lines += [
        "=" * 60,
        "Next step: investigate the above failures before reloading.",
        ""
    ]
    return "\n".join(lines)


# ── Claude API (uncomment when API key is ready) ──────────────────
# def claude_analysis(dbt_output: str) -> str:
#     import anthropic
#     client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
#     message = client.messages.create(
#         model="claude-sonnet-4-6",
#         max_tokens=1024,
#         messages=[{
#             "role": "user",
#             "content": f"""You are a senior data engineer reviewing dbt test results.
# Here is the dbt test output:
# ---
# {dbt_output}
# ---
# For each failure:
# 1. Explain in plain English what went wrong
# 2. What it likely means for data quality
# 3. Recommended fix (SQL or dbt config)
# Be concise and actionable."""
#         }]
#     )
#     return message.content[0].text
# ─────────────────────────────────────────────────────────────────


def main():
    dbt_output = read_dbt_output()
    if not dbt_output:
        report = (
            f"ELT Anomaly Report — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"{'=' * 60}\n"
            f"Status: ALL TESTS PASSED — pipeline healthy.\n"
        )
    else:
        failures = parse_failures(dbt_output)
        report = rule_based_analysis(failures)
        # ── swap this line when API key is ready ──
        # report = claude_analysis(dbt_output)

    os.makedirs(os.path.dirname(REPORT_FILE), exist_ok=True)
    with open(REPORT_FILE, "w") as f:
        f.write(report)

    print(report)
    print(f"\nReport saved to {REPORT_FILE}")


if __name__ == "__main__":
    main()