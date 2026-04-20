"""
Train/Test Split node — splits a DataFrame into train/val/test sets.
Stores splits on a shared context dict so downstream nodes can access them.
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split


def run(config: dict, upstream):
    if upstream is None:
        raise ValueError("Split requires upstream data.")

    df        = upstream.copy()
    test_size = float(config.get("testSize",  0.2))
    val_size  = float(config.get("valSize",   0.1))
    strategy  = config.get("strategy",  "stratified")
    shuffle   = config.get("shuffle",   True)
    seed      = int(config.get("seed",  42))

    # Detect label column
    label_col = config.get("label", None)
    if not label_col:
        for c in df.columns:
            if c.lower() in ("label", "class", "target", "y"):
                label_col = c
                break

    if not label_col or label_col not in df.columns:
        raise ValueError("Split: could not find a label column. Set 'label' in DataLoader config.")

    X = df.drop(columns=[label_col])
    y = df[label_col]

    stratify = y if strategy == "stratified" else None

    # First split off test set
    X_trainval, X_test, y_trainval, y_test = train_test_split(
        X, y,
        test_size=test_size,
        shuffle=shuffle if strategy != "time_series" else False,
        stratify=stratify,
        random_state=seed,
    )

    # Then split validation from trainval
    if val_size > 0:
        adjusted_val = val_size / (1 - test_size)
        stratify_val = y_trainval if strategy == "stratified" else None
        X_train, X_val, y_train, y_val = train_test_split(
            X_trainval, y_trainval,
            test_size=adjusted_val,
            shuffle=shuffle if strategy != "time_series" else False,
            stratify=stratify_val,
            random_state=seed,
        )
    else:
        X_train, y_train = X_trainval, y_trainval
        X_val,   y_val   = pd.DataFrame(), pd.Series(dtype=y.dtype)

    # Package splits into a dict — downstream nodes receive this as "upstream"
    splits = {
        "X_train": X_train, "y_train": y_train,
        "X_val":   X_val,   "y_val":   y_val,
        "X_test":  X_test,  "y_test":  y_test,
        "label_col": label_col,
        "feature_cols": list(X.columns),
    }

    result = {
        "train": len(X_train),
        "val":   len(X_val),
        "test":  len(X_test),
        "label_col": label_col,
    }
    return result, splits
