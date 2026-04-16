import sqlite3
import pandas as pd

df = pd.read_csv('data.csv')

df.columns = df.columns.str.strip()

#connect to database
connection = sqlite3.connect('Echo.db')

#load data file to sqlite
df.to_sql('dummy_data', connection, if_exists='replace' )


