// ==========================================
// AI FRAUD DETECTION SYSTEM
// FRONTEND JAVASCRIPT
// ==========================================

const API_URL = "http://127.0.0.1:5000";

let allTransactions = [];


// ==========================================
// PAGE LOAD
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("AI Fraud Detection System loaded.");

    loadStatistics();
    loadTransactions();

    const search = document.getElementById("transactionSearch");
    const risk = document.getElementById("riskFilter");
    const action = document.getElementById("actionFilter");

    if (search) {
        search.addEventListener("input", filterTransactions);
    }

    if (risk) {
        risk.addEventListener("change", filterTransactions);
    }

    if (action) {
        action.addEventListener("change", filterTransactions);
    }

});


// ==========================================
// ANALYZE TRANSACTION
// ==========================================

async function analyzeTransaction() {

    console.log("Analyze button clicked.");

    // ------------------------------------------
    // GET INPUT VALUES
    // ------------------------------------------

    const amount = Number(
        document.getElementById("amount").value
    );

    const accountAge = Number(
        document.getElementById("accountAge").value
    );

    const failedAttempts = Number(
        document.getElementById("failedAttempts").value
    );

    const transactionHour = Number(
        document.getElementById("transactionHour").value
    );

    const previousTransactions = Number(
        document.getElementById("previousTransactions").value
    );

    const deviceChanged = Number(
        document.getElementById("deviceChanged").value
    );

    const locationChanged = Number(
        document.getElementById("locationChanged").value
    );


    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

    if (
        amount <= 0 ||
        accountAge < 0 ||
        failedAttempts < 0 ||
        transactionHour < 0 ||
        transactionHour > 23 ||
        previousTransactions < 0
    ) {

        alert("Please enter valid transaction details.");

        return;
    }


    // ------------------------------------------
    // CREATE REQUEST DATA
    // ------------------------------------------

    const transactionData = {

        amount: amount,

        account_age_days: accountAge,

        failed_attempts: failedAttempts,

        transaction_hour: transactionHour,

        previous_transactions: previousTransactions,

        device_changed: deviceChanged,

        location_changed: locationChanged

    };


    console.log(
        "Sending transaction:",
        transactionData
    );


    // ------------------------------------------
    // GET UI ELEMENTS
    // ------------------------------------------

    const loading =
        document.getElementById("loading");

    const resultContainer =
        document.getElementById("result");

    const emptyResult =
        document.getElementById("emptyResult");


    // ------------------------------------------
    // SHOW LOADING
    // ------------------------------------------

    if (loading) {
        loading.classList.remove("hidden");
    }

    if (resultContainer) {
        resultContainer.classList.add("hidden");
        resultContainer.style.display = "none";
    }

    if (emptyResult) {
        emptyResult.classList.add("hidden");
    }


    // ------------------------------------------
    // SEND REQUEST TO FLASK
    // ------------------------------------------

    try {

        const response = await fetch(
            `${API_URL}/predict`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(transactionData)
            }
        );


        // ------------------------------------------
        // CHECK RESPONSE
        // ------------------------------------------

        if (!response.ok) {

            throw new Error(
                `Server returned ${response.status}`
            );

        }


        // ------------------------------------------
        // GET AI PREDICTION
        // ------------------------------------------

        const prediction =
            await response.json();


        console.log(
            "AI Prediction:",
            prediction
        );


        // ------------------------------------------
        // DISPLAY RESULT
        // ------------------------------------------

        displayResult(prediction);


        // ------------------------------------------
        // REFRESH DASHBOARD
        // ------------------------------------------

        await loadStatistics();

        await loadTransactions();


        // ------------------------------------------
        // MAKE SURE RESULT STAYS VISIBLE
        // ------------------------------------------

        if (resultContainer) {

            resultContainer.classList.remove("hidden");

            resultContainer.style.display = "block";

        }


        console.log(
            "Risk Analysis displayed successfully."
        );

    }

    catch (error) {

        console.error(
            "Prediction error:",
            error
        );


        alert(
            "Unable to connect to AI server.\n\n" +
            "Make sure Flask is running on port 5000."
        );

    }

    finally {

        // ------------------------------------------
        // HIDE LOADING
        // ------------------------------------------

        if (loading) {
            loading.classList.add("hidden");
        }

    }

}


// ==========================================
// DISPLAY AI RESULT
// ==========================================

