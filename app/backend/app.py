from flask import Flask, jsonify, request
import pandas as pd
import os
from urllib.parse import unquote
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# The folder you want to list
STORAGE_PATH = './CSV'

@app.route("/")
def hello():
    return "Hello, World!"

@app.route('/CSV', methods=['GET'])
def list_files():
    # Get all file names in the directory
    try:
        files = os.listdir(STORAGE_PATH)
        return jsonify(files)
    except FileNotFoundError:
        return jsonify({"error": "Directory not found"}), 404


@app.route('/ML', methods=['GET'])
def acquire_columns():

    query = request.args.get('file')
    query = unquote(query)

    try:
        df = pd.read_csv(STORAGE_PATH + '/'  + query )
        columns = df.columns.to_list()
        return jsonify(columns)
    except:
        print('help')
    try:
        df = pd.read_excel(STORAGE_PATH + '/' + query)
        columns = df.columns.to_list()
        return jsonify(columns)
    except:
        print('this failed too boohoo')
        return jsonify({"error": "Invalid file type"}), 400
if __name__ == '__main__':
    app.run("localhost", 6969)
    print(os.listdir(STORAGE_PATH))