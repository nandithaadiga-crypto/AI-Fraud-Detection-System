// ==========================================================================
// FRAUDGUARD AI — ENTERPRISE JAVASCRIPT CONTROLLER
// Complete frontend logic with Chart.js, SPA navigation, and real-time ML API
// ==========================================================================
let isAnalyzing = false;
const API_URL = "http://127.0.0.1:5000";

let allTransactions = [];
let chartInstances = {};
let currentUser = null;
let auditLogs = [
    { timestamp: new Date(Date.now() - 3600000).toISOString(), type: "SYSTEM_BOOT", severity: "INFO", component: "API Gateway", details: "Flask REST API initialized on 127.0.0.1:5000" },
    { timestamp: new Date(Date.now() - 3500000).toISOString(), type: "MODEL_LOAD", severity: "INFO", component: "ML Engine", details: "RandomForestClassifier pipeline & IsolationForest loaded" },
    { timestamp: new Date(Date.now() - 3400000).toISOString(), type: "DB_SYNC", severity: "INFO", component: "SQLite Database", details: "Verified connection to fraud_detection.db" },
    { timestamp: new Date(Date.now() - 1800000).toISOString(), type: "AUTH_INIT", severity: "INFO", component: "Security Module", details: "JWT HS256 Token authentication enabled" }
];

// ==========================================================================
// INITIALIZATION ON DOM READY
// ==========================================================================

document.addEventListener("DOMContentLoaded", async () => {
    console.log("🛡️ FraudGuard AI Dashboard Initialized.");

    // Check Backend Connection Health
    checkBackendHealth();

    // Check & Initialize User Authentication Session
    await initAuthSession();

    // Load Initial Data
    loadStatistics();
    loadTransactions();

    // Setup SPA Navigation
    initNavigation();

    // Setup Search & Filter Listeners
    setupFilterListeners();

    // Render Initial Static Analytics & Audit Logs
    renderAuditLogs();

    // Setup Global Refresh Button
    const refreshBtn = document.getElementById("refreshBtn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            refreshBtn.classList.add("rotating");
            await loadStatistics();
            await loadTransactions();
            showToast("Data Synchronized", "Successfully refreshed stats and transaction history.", "success");
            setTimeout(() => refreshBtn.classList.remove("rotating"), 600);
        });
    }

    // Setup Sidebar Mobile Toggle
    const sidebarToggle = document.getElementById("sidebarToggle");
    const sidebar = document.getElementById("sidebar");
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener("click", () => {
            sidebar.classList.toggle("mobile-open");
        });
    }

    // Close Dropdown on Outside Click
    document.addEventListener("click", (e) => {
        const dropdown = document.getElementById("userDropdown");
        const profileBtn = document.getElementById("userProfileBtn");
        if (dropdown && !dropdown.classList.contains("hidden")) {
            if (profileBtn && !profileBtn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add("hidden");
            }
        }
    });
});

// ==========================================================================
// USER AUTHENTICATION & SESSION MANAGEMENT
// ==========================================================================

function getAuthToken() {
    return localStorage.getItem("fraudguard_jwt") || "";
}

function setAuthToken(token) {
    if (token) {
        localStorage.setItem("fraudguard_jwt", token);
    } else {
        localStorage.removeItem("fraudguard_jwt");
    }
}

async function initAuthSession() {
    const token = getAuthToken();
    if (!token) {
        // Default guest analyst profile
        updateUserUI({
            name: "Senior Risk Analyst",
            email: "analyst@fraudguard.ai",
            role: "Lead Risk Analyst"
        });
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            updateUserUI(currentUser);
            console.log("Authenticated as:", currentUser.name, `(${currentUser.role})`);
        } else {
            // Token expired or invalid
            setAuthToken("");
            currentUser = null;
            updateUserUI({
                name: "Senior Risk Analyst",
                email: "analyst@fraudguard.ai",
                role: "Lead Risk Analyst"
            });
        }
    } catch (err) {
        console.warn("Auth check error:", err);
    }
}