function displayResult(data) {

    console.log(
        "DISPLAY RESULT:",
        data
    );


    const resultContainer =
        document.getElementById("result");

    const emptyResult =
        document.getElementById("emptyResult");


    // ------------------------------------------
    // CHECK RESULT CONTAINER
    // ------------------------------------------

    if (!resultContainer) {

        console.error(
            "Result container not found!"
        );

        return;
    }


    // ------------------------------------------
    // HIDE READY MESSAGE
    // ------------------------------------------

    if (emptyResult) {

        emptyResult.classList.add("hidden");

        emptyResult.style.display = "none";

    }


    // ------------------------------------------
    // SHOW RESULT
    // ------------------------------------------

    resultContainer.classList.remove("hidden");

    resultContainer.style.display = "block";


    // ------------------------------------------
    // RISK SCORE
    // ------------------------------------------

    const riskScore =
        document.getElementById("riskScore");


    if (riskScore) {

        const probability =
            Number(data.fraud_probability || 0);

        riskScore.textContent =
            `${probability.toFixed(1)}%`;

    }


    // ------------------------------------------
    // RISK BADGE
    // ------------------------------------------

    const riskBadge =
        document.getElementById("riskBadge");


    if (riskBadge) {

        const risk =
            String(data.risk || "LOW")
                .toUpperCase();


        riskBadge.textContent =
            risk;


        // Remove previous classes

        riskBadge.classList.remove(
            "high",
            "medium",
            "low"
        );


        // Add correct class

        if (risk === "HIGH") {

            riskBadge.classList.add("high");

        }

        else if (risk === "MEDIUM") {

            riskBadge.classList.add("medium");

        }

        else {

            riskBadge.classList.add("low");

        }

    }


    // ------------------------------------------
    // ACTION
    // ------------------------------------------

    const action =
        document.getElementById("action");


    if (action) {

        action.textContent =
            data.action || "UNKNOWN";

    }


    // ------------------------------------------
    // ANOMALY BADGE
    // ------------------------------------------

    const anomalyBadge =
        document.getElementById("anomalyBadge");


    if (anomalyBadge) {

        if (data.anomaly_detected) {

            anomalyBadge.textContent =
                "⚠️ Anomaly Detected";

            anomalyBadge.classList.remove(
                "hidden"
            );

            anomalyBadge.style.display =
                "inline-block";

        }

        else {

            anomalyBadge.classList.add(
                "hidden"
            );

            anomalyBadge.style.display =
                "none";

        }

    }


    // ------------------------------------------
    // RESULT ICON
    // ------------------------------------------

    const resultIcon =
        document.getElementById("resultIcon");


    if (resultIcon) {

        const risk =
            String(data.risk || "LOW")
                .toUpperCase();


        if (risk === "HIGH") {

            resultIcon.textContent = "🚨";

        }

        else if (risk === "MEDIUM") {

            resultIcon.textContent = "⚠️";

        }

        else {

            resultIcon.textContent = "✅";

        }

    }


    // ------------------------------------------
    // REASONS
    // ------------------------------------------

    const reasonsList =
        document.getElementById("reasonsList");


    if (reasonsList) {

        reasonsList.innerHTML = "";


        if (
            data.reasons &&
            data.reasons.length > 0
        ) {

            data.reasons.forEach(reason => {

                const li =
                    document.createElement("li");

                li.textContent =
                    reason;

                reasonsList.appendChild(li);

            });

        }

        else {

            const li =
                document.createElement("li");

            li.textContent =
                "No suspicious activity detected.";

            reasonsList.appendChild(li);

        }

    }


    // ------------------------------------------
    // FINAL VISIBILITY CHECK
    // ------------------------------------------

    resultContainer.classList.remove(
        "hidden"
    );

    resultContainer.style.display =
        "block";


    console.log(
        "Risk Analysis is visible."
    );

}


// ==========================================
// LOAD STATISTICS
// ==========================================

