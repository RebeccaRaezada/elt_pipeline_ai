{{ config(materialized='table') }}

SELECT
    year,
    grade,
    SUM(enrollment)                        AS total_enrollment,
    COUNT(DISTINCT ncessch)                AS school_count,
    COUNT(DISTINCT leaid)                  AS district_count,
    ROUND(AVG(enrollment)::numeric, 2)     AS avg_enrollment_per_school,
    MAX(enrollment)                        AS max_enrollment,
    MIN(enrollment)                        AS min_enrollment,
    extracted_at
FROM {{ ref('stg_enrollment') }}
GROUP BY year, grade, extracted_at