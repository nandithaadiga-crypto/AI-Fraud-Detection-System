from flask import Flask, request, jsonify
from flask_cors import CORS

import pandas as pd
import joblib
import sqlite3
from datetime import datetime


app = Flask(__name__)
CORS(app)


# ==========================================
# LOAD ML MODELS
# ==========================================

model = joblib.load("model.pkl")
anomaly_model = joblib.load("anomaly_model.pkl")


# ==========================================
# DATABASE
# ==========================================

DATABASE = "fraud_detection.db"


def get_db_connection():

    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row

    return connection


def create_database():

    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            amount REAL NOT NULL,

            account_age_days INTEGER,

            failed_attempts INTEGER,

            transaction_hour INTEGER,

            previous_transactions INTEGER,

            device_changed INTEGER,

            location_changed INTEGER,

            fraud_probability REAL,

            risk TEXT,

            action TEXT,

            reasons TEXT,

            timestamp TEXT

        )
    """)

    connection.commit()
    connection.close()


create_database()


# ==========================================
# HOME
# ==========================================

@app.route("/")
def home():

    return jsonify({

        "message": "AI Fraud Detection API is running",

        "database": "Connected",

        "model": "Loaded"

    })


# ==========================================
# PREDICT FRAUD
# ==========================================

@app.route("/predict", methods=["POST"])
def predict():

    try:

        data = request.json


        # ==========================================
        # GET TRANSACTION DATA
        # ==========================================

        amount = float(data["amount"])

        account_age_days = int(
            data["account_age_days"]
        )

        failed_attempts = int(
            data["failed_attempts"]
        )

        transaction_hour = int(
            data["transaction_hour"]
        )

        previous_transactions = int(
            data["previous_transactions"]
        )

        device_changed = int(
            data["device_changed"]
        )

        location_changed = int(
            data["location_changed"]
        )


        # ==========================================
        # CREATE DATAFRAME
        # ==========================================

        transaction = pd.DataFrame([{

            "amount": amount,

            "account_age_days":
                account_age_days,

            "failed_attempts":
                failed_attempts,

            "transaction_hour":
                transaction_hour,

            "previous_transactions":
                previous_transactions,

            "device_changed":
                device_changed,

            "location_changed":
                location_changed

        }])


        # ==========================================
        # RANDOM FOREST PREDICTION
        # ==========================================

        probability = model.predict_proba(
            transaction
        )[0][1]


        fraud_probability = round(
            probability * 100,
            2
        )


        # ==========================================
        # ANOMALY DETECTION
        # ==========================================

        anomaly_prediction = anomaly_model.predict(
            transaction
        )[0]


        if anomaly_prediction == -1:

            anomaly_detected = True

        else:

            anomaly_detected = False


        # ==========================================
        # HYBRID RISK ANALYSIS
        # ==========================================

        if anomaly_detected:

            fraud_probability = min(
                100,
                fraud_probability + 15
            )


        if fraud_probability >= 70:

            risk = "HIGH"

        elif fraud_probability >= 40:

            risk = "MEDIUM"

        else:

            risk = "LOW"


        # ==========================================
        # FRAUD REASONS
        # ==========================================

        reasons = []


        if amount > 70000:

            reasons.append(
                "Transaction amount is unusually high"
            )


        if failed_attempts >= 4:

            reasons.append(
                "Multiple failed attempts detected"
            )


        if device_changed == 1:

            reasons.append(
                "Transaction is coming from a new device"
            )


        if location_changed == 1:

            reasons.append(
                "Unusual location detected"
            )


        if account_age_days < 10:

            reasons.append(
                "Account is very new"
            )


        if transaction_hour < 5:

            reasons.append(
                "Transaction occurred during unusual hours"
            )


        if anomaly_detected:

            reasons.append(
                "Transaction behavior is significantly different from normal patterns"
            )


        if not reasons:

            reasons.append(
                "No suspicious activity detected"
            )


        # ==========================================
        # RECOMMENDED ACTION
        # ==========================================

        if risk == "HIGH":

            action = "BLOCK"

        elif risk == "MEDIUM":

            action = "REVIEW"

        else:

            action = "APPROVE"


        # ==========================================
        # SAVE TO DATABASE
        # ==========================================

        connection = get_db_connection()
        cursor = connection.cursor()


        cursor.execute("""
            INSERT INTO transactions (

                amount,

                account_age_days,

                failed_attempts,

                transaction_hour,

                previous_transactions,

                device_changed,

                location_changed,

                fraud_probability,

                risk,

                action,

                reasons,

                timestamp

            )

            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (

            amount,

            account_age_days,

            failed_attempts,

            transaction_hour,

            previous_transactions,

            device_changed,

            location_changed,

            fraud_probability,

            risk,

            action,

            " | ".join(reasons),

            datetime.now().isoformat()

        ))


        connection.commit()

        transaction_id = cursor.lastrowid

        connection.close()


        # ==========================================
        # RETURN RESULT
        # ==========================================

        return jsonify({

            "id":
                transaction_id,

            "fraud_probability":
                fraud_probability,

            "risk":
                risk,

            "action":
                action,

            "anomaly_detected":
                anomaly_detected,

            "reasons":
                reasons

        })


    except Exception as error:

        print(
            "Prediction error:",
            error
        )


        return jsonify({

            "error":
                str(error)

        }), 500