function updateUserUI(user) {
    if (!user) return;

    const name = user.name || "Risk Analyst";
    const email = user.email || "analyst@fraudguard.ai";
    const role = user.role || "Lead Risk Analyst";

    // Compute 2-letter Initials
    const parts = name.trim().split(" ");
    let initials = "AN";
    if (parts.length >= 2) {
        initials = (parts[0][0] + parts[1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0].length >= 2) {
        initials = parts[0].substring(0, 2).toUpperCase();
    }

    // Topbar elements
    const avatarEl = document.getElementById("topbarAvatar");
    const nameEl = document.getElementById("topbarUserName");
    const roleEl = document.getElementById("topbarUserRole");
    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = role;

    // Dropdown elements
    const dropNameEl = document.getElementById("dropdownUserName");
    const dropEmailEl = document.getElementById("dropdownUserEmail");
    if (dropNameEl) dropNameEl.textContent = name;
    if (dropEmailEl) dropEmailEl.textContent = email;

    // Profile modal elements
    const profEmail = document.getElementById("profileEmail");
    const profName = document.getElementById("profileName");
    const profRole = document.getElementById("profileRole");
    if (profEmail) profEmail.value = email;
    if (profName) profName.value = name;
    if (profRole) profRole.value = role;
}

function toggleUserDropdown() {
    const dropdown = document.getElementById("userDropdown");
    if (dropdown) {
        dropdown.classList.toggle("hidden");
    }
}

function closeUserDropdown() {
    const dropdown = document.getElementById("userDropdown");
    if (dropdown) dropdown.classList.add("hidden");
}

function openAuthModal(tab = "signin") {
    closeUserDropdown();
    const modal = document.getElementById("authModal");
    if (modal) {
        modal.classList.add("active-modal");
        switchAuthTab(tab);
    }
}

function closeAuthModal() {
    const modal = document.getElementById("authModal");
    if (modal) modal.classList.remove("active-modal");
}

function switchAuthTab(tab) {
    const tabSignIn = document.getElementById("tabBtnSignIn");
    const tabSignUp = document.getElementById("tabBtnSignUp");
    const formSignIn = document.getElementById("signInForm");
    const formSignUp = document.getElementById("signUpForm");
    const title = document.getElementById("authModalTitle");

    if (tab === "signin") {
        if (tabSignIn) tabSignIn.classList.add("active");
        if (tabSignUp) tabSignUp.classList.remove("active");
        if (formSignIn) formSignIn.classList.remove("hidden");
        if (formSignUp) formSignUp.classList.add("hidden");
        if (title) title.textContent = "🔐 Analyst Authentication";
    } else {
        if (tabSignIn) tabSignIn.classList.remove("active");
        if (tabSignUp) tabSignUp.classList.add("active");
        if (formSignIn) formSignIn.classList.add("hidden");
        if (formSignUp) formSignUp.classList.remove("hidden");
        if (title) title.textContent = "✨ Register New Security Analyst";
    }
}

function fillDemoCredentials() {
    const email = document.getElementById("loginEmail");
    const pwd = document.getElementById("loginPassword");
    if (email) email.value = "analyst@fraudguard.ai";
    if (pwd) pwd.value = "admin123";
    showToast("Credentials Filled", "Demo Analyst credentials populated.", "info");
}

async function submitSignIn() {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (!email || !password) {
        showToast("Missing Fields", "Please enter your email and password.", "error");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Login failed");
        }

        setAuthToken(data.token);
        currentUser = data.user;
        updateUserUI(currentUser);
        closeAuthModal();

        auditLogs.unshift({
            timestamp: new Date().toISOString(),
            type: "USER_LOGIN",
            severity: "INFO",
            component: "Authentication",
            details: `Analyst authenticated: ${currentUser.name} (${currentUser.email})`
        });
        renderAuditLogs();

        showToast("Authentication Successful", `Welcome back, ${currentUser.name}!`, "success");

    } catch (err) {
        showToast("Login Failed", err.message, "error");
    }
}

async function submitSignUp() {
    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value.trim();
    const role = document.getElementById("registerRole").value;

    if (!name || !email || !password) {
        showToast("Missing Information", "Please fill out all registration fields.", "error");
        return;
    }

    if (password.length < 6) {
        showToast("Weak Password", "Password must be at least 6 characters long.", "warning");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password, role })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Registration failed");
        }

        setAuthToken(data.token);
        currentUser = data.user;
        updateUserUI(currentUser);
        closeAuthModal();

        auditLogs.unshift({
            timestamp: new Date().toISOString(),
            type: "USER_REGISTER",
            severity: "INFO",
            component: "Authentication",
            details: `New analyst registered: ${currentUser.name} (${currentUser.role})`
        });
        renderAuditLogs();

        showToast("Registration Complete", `Account created successfully. Welcome, ${currentUser.name}!`, "success");

    } catch (err) {
        showToast("Registration Failed", err.message, "error");
    }
}

function openProfileModal() {
    closeUserDropdown();
    const modal = document.getElementById("userProfileModal");
    if (modal) {
        modal.classList.add("active-modal");
    }
}

function closeProfileModal() {
    const modal = document.getElementById("userProfileModal");
    if (modal) modal.classList.remove("active-modal");
}

async function submitProfileUpdate() {
    const name = document.getElementById("profileName").value.trim();
    const role = document.getElementById("profileRole").value;
    const password = document.getElementById("profileNewPassword").value.trim();

    const token = getAuthToken();
    if (!token) {
        showToast("Session Error", "Please sign in to update your profile.", "error");
        openAuthModal("signin");
        return;
    }

    try {
        const payload = { name, role };
        if (password) {
            if (password.length < 6) {
                showToast("Weak Password", "New password must be at least 6 characters long.", "warning");
                return;
            }
            payload.password = password;
        }

        const response = await fetch(`${API_URL}/api/auth/profile`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Failed to update profile");
        }

        setAuthToken(data.token);
        currentUser = data.user;
        updateUserUI(currentUser);
        closeProfileModal();

        showToast("Profile Updated", "Your analyst credentials have been saved.", "success");

    } catch (err) {
        showToast("Update Failed", err.message, "error");
    }
}

