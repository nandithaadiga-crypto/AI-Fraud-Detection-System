from flask import Flask, request, jsonify
from flask_cors import CORS

import os
import re
import json
import time
import base64
import hmac
import hashlib
import sqlite3
from datetime import datetime
import pandas as pd
import joblib
from werkzeug.security import generate_password_hash, check_password_hash


app = Flask(__name__)
CORS(app)


# ==========================================
# PATHS & LOAD ML MODELS
# ==========================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")
ANOMALY_MODEL_PATH = os.path.join(BASE_DIR, "anomaly_model.pkl")
DATABASE = os.path.join(BASE_DIR, "fraud_detection.db")

model = joblib.load(MODEL_PATH)
anomaly_model = joblib.load(ANOMALY_MODEL_PATH)


# ==========================================
# AUTHENTICATION & JWT CONFIGURATION
# ==========================================

JWT_SECRET = os.environ.get("JWT_SECRET", "fraudguard_enterprise_secure_secret_key_2026")


def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')


def base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode('utf-8'))


def generate_jwt(payload: dict, expires_in_seconds: int = 86400) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload_copy = payload.copy()
    payload_copy["exp"] = int(time.time()) + expires_in_seconds
    payload_copy["iat"] = int(time.time())

    header_b64 = base64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_b64 = base64url_encode(json.dumps(payload_copy, separators=(',', ':')).encode('utf-8'))
    message = f"{header_b64}.{payload_b64}"
    sig = hmac.new(JWT_SECRET.encode('utf-8'), message.encode('utf-8'), hashlib.sha256).digest()
    return f"{message}.{base64url_encode(sig)}"


def verify_jwt(token: str) -> dict:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid token format")

    header_b64, payload_b64, sig_b64 = parts
    message = f"{header_b64}.{payload_b64}"
    expected_sig = hmac.new(JWT_SECRET.encode('utf-8'), message.encode('utf-8'), hashlib.sha256).digest()

    if not hmac.compare_digest(base64url_encode(expected_sig), sig_b64):
        raise ValueError("Invalid signature")

    payload = json.loads(base64url_decode(payload_b64).decode('utf-8'))
    if "exp" in payload and time.time() > payload["exp"]:
        raise ValueError("Token expired")

    return payload


def get_current_user():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ", 1)[1].strip()
    try:
        decoded = verify_jwt(token)
        user_id = decoded.get("user_id")
        if not user_id:
            return None

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, email, role, created_at, last_login FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        conn.close()

        return dict(user) if user else None
    except Exception:
        return None


# ==========================================
# DATABASE CONNECTION & SCHEMA
# ==========================================

def get_db_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def create_database():
    connection = get_db_connection()
    cursor = connection.cursor()

    # 1. Transactions Table
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
            timestamp TEXT,
            category TEXT DEFAULT 'Retail / E-Commerce',
            channel TEXT DEFAULT 'Web Browser',
            status TEXT DEFAULT 'AUTO_PROCESSED',
            analyst_notes TEXT DEFAULT ''
        )
    """)

    # Ensure all columns exist for existing databases
    existing_cols = [c[1] for c in cursor.execute("PRAGMA table_info(transactions)").fetchall()]
    new_cols = [
        ("category", "TEXT", "'Retail / E-Commerce'"),
        ("channel", "TEXT", "'Web Browser'"),
        ("status", "TEXT", "'AUTO_PROCESSED'"),
        ("analyst_notes", "TEXT", "''")
    ]
    for col_name, col_type, default_val in new_cols:
        if col_name not in existing_cols:
            cursor.execute(f"ALTER TABLE transactions ADD COLUMN {col_name} {col_type} DEFAULT {default_val}")

    # 2. Users Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'Fraud Analyst',
            created_at TEXT NOT NULL,
            last_login TEXT
        )
    """)

    # 3. Audit Logs Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            event_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            component TEXT NOT NULL,
            details TEXT NOT NULL,
            user_email TEXT
        )
    """)

    # Auto-seed default demo users if none exist
    cursor.execute("SELECT COUNT(*) AS count FROM users")
    if cursor.fetchone()["count"] == 0:
        default_pwd_hash = generate_password_hash("admin123")
        now_str = datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO users (name, email, password_hash, role, created_at, last_login)
            VALUES (?, ?, ?, ?, ?, ?)
        """, ("Lead Risk Analyst", "analyst@fraudguard.ai", default_pwd_hash, "Lead Risk Analyst", now_str, now_str))
        cursor.execute("""
            INSERT INTO users (name, email, password_hash, role, created_at, last_login)
            VALUES (?, ?, ?, ?, ?, ?)
        """, ("Security Admin", "admin@fraudguard.ai", default_pwd_hash, "System Administrator", now_str, now_str))

    connection.commit()
    connection.close()


