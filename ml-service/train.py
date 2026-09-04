import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report
import joblib


# -----------------------------
# Generate synthetic dataset
# -----------------------------

np.random.seed(42)

n = 10000

data = {
    "amount": np.random.randint(100, 100000, n),
    "account_age_days": np.random.randint(1, 1000, n),
    "failed_attempts": np.random.randint(0, 6, n),
    "transaction_hour": np.random.randint(0, 24, n),
    "previous_transactions": np.random.randint(1, 100, n),
    "device_changed": np.random.randint(0, 2, n),
    "location_changed": np.random.randint(0, 2, n)
}

df = pd.DataFrame(data)


# -----------------------------
# Create fraud rules
# -----------------------------

df["fraud"] = (
    (df["amount"] > 70000) |
    (df["failed_attempts"] >= 4) |
    (
        (df["device_changed"] == 1) &
        (df["location_changed"] == 1)
    ) |
    (
        (df["account_age_days"] < 10) &
        (df["amount"] > 30000)
    ) |
    (
        (df["transaction_hour"] < 5) &
        (df["amount"] > 40000)
    )
).astype(int)


# -----------------------------
# Features
# -----------------------------

features = [
    "amount",
    "account_age_days",
    "failed_attempts",
    "transaction_hour",
    "previous_transactions",
    "device_changed",
    "location_changed"
]

X = df[features]
y = df["fraud"]


# -----------------------------
# Train/Test split
# -----------------------------

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)


# -----------------------------
# Model
# -----------------------------

model = Pipeline([
    ("scaler", StandardScaler()),
    ("classifier", RandomForestClassifier(
        n_estimators=200,
        random_state=42,
        class_weight="balanced"
    ))
])


model.fit(X_train, y_train)


# -----------------------------
# Evaluation
# -----------------------------

predictions = model.predict(X_test)

print(classification_report(y_test, predictions))


# -----------------------------
# Save model
# -----------------------------

joblib.dump(model, "model.pkl")

print("Model saved successfully!")