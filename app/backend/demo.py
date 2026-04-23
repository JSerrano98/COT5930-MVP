
import pandas as pd
from pathlib import Path



#accepts Pandas array,
#need to add websocket to listen to user response
#!TODO create a context sensitive function, accepts name of datafile, type of model to be used, and prediction labels
# add functionality for user to upload custom code inhereting class wrapper.
def train_regression_model(arr):



    return

if __name__ == "__main__":
    script_dir = Path(__file__).parent
    path = script_dir / 'CSV'

    df = pd.read_excel(str(path) + '/data3.xlsx') #replace with user input from frontend
    print(df)
    arr = [row for row in df if row['StreamName'] == 'FakeECG' ]
   ## print(df)