function handleLogout() {
    closeUserDropdown();
    closeProfileModal();
    setAuthToken("");
    currentUser = null;

    updateUserUI({
        name: "Security Guest",
        email: "guest@fraudguard.ai",
        role: "Guest Mode"
    });

    auditLogs.unshift({
        timestamp: new Date().toISOString(),
        type: "USER_LOGOUT",
        severity: "INFO",
        component: "Authentication",
        details: "Analyst logged out. Session terminated."
    });
    renderAuditLogs();

    showToast("Signed Out", "You have securely logged out of FraudGuard AI.", "info");
}

// ==========================================
// BACKEND HEALTH CHECK
// ==========================================

async function checkBackendHealth() {
    const pill = document.getElementById("apiStatusPill");
    const text = document.getElementById("apiStatusText");

    try {
        const response = await fetch(`${API_URL}/`);
        if (response.ok) {
            const data = await response.json();
            if (pill && text) {
                pill.style.borderColor = "rgba(16, 185, 129, 0.4)";
                text.textContent = "AI Engine Online (Port 5000)";
            }
        }
    } catch (err) {
        console.warn("Backend not reachable yet:", err.message);
        if (pill && text) {
            pill.style.borderColor = "rgba(239, 68, 68, 0.4)";
            text.textContent = "Backend Offline - Start Flask";
        }
    }
}

// ==========================================
// SPA NAVIGATION CONTROLLER
// ==========================================

function initNavigation() {
    const navItems = document.querySelectorAll(".sidebar-nav .nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetView = item.getAttribute("data-view");
            if (targetView) {
                switchView(targetView);
            }
        });
    });
}

function switchView(viewId) {
    // Hide all view sections
    document.querySelectorAll(".view-section").forEach(sec => {
        sec.classList.remove("active-view");
    });

    // Show target section
    const targetSection = document.getElementById(viewId);
    if (targetSection) {
        targetSection.classList.add("active-view");
    }

    // Update active nav item
    document.querySelectorAll(".sidebar-nav .nav-item").forEach(item => {
        if (item.getAttribute("data-view") === viewId) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });

    // Update breadcrumb
    const breadcrumbTitle = document.getElementById("breadcrumbTitle");
    if (breadcrumbTitle) {
        const viewNames = {
            "view-overview": "Dashboard Overview",
            "view-monitoring": "Live Fraud Monitoring",
            "view-analytics": "Analytics & Risk Trends",
            "view-models": "AI Model Studio & Diagnostics",
            "view-audit": "System Audit Trail & Health"
        };
        breadcrumbTitle.textContent = viewNames[viewId] || "Platform";
    }

    // Close mobile sidebar if open
    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.remove("mobile-open");

    // Initialize View-Specific Charts if needed
    if (viewId === "view-analytics") {
        renderAnalyticsCharts();
    }
}

// ==========================================
// 1-CLICK DEMO TEST SCENARIOS
// ==========================================

function loadScenario(type) {
    const amountEl = document.getElementById("amount");
    const accountAgeEl = document.getElementById("accountAge");
    const failedAttemptsEl = document.getElementById("failedAttempts");
    const hourEl = document.getElementById("transactionHour");
    const prevTxEl = document.getElementById("previousTransactions");
    const deviceEl = document.getElementById("deviceChanged");
    const locationEl = document.getElementById("locationChanged");

    if (!amountEl) return;

    if (type === "normal") {
        amountEl.value = 1850;
        accountAgeEl.value = 420;
        failedAttemptsEl.value = 0;
        hourEl.value = 14;
        prevTxEl.value = 52;
        deviceEl.value = "0";
        locationEl.value = "0";
        showToast("Scenario Loaded", "Normal E-Commerce Purchase loaded.", "info");
    } else if (type === "suspicious") {
        amountEl.value = 28500;
        accountAgeEl.value = 35;
        failedAttemptsEl.value = 1;
        hourEl.value = 21;
        prevTxEl.value = 8;
        deviceEl.value = "0";
        locationEl.value = "1";
        showToast("Scenario Loaded", "Suspicious Location Shift scenario loaded.", "warning");
    } else if (type === "takeover") {
        amountEl.value = 88000;
        accountAgeEl.value = 4;
        failedAttemptsEl.value = 5;
        hourEl.value = 3;
        prevTxEl.value = 2;
        deviceEl.value = "1";
        locationEl.value = "1";
        showToast("Scenario Loaded", "High-Risk Account Takeover scenario loaded.", "error");
    } else if (type === "midnight") {
        amountEl.value = 75000;
        accountAgeEl.value = 8;
        failedAttemptsEl.value = 2;
        hourEl.value = 2;
        prevTxEl.value = 14;
        deviceEl.value = "1";
        locationEl.value = "0";
        showToast("Scenario Loaded", "Midnight High-Value Outlier loaded.", "warning");
    }
}

// ==========================================
// ANALYZE TRANSACTION (PREDICT FRAUD)
// ==========================================


