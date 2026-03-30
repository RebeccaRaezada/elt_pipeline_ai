{{ config(materialized='view') }}

SELECT
    id,
    year,
    subject,
    grade,
    jurisdiction,
    ROUND(avg_score::numeric, 2) AS avg_score,
    std_error,
    extracted_at
FROM {{ source('raw', 'raw_assessments') }}
WHERE avg_score IS NOT NULL
  AND jurisdiction = 'CA'