async function loadStatistics() {

    try {

        const response = await fetch(
            `${API_URL}/statistics?t=${Date.now()}`
        );


        if (!response.ok) {

            throw new Error(
                "Failed to load statistics"
            );

        }


        const data =
            await response.json();


        console.log(
            "Statistics:",
            data
        );


        // ------------------------------------------
        // TOTAL TRANSACTIONS
        // ------------------------------------------

        const totalTransactions =
            document.getElementById(
                "totalTransactions"
            );


        if (totalTransactions) {

            totalTransactions.textContent =
                data.total_transactions || 0;

        }


        // ------------------------------------------
        // FRAUD DETECTED
        // ------------------------------------------

        const fraudDetected =
            document.getElementById(
                "fraudDetected"
            );


        if (fraudDetected) {

            fraudDetected.textContent =
                data.high_risk || 0;

        }


        // ------------------------------------------
        // HIGH RISK
        // ------------------------------------------

        const highRisk =
            document.getElementById(
                "highRisk"
            );


        if (highRisk) {

            highRisk.textContent =
                data.high_risk || 0;

        }


        // ------------------------------------------
        // PROTECTED TRANSACTIONS
        // ------------------------------------------

        const protectedTransactions =
            document.getElementById(
                "protectedTransactions"
            );


        if (protectedTransactions) {

            protectedTransactions.textContent =
                data.approved || 0;

        }


        // ------------------------------------------
        // UPDATE CHART
        // ------------------------------------------

        createRiskChart(
            data.high_risk || 0,
            data.medium_risk || 0,
            data.low_risk || 0
        );

    }

    catch (error) {

        console.error(
            "Statistics error:",
            error
        );

    }

}


// ==========================================
// FRAUD RISK CHART
// ==========================================

function createRiskChart(
    highRisk,
    mediumRisk,
    lowRisk
) {

    const canvas =
        document.getElementById("riskChart");


    if (!canvas) {

        console.error(
            "riskChart canvas not found"
        );

        return;
    }


    const ctx =
        canvas.getContext("2d");


    const values = [

        Number(highRisk) || 0,

        Number(mediumRisk) || 0,

        Number(lowRisk) || 0

    ];


    const total =
        values[0] +
        values[1] +
        values[2];


    // ------------------------------------------
    // CLEAR CANVAS
    // ------------------------------------------

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    // ------------------------------------------
    // NO DATA
    // ------------------------------------------

    if (total === 0) {

        ctx.fillStyle =
            "#6b7280";

        ctx.font =
            "18px Arial";

        ctx.textAlign =
            "center";

        ctx.textBaseline =
            "middle";


        ctx.fillText(
            "No transaction data yet",
            canvas.width / 2,
            canvas.height / 2
        );


        return;
    }


    // ------------------------------------------
    // CANVAS POSITION
    // ------------------------------------------

    const centerX =
        canvas.width / 2;

    const centerY =
        canvas.height / 2;


    const radius = 100;

    const innerRadius = 55;


    let startAngle =
        -Math.PI / 2;


    // ------------------------------------------
    // DRAW DOUGHNUT
    // ------------------------------------------

    values.forEach(
        (value, index) => {

            if (value === 0) {
                return;
            }


            const sliceAngle =
                (value / total) *
                Math.PI *
                2;


            const endAngle =
                startAngle +
                sliceAngle;


            ctx.beginPath();


            ctx.arc(
                centerX,
                centerY,
                radius,
                startAngle,
                endAngle
            );


            ctx.arc(
                centerX,
                centerY,
                innerRadius,
                endAngle,
                startAngle,
                true
            );


            ctx.closePath();


            // ------------------------------------------
            // COLORS
            // ------------------------------------------

            if (index === 0) {

                ctx.fillStyle =
                    "#ef4444";

            }

            else if (index === 1) {

                ctx.fillStyle =
                    "#f59e0b";

            }

            else {

                ctx.fillStyle =
                    "#22c55e";

            }


            ctx.fill();


            startAngle =
                endAngle;

        }
    );


    // ------------------------------------------
    // CENTER TOTAL
    // ------------------------------------------

    ctx.fillStyle =
        "#111827";

    ctx.font =
        "bold 24px Arial";

    ctx.textAlign =
        "center";

    ctx.textBaseline =
        "middle";


    ctx.fillText(
        total,
        centerX,
        centerY
    );


    // ------------------------------------------
    // LEGEND
    // ------------------------------------------

    const labels = [

        "High Risk",

        "Medium Risk",

        "Low Risk"

    ];


    const legendY =
        canvas.height - 35;


    labels.forEach(
        (label, index) => {

            const x =
                90 + (index * 160);


            if (index === 0) {

                ctx.fillStyle =
                    "#ef4444";

            }

            else if (index === 1) {

                ctx.fillStyle =
                    "#f59e0b";

            }

            else {

                ctx.fillStyle =
                    "#22c55e";

            }


            ctx.fillRect(
                x,
                legendY - 10,
                12,
                12
            );


            ctx.fillStyle =
                "#374151";

            ctx.font =
                "14px Arial";

            ctx.textAlign =
                "left";


            ctx.fillText(
                label,
                x + 18,
                legendY
            );

        }
    );

}


