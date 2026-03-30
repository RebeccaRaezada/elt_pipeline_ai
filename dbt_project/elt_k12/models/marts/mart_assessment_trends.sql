{{ config(materialized='table') }}

WITH base AS (
    SELECT
        year,
        subject,
        grade,
        jurisdiction,
        avg_score,
        extracted_at
    FROM {{ ref('stg_assessments') }}
),

with_change AS (
    SELECT
        curr.subject,
        curr.grade,
        curr.jurisdiction,
        curr.year                                           AS current_year,
        curr.avg_score                                      AS current_score,
        prev.year                                           AS prior_year,
        prev.avg_score                                      AS prior_score,
        ROUND((curr.avg_score - prev.avg_score)::numeric, 2) AS score_change,
        CASE
            WHEN curr.avg_score > prev.avg_score THEN 'improved'
            WHEN curr.avg_score < prev.avg_score THEN 'declined'
            ELSE 'unchanged'
        END                                                 AS trend,
        curr.extracted_at
    FROM base curr
    LEFT JOIN base prev
        ON curr.subject    = prev.subject
        AND curr.grade     = prev.grade
        AND curr.jurisdiction = prev.jurisdiction
        AND curr.year      = 2022
        AND prev.year      = 2019
)

SELECT * FROM with_change
WHERE current_year = 2022