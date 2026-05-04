# Using Machine Learning

ECHO includes a built-in machine learning workbench. You can train a model on recorded sensor data, then run it live on the dashboard to see real-time predictions from your sensors.

---

## Overview of the Workflow

The ML tab walks you through four steps in order:

```
1. Intake  →  2. Clean  →  3. Prepare  →  4. Train
```

After training, you can load the saved model into an ML monitor on the Dashboard for live inference.

Navigate to the **ML** tab in the top navigation bar to begin.

---

## Step 1 — Intake (Choose Your Dataset)

This step sets up the job before any processing begins.

**Dataset (CSV)**
- Click **Browse** to pick a `.csv` file of recorded sensor data, or type the path directly
- This is usually a recording file exported from a previous ECHO session

**Model Name** *(optional)*
- Give the model a friendly name so you can identify it later (e.g., "Stress Predictor")
- If left blank, a default name is used

**Task Type**
- **Regression** — Use this when the thing you want to predict is a number (e.g., heart rate value, stress score from 0–100)
- **Classification** — Use this when the thing you want to predict is a category or label (e.g., "stressed" vs. "calm", emotion type)

Click **Continue** when the dataset path and task type are filled in.

---

## Step 2 — Clean (Handle Missing or Problematic Data)

Raw sensor data often has gaps or bad values. This step lets you decide how to handle each column.

### Dataset Profile

When the step loads, ECHO scans your dataset and shows each column with:
- The number of missing values (nulls)
- Sample values so you can understand what the column contains

### Per-Column Actions

For each column, choose an action from the dropdown:

| Action | What it does |
|--------|-------------|
| **Keep as-is** | Leave the column exactly as recorded |
| **Fill nulls: Mean** | Replace missing values with the column's average |
| **Fill nulls: Median** | Replace missing values with the column's middle value |
| **Fill nulls: Mode** | Replace missing values with the most common value |
| **Fill nulls: 0** | Replace missing values with zero |
| **Drop rows with null** | Remove any row that has a missing value in this column |
| **Drop column** | Remove the entire column from the dataset |

> **Not sure?** For numeric sensor signals, "Fill nulls: Mean" is a safe default. Drop columns you do not plan to use.

### Bulk Apply

Select an action from the **Bulk Apply** dropdown and click **Apply to All** to set the same action for every column at once.

### Drop Duplicate Rows

Check **Drop duplicate rows** to remove any rows that are exact copies of another row.

### Applying

Click **Apply Cleaning** to run the cleaning step. A progress bar shows progress. When complete, the cleaned dataset path is shown and flows automatically to the next step.

Click **Continue** to proceed.

---

## Step 3 — Prepare (Scale and Select Features)

This step shapes the data before training. All settings have sensible defaults — you can skip straight to Continue if you are unsure.

### Scaling

Scaling adjusts the range of your feature values so that large and small numbers are treated more equally by the model.

| Option | When to use it |
|--------|----------------|
| **None** | Skip scaling (use for tree-based models like Random Forest) |
| **Standard** | Most common choice — zero mean, unit variance |
| **Min-Max** | Scales everything to 0–1 (good for neural networks) |
| **Robust** | Better than Standard when your data has outliers |
| **Max Abs** | Like Min-Max but preserves negative values |

### Feature Selection

Reduces the number of input columns the model sees. Fewer, better features often improve accuracy.

| Option | What it does |
|--------|-------------|
| **None** | Use all columns |
| **Manual** | Hand-pick which columns to include |
| **Variance** | Drop columns that barely change (near-constant signals) |
| **K Best** | Keep only the top K columns by statistical relevance to your label |
| **Correlation** | Drop one column from any pair that are highly correlated with each other |

### Polynomial Features

If you choose a polynomial degree greater than 1, ECHO creates combined features (e.g., channel1 × channel2). This can improve accuracy for models that cannot learn non-linear patterns on their own.

> Leave this at **1** unless you have a specific reason to change it.

### Log / Square Root Transforms

Apply log or square-root transformations to specific columns to reduce skew in very non-uniform signals.

Click **Continue** when ready.

---

## Step 4 — Train

This is where the model is built.

### Choose a Model

Select the algorithm you want to train. Available models:

**Linear Models**
- Ridge — linear regression with regularization
- Lasso — linear regression that can shrink feature weights to zero
- ElasticNet — combination of Ridge and Lasso

**Classical Models**
- SVM (Support Vector Machine)
- Random Forest
- Gradient Boosted Trees (GBT)
- KNN (K-Nearest Neighbors)
- LDA (Linear Discriminant Analysis) — classification only

**Neural Models**
- MLP (Multi-Layer Perceptron)
- CNN1D (1D Convolutional Network)
- LSTM (Long Short-Term Memory)
- EEGNet — designed specifically for EEG signals

> **Not sure which to pick?** Start with **Random Forest** for most tasks — it handles a wide variety of data well and requires little tuning.

### Select the Label Column

This is the column in your dataset that the model should learn to predict. Click **Load columns** to fetch the list from your cleaned dataset, then select the correct column.

### Train / Test Split

This sets how much of your data is used for training vs. testing the model's accuracy.

- **Training** — The model learns from this portion
- **Test** — This portion is held back to evaluate how well the model generalised

The default 80% train / 20% test split is a good starting point for most datasets.

### Training

Click **Train** to start. A progress indicator appears during training.

When training is complete, results are shown including accuracy (classification) or error metrics (regression). The trained model is saved as a `.pkl` file in the **Trained Models Directory** (set in Settings).

---

## Using a Trained Model on the Dashboard

After training, you can run the model live from the Dashboard.

1. Go to the **Dashboard** tab
2. Click **+ ML** in the left panel
3. In the ML monitor that appears:
   - Browse to the `.pkl` model file you just trained
   - Select the sensor stream to feed into the model
   - Set the buffer window and process interval
   - Map feature names if needed (see below)
4. Click **Start**

The monitor will show live predictions as sensor data comes in.

### Feature Aliases

If the column names used during training do not exactly match the channel labels in your live stream, you need to map them manually.

In the ML monitor, open the **Feature Alias Editor** and pair each model feature name with the matching live channel label. The Start button will stay disabled until all features are mapped.

---

## Tips

- Clean your data first — garbage in, garbage out
- If accuracy is low, try a different model or re-examine which columns you are using as features
- The label column should not be included in the feature set
- Save your workspace after setting up an ML monitor so you can reload it next time