async function analyzeTransaction(event) {
    // Prevent form submission and page refresh
    if (event && event.preventDefault) {
        event.preventDefault();
    }

    // Prevent multiple requests at the same time
    if (isAnalyzing) {
        return;
    }

    console.log("Analyze button clicked.");

    // Get input values
    const amount = Number(document.getElementById("amount").value);
    const accountAge = Number(document.getElementById("accountAge").value);
    const failedAttempts = Number(document.getElementById("failedAttempts").value);
    const transactionHour = Number(document.getElementById("transactionHour").value);
    const previousTransactions = Number(document.getElementById("previousTransactions").value);
    const deviceChanged = Number(document.getElementById("deviceChanged").value);
    const locationChanged = Number(document.getElementById("locationChanged").value);

    // Validate input values
    if (
        !Number.isFinite(amount) || amount <= 0 ||
        !Number.isFinite(accountAge) || accountAge < 0 ||
        !Number.isFinite(failedAttempts) || failedAttempts < 0 ||
        !Number.isFinite(transactionHour) ||
        transactionHour < 0 || transactionHour > 23 ||
        !Number.isFinite(previousTransactions) || previousTransactions < 0
    ) {
        showToast(
            "Validation Error",
            "Please enter valid values in all transaction fields.",
            "error"
        );
        return;
    }

    // Prepare transaction data
    const transactionData = {
        amount: amount,
        account_age_days: accountAge,
        failed_attempts: failedAttempts,
        transaction_hour: transactionHour,
        previous_transactions: previousTransactions,
        device_changed: deviceChanged,
        location_changed: locationChanged
    };

    console.log("Sending transaction to AI:", transactionData);

    // Get UI elements
    const loading = document.getElementById("loading");
    const resultContainer = document.getElementById("result");
    const emptyResult = document.getElementById("emptyResult");
    const analyzeBtn = document.getElementById("analyzeBtn");

    // Start analysis
    isAnalyzing = true;

    if (loading) loading.classList.remove("hidden");
    if (resultContainer) resultContainer.classList.add("hidden");
    if (emptyResult) emptyResult.classList.add("hidden");
    if (analyzeBtn) analyzeBtn.disabled = true;

    try {
        // Prepare request headers
        const headers = {
            "Content-Type": "application/json"
        };

        const token = getAuthToken();

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        // Send transaction to Flask AI backend
        const response = await fetch(`${API_URL}/predict`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(transactionData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Server returned HTTP ${response.status}: ${errorText}`
            );
        }

        // Get prediction response
        const prediction = await response.json();

        console.log("AI Prediction received:", prediction);

        // Display prediction
        displayResult(prediction);

        // Record audit event
        auditLogs.unshift({
            timestamp: new Date().toISOString(),
            type: "PREDICTION_RUN",
            severity: prediction.risk === "HIGH" ? "WARN" : "INFO",
            component: "Inference Engine",
            details: `Transaction analyzed: ₹${amount.toLocaleString()} | Risk: ${prediction.risk} | Probability: ${prediction.fraud_probability}%`
        });

        renderAuditLogs();

        // Refresh dashboard data
        
// Refresh dashboard data without affecting the AI prediction
try {
    await Promise.all([
        loadStatistics(),
        loadTransactions()
    ]);
} catch (refreshError) {
    console.error("Dashboard refresh failed:", refreshError);
    showToast(
        "Dashboard Warning",
        "Prediction completed, but dashboard data could not refresh.",
        "warning"
    );
}


        // Show prediction notification
        if (prediction.risk === "HIGH") {
            showToast(
                "High Risk Fraud Detected!",
                `Fraud probability: ${prediction.fraud_probability}%. Action: ${prediction.action}.`,
                "error"
            );
        } else if (prediction.risk === "MEDIUM") {
            showToast(
                "Review Recommended",
                `Fraud probability: ${prediction.fraud_probability}%. Manual review advised.`,
                "warning"
            );
        } else {
            showToast(
                "Transaction Cleared",
                `Fraud probability: ${prediction.fraud_probability}%. Transaction approved.`,
                "success"
            );
        }

    } catch (error) {
        console.error("Prediction error:", error);

        // Hide result and show empty state on failure
        if (resultContainer) {
            resultContainer.classList.add("hidden");
        }

        if (emptyResult) {
            emptyResult.classList.remove("hidden");
        }

        showToast(
            "AI Inference Failed",
            error.message,
            "error"
        );

    } finally {
        // Stop loading
        if (loading) {
            loading.classList.add("hidden");
        }

        if (analyzeBtn) {
            analyzeBtn.disabled = false;
        }

        isAnalyzing = false;
    }
}


// ==========================================
// DISPLAY AI PREDICTION RESULT
// ==========================================

function displayResult(data) {
    const resultContainer = document.getElementById("result");
    const emptyResult = document.getElementById("emptyResult");

    if (!resultContainer) return;

    if (emptyResult) {
        emptyResult.classList.add("hidden");
    }

    resultContainer.classList.remove("hidden");

    // Risk Score
    const riskScore = document.getElementById("riskScore");
    const probability = Number(data.fraud_probability || 0);
    if (riskScore) {
        riskScore.textContent = `${probability.toFixed(1)}%`;
    }

    // Gauge Circle Styling
    const riskCircle = document.getElementById("riskCircle");
    if (riskCircle) {
        riskCircle.classList.remove("gauge-high", "gauge-medium", "gauge-low");
        if (probability >= 70) {
            riskCircle.classList.add("gauge-high");
        } else if (probability >= 40) {
            riskCircle.classList.add("gauge-medium");
        } else {
            riskCircle.classList.add("gauge-low");
        }
    }

    // Risk Badge
    const riskBadge = document.getElementById("riskBadge");
    const risk = String(data.risk || "LOW").toUpperCase();
    if (riskBadge) {
        riskBadge.textContent = `${risk} RISK`;
        riskBadge.className = "risk-pill-badge";
        if (risk === "HIGH") riskBadge.classList.add("high");
        else if (risk === "MEDIUM") riskBadge.classList.add("medium");
        else riskBadge.classList.add("low");
    }

    // Anomaly Badge
    const anomalyBadge = document.getElementById("anomalyBadge");
    if (anomalyBadge) {
        if (data.anomaly_detected) {
            anomalyBadge.classList.remove("hidden");
            anomalyBadge.textContent = "⚠️ Isolation Forest Anomaly Detected (+15%)";
        } else {
            anomalyBadge.classList.add("hidden");
        }
    }

    // Action Box
    const actionEl = document.getElementById("action");
    const verdictIcon = document.getElementById("verdictIcon");
    if (actionEl) {
        const action = data.action || "APPROVE";
        actionEl.textContent = action;
        actionEl.className = "verdict-value";
        if (action === "BLOCK") {
            actionEl.classList.add("verdict-block");
            if (verdictIcon) verdictIcon.textContent = "🛑";
        } else if (action === "REVIEW") {
            actionEl.classList.add("verdict-review");
            if (verdictIcon) verdictIcon.textContent = "⚠️";
        } else {
            actionEl.classList.add("verdict-approve");
            if (verdictIcon) verdictIcon.textContent = "✅";
        }
    }

    // Top Result Icon
    const resultIcon = document.getElementById("resultIcon");
    if (resultIcon) {
        if (risk === "HIGH") resultIcon.textContent = "🚨";
        else if (risk === "MEDIUM") resultIcon.textContent = "⚠️";
        else resultIcon.textContent = "🛡️";
    }

    // Reasons List
    // Reasons List
const reasonsList = document.getElementById("reasonsList");

if (reasonsList) {
    reasonsList.innerHTML = "";

    let reasons = data.reasons || [];

    // Support both array and string responses
    if (typeof reasons === "string") {
        reasons = [reasons];
    }

    if (!Array.isArray(reasons)) {
        reasons = [];
    }

    if (reasons.length > 0) {
        reasons.forEach(reason => {
            const li = document.createElement("li");
            li.className = "reason-item";

            const reasonText = String(reason);

            if (reasonText.toLowerCase().includes("no suspicious")) {
                li.classList.add("clean");
                li.textContent = "✅ " + reasonText;
            } else {
                li.textContent = "⚠️ " + reasonText;
            }

            reasonsList.appendChild(li);
        });
    } else {
        const li = document.createElement("li");
        li.className = "reason-item clean";
        li.textContent = "No additional reasons provided.";
        reasonsList.appendChild(li);
    }
}
}

// ==========================================
// LOAD STATISTICS & DASHBOARD KPIS
// ==========================================

async function loadStatistics() {
    try {
        const response = await fetch(`${API_URL}/statistics?t=${Date.now()}`);
        if (!response.ok) throw new Error("Failed to load statistics");

        const data = await response.json();
        console.log("Statistics data:", data);

        // Update KPI Counters
        updateCountElement("totalTransactions", data.total_transactions || 0);
        updateCountElement("fraudDetected", data.high_risk || 0);
        updateCountElement("highRisk", data.high_risk || 0);
        updateCountElement("protectedTransactions", data.approved || 0);

        const navBadge = document.getElementById("navTotalBadge");
        if (navBadge) navBadge.textContent = data.total_transactions || 0;

        // Render Professional Chart.js Doughnut Chart
        createRiskChart(data.high_risk || 0, data.medium_risk || 0, data.low_risk || 0);

        // Render 7-Day Trend Line Chart
        createOverviewTrendChart(data);

    } catch (error) {
        console.error("Error loading statistics:", error);
    }
}

function updateCountElement(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = Number(value).toLocaleString();
    }
}

// ==========================================
// CHART.JS: RISK DISTRIBUTION DOUGHNUT CHART
// ==========================================

function createRiskChart(highRisk, mediumRisk, lowRisk) {
    const canvas = document.getElementById("riskChart");
    if (!canvas) return;

    if (chartInstances["riskChart"]) {
        chartInstances["riskChart"].destroy();
    }

    const high = Number(highRisk) || 0;
    const med = Number(mediumRisk) || 0;
    const low = Number(lowRisk) || 0;
    const total = high + med + low;

    const ctx = canvas.getContext("2d");

    chartInstances["riskChart"] = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["High Risk (Block)", "Medium Risk (Review)", "Low Risk (Approved)"],
            datasets: [{
                data: total > 0 ? [high, med, low] : [1, 1, 1],
                backgroundColor: total > 0 ? ["#ef4444", "#f59e0b", "#10b981"] : ["#334155", "#475569", "#64748b"],
                borderColor: "#111827",
                borderWidth: 3,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "72%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#94a3b8",
                        font: { family: "Inter", size: 12 },
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: "circle"
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (total === 0) return " No data yet";
                            const val = context.raw;
                            const pct = ((val / total) * 100).toFixed(1);
                            return ` ${context.label}: ${val} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

// ==========================================
// CHART.JS: 7-DAY OVERVIEW TREND CHART
// ==========================================

function createOverviewTrendChart(stats) {
    const canvas = document.getElementById("overviewTrendChart");
    if (!canvas) return;

    if (chartInstances["overviewTrendChart"]) {
        chartInstances["overviewTrendChart"].destroy();
    }

    const ctx = canvas.getContext("2d");

    const total = stats.total_transactions || 26;
    const high = stats.high_risk || 22;
    const approved = stats.approved || 4;

    const labels = ["6 Days Ago", "5 Days Ago", "4 Days Ago", "3 Days Ago", "2 Days Ago", "Yesterday", "Today"];
    const approvedPoints = [Math.max(1, Math.round(approved * 0.1)), Math.max(1, Math.round(approved * 0.2)), Math.max(1, Math.round(approved * 0.3)), Math.max(2, Math.round(approved * 0.4)), Math.max(2, Math.round(approved * 0.6)), Math.max(3, Math.round(approved * 0.8)), approved];
    const blockedPoints = [Math.max(1, Math.round(high * 0.1)), Math.max(2, Math.round(high * 0.25)), Math.max(3, Math.round(high * 0.4)), Math.max(5, Math.round(high * 0.55)), Math.max(8, Math.round(high * 0.7)), Math.max(12, Math.round(high * 0.85)), high];

    chartInstances["overviewTrendChart"] = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Approved Clean Flow",
                    data: approvedPoints,
                    borderColor: "#10b981",
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: "#10b981"
                },
                {
                    label: "Fraud Intercepted",
                    data: blockedPoints,
                    borderColor: "#ef4444",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: "#ef4444"
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#64748b", font: { size: 11 } }
                },
                y: {
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#64748b", font: { size: 11 }, precision: 0 }
                }
            },
            plugins: {
                legend: {
                    position: "top",
                    labels: { color: "#94a3b8", font: { family: "Inter", size: 11 }, usePointStyle: true }
                }
            }
        }
    });
}

