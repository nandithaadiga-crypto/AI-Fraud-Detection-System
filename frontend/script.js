const API_URL = "http://127.0.0.1:5000";

let allTransactions = [];
let riskChart = null;


// ==========================================
// PAGE LOAD
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
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


    // ==========================================
    // VALIDATION
    // ==========================================

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


    const transactionData = {

        amount: amount,

        account_age_days: accountAge,

        failed_attempts: failedAttempts,

        transaction_hour: transactionHour,

        previous_transactions: previousTransactions,

        device_changed: deviceChanged,

        location_changed: locationChanged

    };


    // ==========================================
    // LOADING
    // ==========================================

    const loading = document.getElementById("loading");
    const result = document.getElementById("result");
    const emptyResult = document.getElementById("emptyResult");

    if (loading) {
        loading.classList.remove("hidden");
    }

    if (result) {
        result.classList.add("hidden");
    }

    if (emptyResult) {
        emptyResult.classList.add("hidden");
    }


    try {

        // ==========================================
        // SEND TRANSACTION TO FLASK
        // ==========================================

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


        const prediction = await response.json();

console.log("AI Prediction:", prediction);
//alert(JSON.stringify(prediction, null, 2));

displayResult(prediction);


        // ==========================================
        // REFRESH DASHBOARD
        // ==========================================

        await loadStatistics();

        await loadTransactions();

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

        if (loading) {
            loading.classList.add("hidden");
        }

    }

}


// ==========================================
// DISPLAY AI RESULT
// ==========================================

function displayResult(result) {

    const resultContainer =
        document.getElementById("result");

    const emptyResult =
        document.getElementById("emptyResult");

    const riskScore =
        document.getElementById("riskScore");

    const riskBadge =
        document.getElementById("riskBadge");

    const anomalyBadge =
        document.getElementById("anomalyBadge");

    const action =
        document.getElementById("action");

    const reasonsList =
        document.getElementById("reasonsList");

    const riskCircle =
        document.getElementById("riskCircle");

    const resultIcon =
        document.getElementById("resultIcon");


    // Show result

    if (emptyResult) {
        emptyResult.classList.add("hidden");
    }

    if (resultContainer) {
        resultContainer.classList.remove("hidden");
    }


    // ==========================================
    // FRAUD PROBABILITY
    // ==========================================

    if (riskScore) {

        const probability =
            Number(result.fraud_probability) || 0;

        riskScore.textContent =
            `${probability}%`;

    }


    // ==========================================
    // RISK BADGE
    // ==========================================

    if (riskBadge) {

        const risk =
            result.risk || "LOW";

        riskBadge.textContent =
            `${risk} RISK`;


        if (risk === "HIGH") {

            riskBadge.style.background =
                "#fee2e2";

            riskBadge.style.color =
                "#991b1b";

        }

        else if (risk === "MEDIUM") {

            riskBadge.style.background =
                "#fef3c7";

            riskBadge.style.color =
                "#92400e";

        }

        else {

            riskBadge.style.background =
                "#dcfce7";

            riskBadge.style.color =
                "#166534";

        }

    }


    // ==========================================
    // ANOMALY
    // ==========================================

    if (anomalyBadge) {

        if (result.anomaly_detected) {

            anomalyBadge.textContent =
                "⚠️ Anomaly Detected";

            anomalyBadge.classList.remove("hidden");

        }

        else {

            anomalyBadge.classList.add("hidden");

        }

    }


    // ==========================================
    // ACTION
    // ==========================================

    if (action) {

        action.textContent =
            result.action || "APPROVE";


        if (result.action === "BLOCK") {

            action.style.color =
                "#dc2626";

        }

        else if (result.action === "REVIEW") {

            action.style.color =
                "#d97706";

        }

        else {

            action.style.color =
                "#16a34a";

        }

    }


    // ==========================================
    // RISK CIRCLE
    // ==========================================

    if (riskCircle) {

        if (result.risk === "HIGH") {

            riskCircle.style.borderColor =
                "#fecaca";

        }

        else if (result.risk === "MEDIUM") {

            riskCircle.style.borderColor =
                "#fde68a";

        }

        else {

            riskCircle.style.borderColor =
                "#bbf7d0";

        }

    }


    // ==========================================
    // RESULT ICON
    // ==========================================

    if (resultIcon) {

        if (result.risk === "HIGH") {

            resultIcon.textContent =
                "🚨";

        }

        else if (result.risk === "MEDIUM") {

            resultIcon.textContent =
                "⚠️";

        }

        else {

            resultIcon.textContent =
                "🛡️";

        }

    }


    // ==========================================
    // RISK REASONS
    // ==========================================

    if (reasonsList) {

        reasonsList.innerHTML = "";


        if (
            result.reasons &&
            result.reasons.length > 0
        ) {

            result.reasons.forEach(reason => {

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

            li.style.background =
                "#f0fdf4";

            li.style.color =
                "#166534";

            reasonsList.appendChild(li);

        }

    }

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


        // ==========================================
        // TOTAL
        // ==========================================

        const totalTransactions =
            document.getElementById(
                "totalTransactions"
            );

        if (totalTransactions) {

            totalTransactions.textContent =
                data.total_transactions || 0;

        }


        // ==========================================
        // FRAUD DETECTED
        // ==========================================

        const fraudDetected =
            document.getElementById(
                "fraudDetected"
            );

        if (fraudDetected) {

            fraudDetected.textContent =
                data.high_risk || 0;

        }


        // ==========================================
        // HIGH RISK
        // ==========================================

        const highRisk =
            document.getElementById(
                "highRisk"
            );

        if (highRisk) {

            highRisk.textContent =
                data.high_risk || 0;

        }


        // ==========================================
        // PROTECTED
        // ==========================================

        const protectedTransactions =
            document.getElementById(
                "protectedTransactions"
            );

        if (protectedTransactions) {

            protectedTransactions.textContent =
                data.approved || 0;

        }


        // ==========================================
        // CHART
        // ==========================================

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


    // Clear canvas

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    // ==========================================
    // NO DATA
    // ==========================================

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


    // ==========================================
    // CANVAS POSITION
    // ==========================================

    const centerX =
        canvas.width / 2;

    const centerY =
        canvas.height / 2;

    const radius =
        100;

    const innerRadius =
        55;


    let startAngle =
        -Math.PI / 2;


    // ==========================================
    // DRAW DOUGHNUT
    // ==========================================

    values.forEach((value, index) => {

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

    });


    // ==========================================
    // CENTER TOTAL
    // ==========================================

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


    // ==========================================
    // LEGEND
    // ==========================================

    const labels = [
        "High Risk",
        "Medium Risk",
        "Low Risk"
    ];


    const legendY =
        canvas.height - 35;


    labels.forEach((label, index) => {

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

    });

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


    // ==========================================
    // NO TRANSACTIONS
    // ==========================================

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


    // ==========================================
    // DISPLAY ROWS
    // ==========================================

    transactions.forEach(transaction => {

        const row =
            document.createElement("tr");


        let riskClass =
            "";


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

    });

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
        allTransactions.filter(transaction => {

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


            const matchesRisk =

                selectedRisk === "ALL" ||

                transaction.risk ===
                selectedRisk;


            const matchesAction =

                selectedAction === "ALL" ||

                transaction.action ===
                selectedAction;


            return (
                matchesSearch &&
                matchesRisk &&
                matchesAction
            );

        });


    displayTransactions(
        filteredTransactions
    );

}