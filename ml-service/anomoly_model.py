import numpy as np
import joblib

from sklearn.ensemble import IsolationForest


# ==========================================
# SAMPLE NORMAL TRANSACTION DATA
# ==========================================

normal_transactions = np.array([

    [500, 365, 0, 14, 50, 0, 0],

    [800, 250, 0, 12, 35, 0, 0],

    [1200, 180, 1, 15, 40, 0, 0],

    [700, 300, 0, 10, 60, 0, 0],

    [1500, 500, 0, 18, 80, 0, 0],

    [950, 200, 1, 13, 30, 0, 0],

    [600, 400, 0, 11, 70, 0, 0],

    [2000, 150, 1, 16, 45, 0, 0],

    [900, 320, 0, 14, 55, 0, 0],

    [1100, 275, 0, 17, 65, 0, 0]

])


# ==========================================
# TRAIN ISOLATION FOREST
# ==========================================

anomaly_model = IsolationForest(

    contamination=0.1,

    random_state=42

)


anomaly_model.fit(
    normal_transactions
)


# ==========================================
# SAVE MODEL
# ==========================================

joblib.dump(

    anomaly_model,

    "anomaly_model.pkl"

)


print(
    "Anomaly detection model trained successfully!"
)

print(
    "Saved as anomaly_model.pkl"
)