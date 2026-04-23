#need to implement one-hot encoding for regression models
#or need to bar categorical variables from being entered all together
#pd.get_dummies(df, columns = [])
#In [66]: cols = df.columns

#In [67]: num_cols = df._get_numeric_data().columns

#In [68]: num_cols
#Out[68]: Index([u'0', u'1', u'2'], dtype='object')

#In [69]: list(set(cols) - set(num_cols))
#Out[69]: ['3', '4']

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

try:
    df = pd.read_excel("C:/Users/Johns/COT5930/COT5930-MVP/app/backend/CSV/Salary_dataset.csv")
except:
    df = pd.read_csv('C:/Users/Johns/COT5930/COT5930-MVP/app/backend/CSV/Salary_dataset.csv')

print(df)
X = df[['YearsExperience']]
y = df[['Salary']]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
#df.fillna(method = 'ffill', inplace = True)

lr = LinearRegression()
lr.fit(X_train, y_train)

print(lr.score(X_train, y_train))
print(lr.score(X_test,y_test))

y_pred = lr.predict(X_test)
print(mean_absolute_error(y_test,y_pred))
print(mean_squared_error(y_test, y_pred))
print(r2_score(y_test, y_pred))