create_database()


def record_audit_log(event_type: str, severity: str, component: str, details: str, user_email: str = None):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("""
            INSERT INTO audit_logs (timestamp, event_type, severity, component, details, user_email)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (datetime.now().isoformat(), event_type, severity, component, details, user_email or "system@fraudguard.ai"))
        conn.commit()
        conn.close()
    except Exception as e:
        print("Audit log write error:", e)


# ==========================================
# HOME & HEALTH CHECK
# ==========================================

@app.route("/")
def home():
    return jsonify({
        "message": "AI Fraud Detection API is running",
        "database": "Connected",
        "model": "Loaded",
        "version": "2.4.0",
        "auth": "JWT HS256 Enabled",
        "pipeline": "RandomForest + IsolationForest + Explainable AI"
    })


# ==========================================
# USER AUTHENTICATION ENDPOINTS
# ==========================================

@app.route("/api/auth/register", methods=["POST"])
def register():
    try:
        data = request.get_json() or {}
        name = str(data.get("name", "")).strip()
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", "")).strip()
        role = str(data.get("role", "Fraud Analyst")).strip()

        if not name or len(name) < 2:
            return jsonify({"error": "Full name must be at least 2 characters"}), 400

        email_regex = r"^[^@]+@[^@]+\.[^@]+$"
        if not email or not re.match(email_regex, email):
            return jsonify({"error": "Please provide a valid email address"}), 400

        if not password or len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            conn.close()
            return jsonify({"error": "An account with this email already exists"}), 409

        password_hash = generate_password_hash(password)
        now_str = datetime.now().isoformat()

        cursor.execute("""
            INSERT INTO users (name, email, password_hash, role, created_at, last_login)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (name, email, password_hash, role, now_str, now_str))
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()

        record_audit_log("USER_REGISTER", "INFO", "Auth Module", f"New account created for {name} ({email})", email)

        token = generate_jwt({
            "user_id": user_id,
            "email": email,
            "role": role,
            "name": name
        })

        return jsonify({
            "message": "User registered successfully",
            "token": token,
            "user": {
                "id": user_id,
                "name": name,
                "email": email,
                "role": role,
                "created_at": now_str
            }
        }), 201

    except Exception as e:
        return jsonify({"error": f"Registration failed: {str(e)}"}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    try:
        data = request.get_json() or {}
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", "")).strip()

        if not email or not password:
            return jsonify({"error": "Please enter both email and password"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()

        if not user or not check_password_hash(user["password_hash"], password):
            conn.close()
            record_audit_log("LOGIN_FAILED", "WARN", "Auth Module", f"Failed login attempt for email {email}", email)
            return jsonify({"error": "Invalid email or password"}), 401

        now_str = datetime.now().isoformat()
        cursor.execute("UPDATE users SET last_login = ? WHERE id = ?", (now_str, user["id"]))
        conn.commit()
        conn.close()

        record_audit_log("LOGIN_SUCCESS", "INFO", "Auth Module", f"Analyst {user['name']} authenticated successfully", email)

        token = generate_jwt({
            "user_id": user["id"],
            "email": user["email"],
            "role": user["role"],
            "name": user["name"]
        })

        return jsonify({
            "message": "Login successful",
            "token": token,
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
                "last_login": now_str
            }
        }), 200

    except Exception as e:
        return jsonify({"error": f"Login failed: {str(e)}"}), 500


@app.route("/api/auth/me", methods=["GET"])
def get_me():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized. Please login again"}), 401
    return jsonify({"user": user}), 200


@app.route("/api/auth/profile", methods=["PUT"])
def update_profile():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        data = request.get_json() or {}
        name = str(data.get("name", user["name"])).strip()
        role = str(data.get("role", user["role"])).strip()
        new_password = data.get("password")

        conn = get_db_connection()
        cursor = conn.cursor()

        if new_password and len(str(new_password).strip()) >= 6:
            new_hash = generate_password_hash(str(new_password).strip())
            cursor.execute("UPDATE users SET name = ?, role = ?, password_hash = ? WHERE id = ?", (name, role, new_hash, user["id"]))
        else:
            cursor.execute("UPDATE users SET name = ?, role = ? WHERE id = ?", (name, role, user["id"]))

        conn.commit()
        conn.close()

        record_audit_log("PROFILE_UPDATED", "INFO", "User Management", f"Profile updated for {name} ({role})", user["email"])

        updated_user = {**user, "name": name, "role": role}
        new_token = generate_jwt({
            "user_id": user["id"],
            "email": user["email"],
            "role": role,
            "name": name
        })

        return jsonify({
            "message": "Profile updated successfully",
            "token": new_token,
            "user": updated_user
        }), 200

    except Exception as e:
        return jsonify({"error": f"Failed to update profile: {str(e)}"}), 500


# ==========================================
# PHASE 3: ADVANCED FRAUD DETECTION ENGINE
# ==========================================

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No input payload provided"}), 400

        amount = float(data["amount"])
        account_age_days = int(data["account_age_days"])
        failed_attempts = int(data["failed_attempts"])
        transaction_hour = int(data["transaction_hour"])
        previous_transactions = int(data["previous_transactions"])
        device_changed = int(data["device_changed"])
        location_changed = int(data["location_changed"])

        # Optional metadata
        category = str(data.get("category", "Retail / E-Commerce")).strip()
        channel = str(data.get("channel", "Web Browser")).strip()
        analyst_notes = str(data.get("analyst_notes", "")).strip()

        transaction = pd.DataFrame([{
            "amount": amount,
            "account_age_days": account_age_days,
            "failed_attempts": failed_attempts,
            "transaction_hour": transaction_hour,
            "previous_transactions": previous_transactions,
            "device_changed": device_changed,
            "location_changed": location_changed
        }])

        # 1. Supervised Random Forest Prediction
        probability = model.predict_proba(transaction)[0][1]
        supervised_probability = round(probability * 100, 2)
        fraud_probability = supervised_probability

        # 2. Unsupervised Anomaly Detection (Isolation Forest)
        anomaly_prediction = anomaly_model.predict(transaction)[0]
        anomaly_detected = True if anomaly_prediction == -1 else False

        # 3. Hybrid Risk Synthesis
        if anomaly_detected:
            fraud_probability = min(100.0, round(fraud_probability + 15.0, 2))

        # 4. Multi-Level Risk Tiers
        if fraud_probability >= 70:
            risk = "HIGH"
            classification = "FRAUDULENT"
            action = "BLOCK"
        elif fraud_probability >= 40:
            risk = "MEDIUM"
            classification = "SUSPICIOUS"
            action = "REVIEW"
        else:
            risk = "LOW"
            classification = "LEGITIMATE"
            action = "APPROVE"

        # 5. Explainable AI (XAI) & Attribution Factors
        reasons = []
        feature_contributions = []

        if amount > 70000:
            reasons.append("Transaction amount is unusually high")
            feature_contributions.append({"feature": "Transaction Amount", "impact": "+38%", "direction": "risk"})
        elif amount > 35000:
            feature_contributions.append({"feature": "Transaction Amount", "impact": "+18%", "direction": "risk"})
        else:
            feature_contributions.append({"feature": "Transaction Amount", "impact": "-12%", "direction": "safe"})

        if failed_attempts >= 4:
            reasons.append("Multiple failed attempts detected")
            feature_contributions.append({"feature": "Failed PIN/Logins", "impact": "+28%", "direction": "risk"})
        elif failed_attempts > 0:
            feature_contributions.append({"feature": "Failed PIN/Logins", "impact": "+10%", "direction": "risk"})

        if device_changed == 1:
            reasons.append("Transaction is coming from a new device")
            feature_contributions.append({"feature": "Device Signature", "impact": "+20%", "direction": "risk"})
        else:
            feature_contributions.append({"feature": "Device Signature", "impact": "-10%", "direction": "safe"})

        if location_changed == 1:
            reasons.append("Unusual location detected")
            feature_contributions.append({"feature": "Geo-Location", "impact": "+17%", "direction": "risk"})
        else:
            feature_contributions.append({"feature": "Geo-Location", "impact": "-8%", "direction": "safe"})

        if account_age_days < 10:
            reasons.append("Account is very new")
            feature_contributions.append({"feature": "Account Maturity", "impact": "+14%", "direction": "risk"})

        if transaction_hour < 5:
            reasons.append("Transaction occurred during unusual hours (00:00 - 05:00)")
            feature_contributions.append({"feature": "Time of Day", "impact": "+12%", "direction": "risk"})

        if anomaly_detected:
            reasons.append("Transaction behavior is significantly different from normal patterns (Isolation Forest)")
            feature_contributions.append({"feature": "Anomaly Outlier Score", "impact": "+15%", "direction": "risk"})

        if not reasons:
            reasons.append("No suspicious activity detected. Transaction matches verified normal profile.")

        # 6. Save Record in Database
        now_str = datetime.now().isoformat()
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
                timestamp,
                category,
                channel,
                status,
                analyst_notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            now_str,
            category,
            channel,
            "AUTO_PROCESSED",
            analyst_notes
        ))

        connection.commit()
        transaction_id = cursor.lastrowid
        connection.close()

        # Audit Event
        current_u = get_current_user()
        user_email = current_u["email"] if current_u else "anonymous"
        record_audit_log(
            "PREDICTION_EXECUTED",
            "WARN" if risk == "HIGH" else "INFO",
            "Inference Engine",
            f"Tx #{transaction_id} evaluated: ₹{amount:,.2f} -> {risk} RISK ({fraud_probability}%) Action: {action}",
            user_email
        )

        return jsonify({
            "id": transaction_id,
            "amount": amount,
            "category": category,
            "channel": channel,
            "fraud_probability": fraud_probability,
            "supervised_probability": supervised_probability,
            "risk": risk,
            "classification": classification,
            "action": action,
            "anomaly_detected": anomaly_detected,
            "reasons": reasons,
            "feature_contributions": feature_contributions,
            "status": "AUTO_PROCESSED",
            "timestamp": now_str
        })

    except Exception as error:
        print("Prediction error:", error)
        return jsonify({"error": str(error)}), 500