// ==========================================
// LOAD TRANSACTION HISTORY
// ==========================================

async function loadTransactions() {

    try {

        const response =
            await fetch(
                `${API_URL}/transactions?t=${Date.now()}`
            );


        if (!response.ok) {

            throw new Error(
                "Failed to load transactions"
            );

        }


        allTransactions =
            await response.json();


        console.log(
            "Transactions:",
            allTransactions
        );


        displayTransactions(
            allTransactions
        );

    }

    catch (error) {

        console.error(
            "Transaction history error:",
            error
        );

    }

}


// ==========================================
// DISPLAY TRANSACTIONS
// ==========================================

function displayTransactions(
    transactions
) {

    const table =
        document.getElementById(
            "transactionTable"
        );


    if (!table) {

        console.error(
            "transactionTable not found"
        );

        return;
    }


    table.innerHTML = "";


    // ------------------------------------------
    // NO TRANSACTIONS
    // ------------------------------------------

    if (
        !transactions ||
        transactions.length === 0
    ) {

        table.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="no-data"
                >
                    No transactions found.
                </td>
            </tr>
        `;

        return;
    }


    // ------------------------------------------
    // DISPLAY TRANSACTIONS
    // ------------------------------------------

    transactions.forEach(
        transaction => {

            const row =
                document.createElement("tr");


            let riskClass = "";


            if (
                transaction.risk === "HIGH"
            ) {

                riskClass =
                    "risk-high";

            }

            else if (
                transaction.risk === "MEDIUM"
            ) {

                riskClass =
                    "risk-medium";

            }

            else {

                riskClass =
                    "risk-low";

            }


            row.innerHTML = `

                <td>
                    #${transaction.id}
                </td>

                <td>
                    ₹${Number(
                        transaction.amount
                    ).toLocaleString("en-IN")}
                </td>

                <td>

                    <strong
                        class="${riskClass}"
                    >
                        ${transaction.risk}
                    </strong>

                </td>

                <td>
                    ${transaction.fraud_probability}%
                </td>

                <td>

                    <strong>
                        ${transaction.action}
                    </strong>

                </td>

            `;


            table.appendChild(row);

        }
    );

}


// ==========================================
// FILTER TRANSACTIONS
// ==========================================

function filterTransactions() {

    const searchInput =
        document.getElementById(
            "transactionSearch"
        );

    const riskFilter =
        document.getElementById(
            "riskFilter"
        );

    const actionFilter =
        document.getElementById(
            "actionFilter"
        );


    if (
        !searchInput ||
        !riskFilter ||
        !actionFilter
    ) {

        return;

    }


    const search =
        searchInput.value
            .toLowerCase()
            .trim();


    const selectedRisk =
        riskFilter.value;


    const selectedAction =
        actionFilter.value;


    const filteredTransactions =
        allTransactions.filter(
            transaction => {

                // ------------------------------------------
                // SEARCH
                // ------------------------------------------

                const matchesSearch =

                    String(transaction.id)
                        .toLowerCase()
                        .includes(search)

                    ||

                    String(transaction.amount)
                        .toLowerCase()
                        .includes(search)

                    ||

                    String(transaction.risk)
                        .toLowerCase()
                        .includes(search)

                    ||

                    String(transaction.action)
                        .toLowerCase()
                        .includes(search);


                // ------------------------------------------
                // RISK FILTER
                // ------------------------------------------

                const matchesRisk =

                    selectedRisk === "ALL"

                    ||

                    transaction.risk ===
                    selectedRisk;


                // ------------------------------------------
                // ACTION FILTER
                // ------------------------------------------

                const matchesAction =

                    selectedAction === "ALL"

                    ||

                    transaction.action ===
                    selectedAction;


                return (
                    matchesSearch &&
                    matchesRisk &&
                    matchesAction
                );

            }
        );


    displayTransactions(
        filteredTransactions
    );

}