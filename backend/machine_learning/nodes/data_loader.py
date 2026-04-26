"""
DataLoader node — loads data from CSV or a saved recording.
Returns a DataFrame as the output.
"""

import os
import pandas as pd


def run(config: dict, upstream=None):
    """
    config keys:
        source    : 'csv' | 'recording'
        path      : file path (relative to backend working dir or absolute)
        sep       : column separator for CSV (default ',')
        label     : name of the label/target column
    Returns:
        result : { rows, cols, columns, preview }
        output : pd.DataFrame
    """
    source = config.get("source", "csv")
    path   = config.get("path", "")
    sep    = config.get("sep",  ",") or ","
    label  = config.get("label", "")

    if not path:
        raise ValueError("DataLoader: 'path' is required.")

    # Resolve relative paths against the backend directory
    if not os.path.isabs(path):
        base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        path = os.path.join(base, path)
        print(path)

    if not os.path.exists(path):
        raise FileNotFoundError(f"DataLoader: file not found — {path}")

    df = pd.read_csv(path, sep=sep)

    result = {
        "rows":    len(df),
        "cols":    len(df.columns),
        "columns": list(df.columns),
        "label":   label if label in df.columns else None,
        "preview": df.head(5).to_dict(orient="records"),
    }
    print(result["columns"])
    print(result["cols"])
    print(result["label"])
    print(label)
    return result, [df, label]