# ==========================================
# TRANSACTION MONITORING & INVESTIGATION
# ==========================================

@app.route("/transactions", methods=["GET"])
def get_transactions():
    try:
        limit = min(int(request.args.get("limit", 100)), 300)
        risk_filter = request.args.get("risk", "ALL").upper()
        action_filter = request.args.get("action", "ALL").upper()
        status_filter = request.args.get("status", "ALL").upper()
        search = request.args.get("search", "").strip().lower()

        query = "SELECT * FROM transactions WHERE 1=1"
        params = []

        if risk_filter != "ALL":
            query += " AND risk = ?"
            params.append(risk_filter)

        if action_filter != "ALL":
            query += " AND action = ?"
            params.append(action_filter)

        if status_filter != "ALL":
            query += " AND status = ?"
            params.append(status_filter)

        if search:
            query += " AND (CAST(id AS TEXT) LIKE ? OR reasons LIKE ? OR category LIKE ? OR channel LIKE ?)"
            s_param = f"%{search}%"
            params.extend([s_param, s_param, s_param, s_param])

        query += " ORDER BY id DESC LIMIT ?"
        params.append(limit)

        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        connection.close()

        transactions = []
        for row in rows:
            transactions.append({
                "id": row["id"],
                "amount": row["amount"],
                "account_age_days": row["account_age_days"],
                "failed_attempts": row["failed_attempts"],
                "transaction_hour": row["transaction_hour"],
                "previous_transactions": row["previous_transactions"],
                "device_changed": row["device_changed"],
                "location_changed": row["location_changed"],
                "fraud_probability": row["fraud_probability"],
                "risk": row["risk"],
                "action": row["action"],
                "reasons": row["reasons"],
                "timestamp": row["timestamp"],
                "category": row["category"] if "category" in row.keys() else "Retail",
                "channel": row["channel"] if "channel" in row.keys() else "Web",
                "status": row["status"] if "status" in row.keys() else "AUTO_PROCESSED",
                "analyst_notes": row["analyst_notes"] if "analyst_notes" in row.keys() else ""
            })

        return jsonify(transactions)

    except Exception as error:
        return jsonify({"error": str(error)}), 500


