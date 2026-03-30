{{ config(materialized='view') }}

SELECT
    id,
    year,
    ncessch,
    leaid,
    grade,
    race,
    sex,
    enrollment,
    fips,
    extracted_at
FROM {{ source('raw', 'raw_enrollment') }}
WHERE enrollment IS NOT NULL
  AND enrollment >= 0
  AND grade IN (4, 8)