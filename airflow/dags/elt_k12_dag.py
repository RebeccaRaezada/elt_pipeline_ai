from airflow import DAG
from airflow.operators.bash import BashOperator
from datetime import datetime, timedelta

default_args = {
    'owner': 'rebecca',
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
    'email_on_failure': False,
}

DBT_PROJECT_DIR = '/opt/airflow/dbt_project/elt_k12'
DBT_PROFILES_DIR = '/opt/airflow/dbt_project/elt_k12'

with DAG(
    dag_id='elt_k12_pipeline',
    default_args=default_args,
    description='Daily K-12 ELT pipeline — seed, transform, test, analyze',
    schedule_interval='@daily',
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=['k12', 'education', 'elt'],
) as dag:
    
    dbt_deps = BashOperator(
        task_id='dbt_deps',
        bash_command=f'cd {DBT_PROJECT_DIR} && dbt deps --profiles-dir {DBT_PROFILES_DIR}',
    )

    dbt_seed = BashOperator(
        task_id='dbt_seed',
        bash_command=f'cd {DBT_PROJECT_DIR} && dbt seed --profiles-dir {DBT_PROFILES_DIR}',
    )

    dbt_run = BashOperator(
        task_id='dbt_run',
        bash_command=f'cd {DBT_PROJECT_DIR} && dbt run --profiles-dir {DBT_PROFILES_DIR}',
    )

    dbt_test = BashOperator(
        task_id='dbt_test',
        bash_command=f'cd {DBT_PROJECT_DIR} && dbt test --profiles-dir {DBT_PROFILES_DIR} 2>&1 | tee /tmp/dbt_test_output.txt',
    )

    llm_check = BashOperator(
        task_id='llm_anomaly_check',
        bash_command='python /opt/airflow/llm/explainer.py',
    )

    dbt_deps >> dbt_seed >> dbt_run >> dbt_test >> llm_check