@app.route("/api/transactions/<int:tx_id>", methods=["GET"])
def get_single_transaction(tx_id):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM transactions WHERE id = ?", (tx_id,))
        row = cursor.fetchone()
        connection.close()

        if not row:
            return jsonify({"error": f"Transaction #{tx_id} not found"}), 404

        return jsonify(dict(row))
    except Exception as error:
        return jsonify({"error": str(error)}), 500


@app.route("/api/transactions/<int:tx_id>/status", methods=["PUT"])
def update_transaction_status(tx_id):
    try:
        data = request.get_json() or {}
        new_status = str(data.get("status", "UNDER_REVIEW")).strip().upper()
        notes = str(data.get("analyst_notes", "")).strip()

        valid_statuses = ["AUTO_PROCESSED", "UNDER_REVIEW", "CONFIRMED_FRAUD", "FALSE_POSITIVE", "CLEARED_MANUALLY"]
        if new_status not in valid_statuses:
            return jsonify({"error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM transactions WHERE id = ?", (tx_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"error": f"Transaction #{tx_id} not found"}), 404

        cursor.execute("""
            UPDATE transactions
            SET status = ?, analyst_notes = ?
            WHERE id = ?
        """, (new_status, notes, tx_id))
        conn.commit()

        cursor.execute("SELECT * FROM transactions WHERE id = ?", (tx_id,))
        updated_row = cursor.fetchone()
        conn.close()

        user = get_current_user()
        user_email = user["email"] if user else "analyst"
        record_audit_log(
            "TRANSACTION_STATUS_UPDATED",
            "WARN" if new_status == "CONFIRMED_FRAUD" else "INFO",
            "Investigation Desk",
            f"Tx #{tx_id} status updated to {new_status}. Notes: {notes or 'N/A'}",
            user_email
        )

        return jsonify({
            "message": "Transaction status updated successfully",
            "transaction": dict(updated_row)
        }), 200

    except Exception as error:
        return jsonify({"error": str(error)}), 500


# ==========================================
# SUSPICIOUS TRANSACTION ALERTS FEED
# ==========================================

@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            SELECT id, amount, risk, fraud_probability, action, reasons, timestamp, status, category
            FROM transactions
            WHERE risk = 'HIGH' OR fraud_probability >= 50
            ORDER BY id DESC
            LIMIT 20
        """)

        alerts = [dict(r) for r in cursor.fetchall()]
        connection.close()

        return jsonify({
            "count": len(alerts),
            "alerts": alerts
        })

    except Exception as error:
        return jsonify({"error": str(error)}), 500


# ==========================================
# SYSTEM AUDIT TRAIL FEED
# ==========================================

@app.route("/api/audit-logs", methods=["GET"])
def get_audit_logs():
    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            SELECT * FROM audit_logs
            ORDER BY id DESC
            LIMIT 50
        """)

        logs = [dict(r) for r in cursor.fetchall()]
        connection.close()

        return jsonify(logs)

    except Exception as error:
        return jsonify({"error": str(error)}), 500