// ==========================================
// LOAD & RENDER TRANSACTION HISTORY
// ==========================================

async function loadTransactions() {
    try {
        const response = await fetch(`${API_URL}/transactions?t=${Date.now()}`);
        if (!response.ok) throw new Error("Failed to load transactions");

        allTransactions = await response.json();
        console.log(`Loaded ${allTransactions.length} transactions from DB.`);

        // Render both tables
        displayTransactions(allTransactions);
        displayMonitoringTable(allTransactions);

        // Update Analytics calculations
        calculateAnalyticsAggregates(allTransactions);

    } catch (error) {
        console.error("Transaction history error:", error);
    }
}

function displayTransactions(transactions) {
    const table = document.getElementById("transactionTable");
    if (!table) return;

    table.innerHTML = "";

    if (!transactions || transactions.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="7" class="text-center" style="padding: 30px; color: var(--text-muted);">
                    No transactions recorded yet in the database.
                </td>
            </tr>
        `;
        return;
    }

    transactions.slice(0, 10).forEach(tx => {
        const row = document.createElement("tr");

        const riskClass = tx.risk === "HIGH" ? "risk-high" : (tx.risk === "MEDIUM" ? "risk-medium" : "risk-low");
        const actionClass = tx.action === "BLOCK" ? "block" : (tx.action === "REVIEW" ? "review" : "approve");
        const formattedAmount = Number(tx.amount).toLocaleString("en-IN");
        const hasAnomaly = (tx.reasons && tx.reasons.toLowerCase().includes("anomaly")) || tx.risk === "HIGH";

        row.innerHTML = `
            <td><span class="tx-id-badge">#${tx.id}</span></td>
            <td><span class="tx-amount">₹${formattedAmount}</span></td>
            <td><span class="table-tag ${riskClass}">${tx.risk}</span></td>
            <td><strong>${tx.fraud_probability}%</strong></td>
            <td><span class="action-pill ${actionClass}">${tx.action}</span></td>
            <td>${hasAnomaly ? '⚠️ Detected' : '✅ Normal'}</td>
            <td>
                <button class="inspect-btn" onclick="openInspectorModal(${tx.id})">Inspect</button>
            </td>
        `;

        table.appendChild(row);
    });
}

function displayMonitoringTable(transactions) {
    const tableBody = document.getElementById("monitoringTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (!transactions || transactions.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center" style="padding: 30px; color: var(--text-muted);">
                    No transactions matching filter criteria.
                </td>
            </tr>
        `;
        return;
    }

    transactions.forEach(tx => {
        const row = document.createElement("tr");

        const riskClass = tx.risk === "HIGH" ? "risk-high" : (tx.risk === "MEDIUM" ? "risk-medium" : "risk-low");
        const actionClass = tx.action === "BLOCK" ? "block" : (tx.action === "REVIEW" ? "review" : "approve");
        const formattedAmount = Number(tx.amount).toLocaleString("en-IN");
        const hasAnomaly = (tx.reasons && tx.reasons.toLowerCase().includes("anomaly")) || tx.risk === "HIGH";
        const dateStr = tx.timestamp ? new Date(tx.timestamp).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

        row.innerHTML = `
            <td><span class="tx-id-badge">#${tx.id}</span></td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${dateStr}</td>
            <td><span class="tx-amount">₹${formattedAmount}</span></td>
            <td><span class="table-tag ${riskClass}">${tx.risk}</span></td>
            <td><strong>${tx.fraud_probability}%</strong></td>
            <td><span class="action-pill ${actionClass}">${tx.action}</span></td>
            <td>${hasAnomaly ? '⚠️ Detected' : '✅ Normal'}</td>
            <td>
                <button class="inspect-btn" onclick="openInspectorModal(${tx.id})">Inspect Details</button>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

// ==========================================
// SEARCH & FILTERING
// ==========================================

function setupFilterListeners() {
    const search = document.getElementById("transactionSearch");
    const risk = document.getElementById("riskFilter");
    const action = document.getElementById("actionFilter");

    if (search) search.addEventListener("input", filterTransactions);
    if (risk) risk.addEventListener("change", filterTransactions);
    if (action) action.addEventListener("change", filterTransactions);
}

function filterTransactions() {
    const searchInput = document.getElementById("transactionSearch");
    const riskFilter = document.getElementById("riskFilter");
    const actionFilter = document.getElementById("actionFilter");

    if (!searchInput || !riskFilter || !actionFilter) return;

    const search = searchInput.value.toLowerCase().trim();
    const selectedRisk = riskFilter.value;
    const selectedAction = actionFilter.value;

    const filtered = allTransactions.filter(tx => {
        const matchesSearch =
            String(tx.id).toLowerCase().includes(search) ||
            String(tx.amount).toLowerCase().includes(search) ||
            String(tx.risk).toLowerCase().includes(search) ||
            String(tx.action).toLowerCase().includes(search);

        const matchesRisk = selectedRisk === "ALL" || tx.risk === selectedRisk;
        const matchesAction = selectedAction === "ALL" || tx.action === selectedAction;

        return matchesSearch && matchesRisk && matchesAction;
    });

    displayTransactions(filtered);
}

function handleMonitoringSearch() {
    const searchInput = document.getElementById("monitoringSearch");
    if (!searchInput) return;

    const term = searchInput.value.toLowerCase().trim();
    const filtered = allTransactions.filter(tx => {
        return (
            String(tx.id).toLowerCase().includes(term) ||
            String(tx.amount).toLowerCase().includes(term) ||
            String(tx.risk).toLowerCase().includes(term) ||
            String(tx.action).toLowerCase().includes(term) ||
            String(tx.reasons || "").toLowerCase().includes(term)
        );
    });

    displayMonitoringTable(filtered);
}

// ==========================================
// TRANSACTION INSPECTOR MODAL
// ==========================================

function openInspectorModal(txId) {
    const tx = allTransactions.find(t => t.id === txId);
    if (!tx) return;

    const modal = document.getElementById("inspectorModal");
    if (!modal) return;

    document.getElementById("modalTxId").textContent = `#${tx.id}`;
    document.getElementById("modalTimestamp").textContent = tx.timestamp ? new Date(tx.timestamp).toLocaleString() : "Live Session";
    document.getElementById("modalAmount").textContent = `₹${Number(tx.amount).toLocaleString("en-IN")}`;
    document.getElementById("modalAccountAge").textContent = `${tx.account_age_days} days`;
    document.getElementById("modalFailedAttempts").textContent = `${tx.failed_attempts} failed attempts`;
    document.getElementById("modalHour").textContent = `${String(tx.transaction_hour).padStart(2, "0")}:00 hrs`;
    document.getElementById("modalDevice").textContent = tx.device_changed === 1 ? "⚠️ New Unrecognized Device" : "✅ Known Registered Device";
    document.getElementById("modalLocation").textContent = tx.location_changed === 1 ? "⚠️ High Discrepancy IP/Location" : "✅ Home / Normal Location";
    document.getElementById("modalProb").textContent = `${tx.fraud_probability}%`;
    document.getElementById("modalRisk").textContent = `${tx.risk} RISK (${tx.action})`;

    const reasonsList = document.getElementById("modalReasonsList");
    if (reasonsList) {
        reasonsList.innerHTML = "";
        const rawReasons = tx.reasons ? tx.reasons.split(" | ") : ["No suspicious activity logged."];
        rawReasons.forEach(r => {
            const li = document.createElement("li");
            li.className = "reason-item";
            li.innerHTML = `<span>⚠️</span><span>${r}</span>`;
            reasonsList.appendChild(li);
        });
    }

    modal.classList.add("active-modal");
}

function closeInspectorModal() {
    const modal = document.getElementById("inspectorModal");
    if (modal) modal.classList.remove("active-modal");
}

// ==========================================
// EXPORT TO CSV
// ==========================================

function exportToCSV() {
    if (!allTransactions || allTransactions.length === 0) {
        showToast("Export Failed", "No transactions available to export.", "warning");
        return;
    }

    const headers = ["ID", "Amount", "Account_Age_Days", "Failed_Attempts", "Hour", "Device_Changed", "Location_Changed", "Fraud_Probability", "Risk", "Action", "Timestamp", "Reasons"];
    const rows = allTransactions.map(tx => [
        tx.id,
        tx.amount,
        tx.account_age_days,
        tx.failed_attempts,
        tx.transaction_hour,
        tx.device_changed,
        tx.location_changed,
        tx.fraud_probability,
        tx.risk,
        tx.action,
        `"${tx.timestamp || ''}"`,
        `"${(tx.reasons || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `fraud_detection_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Export Complete", `Exported ${allTransactions.length} transactions to CSV.`, "success");
}

// ==========================================
// ANALYTICS & AGGREGATE CALCULATIONS
// ==========================================

function calculateAnalyticsAggregates(transactions) {
    if (!transactions || transactions.length === 0) return;

    let totalVol = 0;
    let fraudVol = 0;
    let blockCount = 0;

    transactions.forEach(t => {
        const amt = Number(t.amount) || 0;
        totalVol += amt;
        if (t.risk === "HIGH" || t.action === "BLOCK") {
            fraudVol += amt;
            blockCount++;
        }
    });

    const avg = transactions.length > 0 ? Math.round(totalVol / transactions.length) : 0;
    const blockRate = transactions.length > 0 ? ((blockCount / transactions.length) * 100).toFixed(1) : 0;

    const totalVolEl = document.getElementById("analyticsTotalVol");
    const fraudVolEl = document.getElementById("analyticsFraudVol");
    const avgTxEl = document.getElementById("analyticsAvgTx");
    const blockRateEl = document.getElementById("analyticsBlockRate");

    if (totalVolEl) totalVolEl.textContent = `₹${totalVol.toLocaleString("en-IN")}`;
    if (fraudVolEl) fraudVolEl.textContent = `₹${fraudVol.toLocaleString("en-IN")}`;
    if (avgTxEl) avgTxEl.textContent = `₹${avg.toLocaleString("en-IN")}`;
    if (blockRateEl) blockRateEl.textContent = `${blockRate}%`;
}

function renderAnalyticsCharts() {
    // 1. Hourly Risk Chart
    const hourlyCanvas = document.getElementById("hourlyRiskChart");
    if (hourlyCanvas && !chartInstances["hourlyRiskChart"]) {
        const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
        const hourlyHigh = [14, 18, 22, 16, 9, 3, 2, 1, 2, 4, 3, 5, 6, 7, 8, 9, 11, 13, 15, 18, 20, 22, 25, 20];
        const hourlyLow = [2, 1, 1, 0, 3, 8, 15, 24, 32, 45, 52, 60, 65, 58, 55, 62, 70, 75, 80, 68, 50, 35, 20, 10];

        chartInstances["hourlyRiskChart"] = new Chart(hourlyCanvas.getContext("2d"), {
            type: "bar",
            data: {
                labels: hours,
                datasets: [
                    { label: "High Risk Flags", data: hourlyHigh, backgroundColor: "#ef4444", borderRadius: 4 },
                    { label: "Normal Approved Flow", data: hourlyLow, backgroundColor: "#10b981", borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#64748b", maxTicksLimit: 12 } },
                    y: { stacked: true, grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#64748b" } }
                },
                plugins: {
                    legend: { position: "top", labels: { color: "#94a3b8", usePointStyle: true } }
                }
            }
        });
    }

    // 2. Category Fraud Chart
    const catCanvas = document.getElementById("categoryFraudChart");
    if (catCanvas && !chartInstances["categoryFraudChart"]) {
        chartInstances["categoryFraudChart"] = new Chart(catCanvas.getContext("2d"), {
            type: "bar",
            data: {
                labels: ["Wire Transfer", "E-Commerce", "Crypto / Invest", "POS Terminal", "ATM Cash"],
                datasets: [
                    { label: "Fraud Attempts (₹)", data: [1420000, 680000, 1850000, 210000, 490000], backgroundColor: "#f59e0b", borderRadius: 6 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#64748b" } },
                    y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#94a3b8" } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

// ==========================================
// AUDIT LOGS RENDERER
// ==========================================

function renderAuditLogs() {
    const tbody = document.getElementById("auditTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";
    auditLogs.forEach(log => {
        const row = document.createElement("tr");
        const badgeColor = log.severity === "WARN" ? "var(--risk-medium)" : (log.severity === "ERROR" ? "var(--risk-high)" : "var(--primary-light)");
        row.innerHTML = `
            <td style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">${new Date(log.timestamp).toLocaleTimeString()}</td>
            <td><strong style="font-size: 0.82rem;">${log.type}</strong></td>
            <td><span style="font-weight: 700; font-size: 0.72rem; color: ${badgeColor}; padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.05);">${log.severity}</span></td>
            <td style="color: var(--text-secondary);">${log.component}</td>
            <td style="color: var(--text-primary); font-size: 0.82rem;">${log.details}</td>
        `;
        tbody.appendChild(row);
    });
}

// ==========================================
// TOAST NOTIFICATION UTILITY
// ==========================================

function showToast(title, message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const icons = {
        success: "✅",
        error: "🚨",
        warning: "⚠️",
        info: "ℹ️"
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || "ℹ️"}</div>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            <div class="toast-msg">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(50px)";
        setTimeout(() => toast.remove(), 300);
    }, 4200);
}