# ==========================================
# GET TRANSACTION HISTORY
# ==========================================

@app.route("/transactions", methods=["GET"])
def get_transactions():

    connection = get_db_connection()
    cursor = connection.cursor()


    cursor.execute("""
        SELECT *
        FROM transactions
        ORDER BY id DESC
        LIMIT 50
    """)


    rows = cursor.fetchall()

    connection.close()


    transactions = []


    for row in rows:

        transactions.append({

            "id":
                row["id"],

            "amount":
                row["amount"],

            "account_age_days":
                row["account_age_days"],

            "failed_attempts":
                row["failed_attempts"],

            "transaction_hour":
                row["transaction_hour"],

            "previous_transactions":
                row["previous_transactions"],

            "device_changed":
                row["device_changed"],

            "location_changed":
                row["location_changed"],

            "fraud_probability":
                row["fraud_probability"],

            "risk":
                row["risk"],

            "action":
                row["action"],

            "reasons":
                row["reasons"],

            "timestamp":
                row["timestamp"]

        })


    return jsonify(transactions)


# ==========================================
# DASHBOARD STATISTICS
# ==========================================

@app.route("/statistics", methods=["GET"])
def statistics():

    connection = get_db_connection()
    cursor = connection.cursor()


    cursor.execute("""
        SELECT COUNT(*) AS total
        FROM transactions
    """)

    total = cursor.fetchone()["total"]


    cursor.execute("""
        SELECT COUNT(*) AS count
        FROM transactions
        WHERE risk = 'HIGH'
    """)

    high_risk = cursor.fetchone()["count"]


    cursor.execute("""
        SELECT COUNT(*) AS count
        FROM transactions
        WHERE risk = 'MEDIUM'
    """)

    medium_risk = cursor.fetchone()["count"]


    cursor.execute("""
        SELECT COUNT(*) AS count
        FROM transactions
        WHERE risk = 'LOW'
    """)

    low_risk = cursor.fetchone()["count"]


    cursor.execute("""
        SELECT COUNT(*) AS count
        FROM transactions
        WHERE action = 'BLOCK'
    """)

    blocked = cursor.fetchone()["count"]


    cursor.execute("""
        SELECT COUNT(*) AS count
        FROM transactions
        WHERE action = 'APPROVE'
    """)

    approved = cursor.fetchone()["count"]


    connection.close()


    return jsonify({

        "total_transactions":
            total,

        "high_risk":
            high_risk,

        "medium_risk":
            medium_risk,

        "low_risk":
            low_risk,

        "blocked":
            blocked,

        "approved":
            approved

    })


# ==========================================
# START SERVER
# ==========================================

if __name__ == "__main__":

    app.run(

        host="0.0.0.0",

        port=5000,

        debug=True

    )