# ==========================================
# DASHBOARD STATISTICS
# ==========================================

@app.route("/statistics", methods=["GET"])
def statistics():
    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN risk = 'HIGH' THEN 1 ELSE 0 END) AS high_risk,
                SUM(CASE WHEN risk = 'MEDIUM' THEN 1 ELSE 0 END) AS medium_risk,
                SUM(CASE WHEN risk = 'LOW' THEN 1 ELSE 0 END) AS low_risk,
                SUM(CASE WHEN action = 'BLOCK' THEN 1 ELSE 0 END) AS blocked,
                SUM(CASE WHEN action = 'APPROVE' THEN 1 ELSE 0 END) AS approved,
                COALESCE(SUM(amount), 0) AS total_amount,
                COALESCE(SUM(CASE WHEN risk = 'HIGH' THEN amount ELSE 0 END), 0) AS fraud_amount
            FROM transactions
        """)

        row = cursor.fetchone()
        connection.close()

        return jsonify({
            "total_transactions": row["total"] or 0,
            "high_risk": row["high_risk"] or 0,
            "medium_risk": row["medium_risk"] or 0,
            "low_risk": row["low_risk"] or 0,
            "blocked": row["blocked"] or 0,
            "approved": row["approved"] or 0,
            "total_amount": round(row["total_amount"] or 0, 2),
            "fraud_amount": round(row["fraud_amount"] or 0, 2)
        })

    except Exception as error:
        return jsonify({"error": str(error)}), 500


# ==========================================
# START SERVER
# ==========================================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )
