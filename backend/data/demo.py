import sqlite3 
import pandas as pd

connection = sqlite3.connect('demo.db')
#connection = sqlite3.connect(':memory:')

sql_create_table = """
Create TABLE students (
    Student PRIMARY KEY,
    Gender TEXT,
    Major TEXT,
    Year INTEGER
)
"""

cursor = connection.cursor()
cursor.execute(sql_create_table)
try:
    cursor.execute(sql_create_table)
    connection.commit()
except Exception as e:
    connection.rollback()

