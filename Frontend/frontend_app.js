const seedState = () => ({
    config: {
        baseRate: 0.75
    },
    users: [
        { id: 1, username: "admin", role: "system_admin", farmerId: null, driverId: null },
        { id: 2, username: "ops.maria", role: "ops_manager", farmerId: null, driverId: null },
        { id: 3, username: "acct.sam", role: "accountant", farmerId: null, driverId: null },
        { id: 4, username: "hr.nia", role: "hr_manager", farmerId: null, driverId: null },
        { id: 5, username: "driver.daniel", role: "driver", farmerId: null, driverId: 1 },
        { id: 6, username: "farmer.amina", role: "farmer", farmerId: 1, driverId: null },
        { id: 7, username: "farmer.kwame", role: "farmer", farmerId: 2, driverId: null }
    ],
    farmers: [
        { id: 1, name: "Amina Mensah", phone: "555-0101", address: "North Valley Farm Road", type: "large_scale" },
        { id: 2, name: "Kwame Boateng", phone: "555-0102", address: "East Ridge Farm 12", type: "small_scale" },
        { id: 3, name: "Grace Njeri", phone: "555-0103", address: "Lakeview Plot 8", type: "small_scale" },
        { id: 4, name: "Samuel Okoro", phone: "555-0104", address: "Greenfield Plot 4", type: "small_scale" },
        { id: 5, name: "Fatima Diallo", phone: "555-0105", address: "Harvest Lane 2", type: "small_scale" },
        { id: 6, name: "Peter Moyo", phone: "555-0106", address: "Riverbend Plot 11", type: "small_scale" }
    ],
    groups: [
        { id: 1, name: "Riverbend Growers", region: "North Region", members: [2, 3, 4, 5, 6], chairId: 2, memberRoles: { "2": "chair", "3": "member", "4": "member", "5": "member", "6": "member" } }
    ],
    drivers: [
        { id: 1, name: "Daniel Kofi", phone: "555-0201", status: "active", salaryRate: 28.00 },
        { id: 2, name: "Miriam Adebayo", phone: "555-0202", status: "active", salaryRate: 30.00 },
        { id: 3, name: "Joseph Kamau", phone: "555-0203", status: "suspended", salaryRate: 26.50 }
    ],
    loaders: [
        { id: 1, name: "Lena Owusu", rate: 18.00 },
        { id: 2, name: "Noah Banda", rate: 18.00 },
        { id: 3, name: "Ibrahim Sow", rate: 19.50 }
    ],
    vehicles: [
        { id: 1, plate: "MV-1001", type: "pickup", size: "midsize", capacity: 1500, fuel: "diesel", status: "available", assignedDriverId: 1 },
        { id: 2, plate: "MV-2001", type: "container_truck", size: "heavy_duty", capacity: 9000, fuel: "diesel", status: "available", assignedDriverId: 2 },
        { id: 3, plate: "MV-3001", type: "van", size: "small", capacity: 900, fuel: "gasoline", status: "under_maintenance", assignedDriverId: null }
    ],
    fuelRecords: [
        { id: 1, vehicleId: 1, tripId: 1, fuelDate: "2026-02-01", liters: 18.5, cost: 74 },
        { id: 2, vehicleId: 2, tripId: 2, fuelDate: "2026-02-03", liters: 45, cost: 180 }
    ],
    serviceRecords: [
        { id: 1, vehicleId: 1, tripId: 1, serviceDate: "2026-02-02", cost: 35, description: "Post-trip inspection" },
        { id: 2, vehicleId: 2, tripId: 2, serviceDate: "2026-02-04", cost: 60, description: "Brake and tire inspection" }
    ],
    loaderPayments: [
        { id: 1, tripId: 1, loaderId: 1, amount: 54 },
        { id: 2, tripId: 1, loaderId: 2, amount: 54 },
        { id: 3, tripId: 2, loaderId: 2, amount: 72 },
        { id: 4, tripId: 2, loaderId: 3, amount: 78 }
    ],
    trips: [
        {
            id: 1,
            vehicleId: 1,
            driverId: 1,
            farmerId: 1,
            groupId: null,
            origin: "North Valley Farm",
            destination: "Central Market",
            distanceKm: 42.5,
            tripDate: "2026-02-01",
            deliveryDate: "2026-02-02",
            cargoType: "Tomatoes",
            loadWeight: 800,
            baseRate: 0.75,
            status: "scheduled",
            loaders: [1, 2],
            payments: [{ amount: 30600, method: "mobile_money" }]
        },
        {
            id: 2,
            vehicleId: 2,
            driverId: 2,
            farmerId: null,
            groupId: 1,
            requestedByFarmerId: 2,
            origin: "Riverbend Cooperative Store",
            destination: "Metro Retail Depot",
            distanceKm: 88,
            tripDate: "2026-02-03",
            deliveryDate: "2026-02-04",
            cargoType: "Fertilizer bags",
            loadWeight: 4500,
            baseRate: 0.75,
            status: "scheduled",
            loaders: [2, 3],
            payments: []
        }
    ],
    offences: [
        { id: 1, driverId: 1, tripId: 1, type: "Late departure", surcharge: 25 },
        { id: 2, driverId: 1, tripId: 1, type: "Improper cargo tie-down", surcharge: 35 },
        { id: 3, driverId: 1, tripId: null, type: "Fuel receipt missing", surcharge: 20 }
    ],
    warnings: [{ id: 1, driverId: 1, reason: "Automatic warning: 3 surcharge offences" }],
    suspensions: [],
    reviews: []
});

let state = seedState();
let apiAvailable = false;
let authToken = localStorage.getItem("moversAuthToken") || "";
let currentUser = null;
let selectedTripId = null;
let selectedDriverTripId = null;
let selectedHrDriverId = null;

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const toDateInputValue = (date) => {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
};
const today = toDateInputValue(new Date());
const addDays = (value, days) => {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + days);
    return toDateInputValue(date);
};
const minimumPickupDate = () => addDays(today, 3);
const tripDateRange = (trip) => trip.deliveryDate && trip.deliveryDate !== trip.tripDate
    ? `${trip.tripDate} to ${trip.deliveryDate}`
    : trip.tripDate;

const el = (id) => document.getElementById(id);

let loadingCount = 0;

const setLoading = (active, message = "Loading...") => {
    loadingCount = Math.max(0, loadingCount + (active ? 1 : -1));
    const overlay = el("loadingOverlay");
    if (!overlay) return;
    el("loadingText").textContent = message;
    overlay.classList.toggle("auth-hidden", loadingCount === 0);
    overlay.setAttribute("aria-hidden", loadingCount === 0 ? "true" : "false");
};

const showToast = (title, detail = "", tone = "success") => {
    const container = el("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${tone}`.trim();
    toast.innerHTML = `<strong>${escapeHtml(title)}</strong>${detail ? `<p>${escapeHtml(detail)}</p>` : ""}`;
    container.appendChild(toast);
    window.setTimeout(() => toast.remove(), 4200);
};

const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const showConfirm = ({ title, message, confirmLabel = "Confirm", danger = false }) => new Promise((resolve) => {
    const dialog = el("confirmDialog");
    el("confirmTitle").textContent = title;
    el("confirmMessage").textContent = message;
    const acceptButton = el("confirmAccept");
    acceptButton.textContent = confirmLabel;
    acceptButton.classList.toggle("danger-button", danger);
    dialog.returnValue = "cancel";
    dialog.showModal();
    const onClose = () => {
        dialog.removeEventListener("close", onClose);
        resolve(dialog.returnValue === "confirm");
    };
    dialog.addEventListener("close", onClose);
});

const renderEmptyState = (title, detail, icon = "—") => `
    <div class="empty-state">
        <span class="empty-state-icon">${icon}</span>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(detail)}</p>
    </div>
`;

const statusBadgeClass = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (["scheduled", "in_progress", "completed", "cancelled", "paid", "unpaid", "partial"].includes(normalized)) {
        return normalized;
    }
    return "";
};

const renderBadge = (label, extraClass = "") => {
    const tone = extraClass || statusBadgeClass(label);
    return `<span class="badge ${tone}">${escapeHtml(statusText(label))}</span>`;
};

const updateConnectionStatus = () => {
    const dot = el("connectionDot");
    const label = el("connectionLabel");
    if (!dot || !label) return;
    if (!authToken) {
        dot.className = "status-dot offline";
        label.textContent = "Not signed in";
        return;
    }
    if (loadingCount > 0) {
        dot.className = "status-dot pending";
        label.textContent = "Syncing data...";
        return;
    }
    dot.className = apiAvailable ? "status-dot" : "status-dot offline";
    label.textContent = apiAvailable ? "Connected to MySQL" : "Using local demo data";
};

const viewSubtitles = {
    dashboard: "Operations overview, trip manifest, and business rule checks",
    trips: "Create trip requests, review workload, and update trip status",
    fleet: "Vehicle capacity, maintenance costs, and payroll summaries",
    farmers: "Farmer profiles, groups, payments, and trip reviews",
    discipline: "Driver discipline records, offences, warnings, and suspensions",
    users: "Staff account management and role assignment"
};

const replaceState = (nextState) => {
    state = nextState;
    renderAll();
};

const apiRequest = async (path, options = {}) => {
    let response;
    try {
        response = await fetch(path, {
            headers: {
                "Content-Type": "application/json",
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                ...(options.headers || {})
            },
            ...options
        });
    } catch (error) {
        const fileHint = window.location.protocol === "file:"
            ? " Open the app from http://127.0.0.1:5001 instead of opening frontend.html directly."
            : "";
        throw new Error(`Could not reach the Flask API.${fileHint}`);
    }
    const payload = await response.json();
    if (!response.ok) {
        if (response.status === 401) clearSession();
        throw new Error(payload.error || "Request failed.");
    }
    return payload;
};

const withLoading = async (message, task) => {
    setLoading(true, message);
    updateConnectionStatus();
    try {
        return await task();
    } finally {
        setLoading(false);
        updateConnectionStatus();
    }
};

const showLogin = (message = "") => {
    el("authScreen").classList.remove("auth-hidden");
    el("appShell").classList.add("auth-hidden");
    if (message) setMessage(el("loginMessage"), message, "error");
};

const showApp = () => {
    el("authScreen").classList.add("auth-hidden");
    el("appShell").classList.remove("auth-hidden");
    el("sidebarRole").textContent = `${statusText(currentUser.role)} · ${currentUser.username}`;
    applyRoleAccess();
    updateConnectionStatus();
};

const saveSession = (token, user) => {
    authToken = token;
    currentUser = user;
    localStorage.setItem("moversAuthToken", token);
};

const clearSession = () => {
    authToken = "";
    currentUser = null;
    apiAvailable = false;
    localStorage.removeItem("moversAuthToken");
};

const handleLogin = async (event) => {
    event.preventDefault();
    setMessage(el("loginMessage"), "Signing in...", "");
    try {
        const payload = await withLoading("Signing in...", () => apiRequest("/api/login", {
            method: "POST",
            body: JSON.stringify({
                username: el("usernameInput").value.trim(),
                password: el("passwordInput").value,
                role: el("roleInput").value
            })
        }));
        saveSession(payload.token, payload.user);
        event.target.reset();
        setMessage(el("loginMessage"), "", "");
        showApp();
        await loadFromApi();
        showToast("Signed in", `Welcome back, ${payload.user.username}.`);
    } catch (error) {
        clearSession();
        showLogin(error.message);
    }
};

const handleFarmerSignup = async (event) => {
    event.preventDefault();
    setMessage(el("signupMessage"), "Creating farmer account...", "");
    try {
        const payload = await withLoading("Creating account...", () => apiRequest("/api/signup/farmer", {
            method: "POST",
            body: JSON.stringify({
                firstName: el("signupFirstName").value.trim(),
                lastName: el("signupLastName").value.trim(),
                phone: el("signupPhone").value.trim(),
                address: el("signupAddress").value.trim(),
                farmerType: el("signupFarmerType").value,
                username: el("signupUsername").value.trim(),
                password: el("signupPassword").value
            })
        }));
        saveSession(payload.token, payload.user);
        event.target.reset();
        setMessage(el("signupMessage"), "", "");
        showApp();
        await loadFromApi();
        showToast("Account created", "Your farmer profile is ready.");
    } catch (error) {
        setMessage(el("signupMessage"), error.message, "error");
    }
};

const restoreSession = async () => {
    if (!authToken) {
        showLogin();
        updateConnectionStatus();
        return;
    }
    try {
        const payload = await withLoading("Restoring session...", () => apiRequest("/api/me"));
        currentUser = payload.user;
        showApp();
        await loadFromApi();
    } catch (error) {
        clearSession();
        showLogin(error.message);
    }
};

const loadFromApi = async () => {
    if (!authToken) {
        showLogin();
        updateConnectionStatus();
        return;
    }
    try {
        const payload = await withLoading("Loading application data...", () => apiRequest("/api/bootstrap"));
        apiAvailable = true;
        replaceState(payload);
        setMessage(el("tripFormMessage"), "Connected to MySQL database.", "success");
        updateConnectionStatus();
    } catch (error) {
        apiAvailable = false;
        updateConnectionStatus();
        if (authToken) {
            setMessage(el("tripFormMessage"), error.message, "error");
            showToast("Could not load data", error.message, "error");
        } else {
            showLogin(error.message);
        }
    }
};

const tripCost = (trip) => {
    if (trip && trip.totalCost != null && trip.transportCost != null && trip.taxAmount != null) {
        return {
            transport: roundMoney(trip.transportCost),
            tax: roundMoney(trip.taxAmount),
            total: roundMoney(trip.totalCost),
            source: "database",
        };
    }
    const transport = roundMoney((trip.baseRate ?? state.config.baseRate) * trip.distanceKm * trip.loadWeight);
    const tax = roundMoney(transport * 0.2);
    return { transport, tax, total: roundMoney(transport + tax), source: "estimate" };
};

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const sum = (values) => values.reduce((total, value) => total + value, 0);
const byId = (items, id) => items.find((item) => item.id === Number(id));
const nextId = (items) => items.length ? Math.max(...items.map((item) => item.id)) + 1 : 1;
const statusText = (value) => value.replaceAll("_", " ");
const canRequestTransport = () => {
    if (["system_admin", "ops_manager"].includes(currentUser?.role)) return true;
    if (currentUser?.role !== "farmer") return false;
    const farmer = byId(state.farmers, currentUser.farmerId);
    if (farmer?.type === "large_scale") return true;
    return farmerChairedGroups().some((group) => group.members.length >= 5);
};
const canUpdateTripStatus = () => ["system_admin", "ops_manager"].includes(currentUser?.role);
const canRecordPayments = () => ["system_admin", "ops_manager", "accountant"].includes(currentUser?.role);
const canRecordOffences = () => ["system_admin", "hr_manager", "ops_manager"].includes(currentUser?.role);
const roleViews = {
    system_admin: ["dashboard", "trips", "fleet", "farmers", "discipline", "users"],
    ops_manager: ["dashboard", "trips", "fleet", "farmers", "discipline"],
    accountant: ["dashboard", "trips", "fleet"],
    hr_manager: ["dashboard", "discipline"],
    driver: ["dashboard", "trips", "fleet", "discipline"],
    farmer: ["dashboard", "trips", "farmers"]
};

const canView = (viewName) => (roleViews[currentUser?.role] || ["dashboard"]).includes(viewName);
const staffRoles = ["system_admin", "ops_manager", "accountant", "hr_manager"];

const renderOptions = (select, items, labelFn, valueFn = (item) => item.id) => {
    select.innerHTML = items.map((item) => `<option value="${valueFn(item)}">${labelFn(item)}</option>`).join("");
};

const getCustomerName = (trip) => {
    if (trip.customerName) return trip.customerName;
    if (trip.farmerId) return byId(state.farmers, trip.farmerId)?.name || "Unknown farmer";
    return byId(state.groups, trip.groupId)?.name || "Unknown group";
};

const getDriverName = (id) => byId(state.drivers, id)?.name || "Unassigned";
const getLoaderName = (id) => byId(state.loaders, id)?.name || "Unknown loader";
const getVehicle = (id) => byId(state.vehicles, id);
const isPastTrip = (trip) => trip.status === "completed" || trip.tripDate <= today;
const tripLoadersText = (trip) => trip.loaders.map(getLoaderName).join(", ") || "No loaders assigned";
const groupChairId = (group) => Number(group?.chairId || Object.entries(group?.memberRoles || {}).find(([, role]) => role === "chair")?.[0] || 0);
const farmerChairedGroups = () => state.groups.filter((group) => groupChairId(group) === currentUser?.farmerId);
const tripPaymentTotal = (trip) => sum((trip.payments || []).map((payment) => payment.amount));
const tripBalance = (trip) => Math.max(tripCost(trip).total - tripPaymentTotal(trip), 0);
const paymentStatus = (trip) => {
    const paid = tripPaymentTotal(trip);
    const total = tripCost(trip).total;
    if (paid <= 0) return "unpaid";
    if (paid < total) return "partial";
    return "paid";
};
const dateRangesOverlap = (startA, endA, startB, endB) => startA <= endB && startB <= endA;
const activeTripConflicts = (trip, resourceType, resourceId) => {
    const pickup = el("tripDate")?.value || trip?.tripDate;
    const delivery = el("deliveryDate")?.value || trip?.deliveryDate || pickup;
    if (!pickup || !delivery) return false;
    return state.trips.some((item) => {
        if (item.status === "cancelled") return false;
        if (!dateRangesOverlap(pickup, delivery, item.tripDate, item.deliveryDate || item.tripDate)) return false;
        if (resourceType === "driver") return item.driverId === resourceId;
        if (resourceType === "vehicle") return item.vehicleId === resourceId;
        return item.loaders.includes(resourceId);
    });
};
const nextStatuses = (status) => ({
    scheduled: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [],
    cancelled: []
}[status] || []);

const setMessage = (node, text, tone = "") => {
    node.className = `form-message ${tone}`.trim();
    node.textContent = text;
};

const setRoleNotice = (node, text = "") => {
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("visible", Boolean(text));
};

const escapeAttr = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const renderMetrics = () => {
    el("driverPortal").classList.toggle("auth-hidden", currentUser?.role !== "driver");
    el("hrDashboard").classList.toggle("auth-hidden", currentUser?.role !== "hr_manager");
    el("defaultDashboard").classList.toggle("auth-hidden", ["driver", "hr_manager"].includes(currentUser?.role));
    if (el("demoBanner")) {
        el("demoBanner").classList.toggle("auth-hidden", ["driver", "hr_manager", "farmer"].includes(currentUser?.role));
    }
    if (currentUser?.role === "driver") renderDriverPortal();
    if (currentUser?.role === "hr_manager") renderHrDashboard();

    const outstanding = sum(state.trips.map((trip) => {
        const paid = sum(trip.payments.map((payment) => payment.amount));
        return Math.max(tripCost(trip).total - paid, 0);
    }));
    const availableVehicles = state.vehicles.filter((vehicle) => vehicle.status === "available").length;
    const activeDrivers = state.drivers.filter((driver) => driver.status === "active").length;
    const eligibleGroups = state.groups.filter((group) => group.members.length >= 5).length;

    el("metricGrid").innerHTML = [
        ["Scheduled trips", state.trips.filter((trip) => trip.status === "scheduled").length],
        ["Available vehicles", availableVehicles],
        ["Active drivers", activeDrivers],
        ["Balance due", money.format(outstanding)],
        ["Eligible groups", eligibleGroups]
    ].map(([label, value]) => `
        <article class="metric-card">
            <span>${label}</span>
            <strong>${value}</strong>
        </article>
    `).join("");
};

const renderHrDashboard = () => {
    const activeDrivers = state.drivers.filter((driver) => driver.status === "active").length;
    const suspendedDrivers = state.drivers.filter((driver) => driver.status === "suspended").length;
    const offenceTotal = state.offences.length;
    const warningTotal = state.warnings.length;
    const suspensionTotal = state.suspensions.length;
    const reviewTotal = state.reviews.length;

    el("hrMetricGrid").innerHTML = [
        ["Active drivers", activeDrivers],
        ["Suspended drivers", suspendedDrivers],
        ["Offences", offenceTotal],
        ["Warnings", warningTotal],
        ["Suspensions", suspensionTotal],
        ["Trip reviews", reviewTotal]
    ].map(([label, value]) => `
        <article class="metric-card">
            <span>${label}</span>
            <strong>${value}</strong>
        </article>
    `).join("");

    if (selectedHrDriverId && !byId(state.drivers, selectedHrDriverId)) {
        selectedHrDriverId = null;
    }

    el("hrDriverList").innerHTML = state.drivers.map((driver) => {
        const summary = getDiscipline(driver.id);
        const tone = driver.status === "active" ? "" : "danger";
        return `
            <button class="list-item list-button ${selectedHrDriverId === driver.id ? "selected" : ""}" data-hr-driver-id="${driver.id}" type="button">
                <div>
                    <strong>${driver.name}</strong>
                    <p>${driver.phone} - ${summary.offences.length} offences, ${summary.warnings.length} warnings, ${summary.suspensions.length} suspensions</p>
                </div>
                <span class="badge ${tone}">${statusText(driver.status)}</span>
            </button>
        `;
    }).join("");

    const offenceItems = state.offences.map((offence) => `
            <article class="list-item">
                <div>
                    <strong>${getDriverName(offence.driverId)}</strong>
                    <p>${offence.type} ${offence.tripId ? `on trip #${offence.tripId}` : ""}</p>
                </div>
                    <span class="badge warn">${money.format(offence.surcharge)}</span>
            </article>
        `);

    const reviewItems = state.reviews.map((review) => {
            const target = review.targetType === "driver"
                ? getDriverName(review.driverId)
                : getLoaderName(review.loaderId);
            return `
                <article class="list-item">
                    <div>
                        <strong>${target}</strong>
                        <p>Trip #${review.tripId} review - ${review.comment || "No comment"}</p>
                    </div>
                    <span class="badge">${review.rating}/5</span>
                </article>
            `;
        });

    el("hrOffenceSummary").textContent = `${offenceItems.length} offences`;
    el("hrOffenceList").innerHTML = offenceItems.join("") || renderEmptyState("No offences recorded", "Driver offences will appear here when HR or ops records them.", "!");
    el("hrReviewSummary").textContent = `${reviewItems.length} reviews`;
    el("hrReviewList").innerHTML = reviewItems.join("") || renderEmptyState("No trip reviews yet", "Farmer reviews for completed trips will show up here.", "★");
    renderHrDriverDetail();
};

const renderHrDriverDetail = () => {
    const driver = byId(state.drivers, selectedHrDriverId);
    el("hrDriverDetailPanel").classList.toggle("auth-hidden", !driver);
    if (!driver) {
        el("hrDriverDetail").innerHTML = "";
        return;
    }

    const summary = getDiscipline(driver.id);
    const reviews = state.reviews.filter((review) => review.driverId === driver.id);
    const trips = state.trips.filter((trip) => trip.driverId === driver.id);
    el("hrDriverDetail").innerHTML = `
        <div class="profile-grid compact">
            <div class="profile-field"><span>Name</span><strong>${driver.name}</strong></div>
            <div class="profile-field"><span>Status</span><strong>${statusText(driver.status)}</strong></div>
            <div class="profile-field"><span>Trips</span><strong>${trips.length}</strong></div>
            <div class="profile-field"><span>Reviews</span><strong>${reviews.length}</strong></div>
        </div>
        <div class="detail-section">
            <h4>Past offences</h4>
            <div class="stack-list">
                ${summary.offences.length ? summary.offences.map((offence) => `
                    <form class="list-item offence-edit-form" data-offence-id="${offence.id}">
                        <div>
                            <strong>${offence.offenceDate || "Offence"}</strong>
                            <p>${offence.tripId ? `Trip #${offence.tripId}` : "Not linked to a trip"}</p>
                        </div>
                        <label>
                            Type
                            <input name="type" type="text" value="${escapeAttr(offence.type)}" required>
                        </label>
                        <label>
                            Surcharge
                            <input name="surcharge" type="number" min="0" step="0.01" value="${offence.surcharge}">
                        </label>
                        <button class="primary-button" type="submit">Save</button>
                    </form>
                `).join("") : renderEmptyState("No offences for this driver", "Offence records will appear here after they are logged.", "!")}
            </div>
        </div>
        <div class="detail-section">
            <h4>Warnings and suspensions</h4>
            <div class="stack-list">
                ${[
                    ...summary.warnings.map((warning) => `
                        <article class="list-item">
                            <div><strong>Warning</strong><p>${warning.reason}</p></div>
                        </article>
                    `),
                    ...summary.suspensions.map((suspension) => `
                        <article class="list-item">
                            <div><strong>Suspension</strong><p>${suspension.startDate} to ${suspension.endDate} - ${suspension.reason}</p></div>
                        </article>
                    `)
                ].join("") || renderEmptyState("Clean record", "No warnings or suspensions on file for this driver.", "+")}
            </div>
        </div>
    `;
};

const renderDriverPortal = () => {
    const driver = byId(state.drivers, currentUser?.driverId);
    const vehicle = state.vehicles.find((item) => item.assignedDriverId === currentUser?.driverId);
    const trips = state.trips.filter((trip) => trip.driverId === currentUser?.driverId);
    const offences = state.offences.filter((offence) => offence.driverId === currentUser?.driverId);
    const warnings = state.warnings.filter((warning) => warning.driverId === currentUser?.driverId);
    const suspensions = state.suspensions.filter((suspension) => suspension.driverId === currentUser?.driverId);
    if (selectedDriverTripId && !trips.some((trip) => trip.id === selectedDriverTripId)) {
        selectedDriverTripId = null;
    }

    if (!driver) {
        el("driverProfileCard").innerHTML = renderEmptyState("No driver profile linked", "This account is not connected to a driver record.", "?");
        return;
    }

    el("driverProfileCard").innerHTML = [
        ["Name", driver.name],
        ["Phone", driver.phone],
        ["Status", statusText(driver.status)],
        ["Salary rate", money.format(driver.salaryRate)],
        ["Assigned trips", trips.length],
        ["Discipline records", offences.length + warnings.length + suspensions.length]
    ].map(([label, value]) => `
        <div class="profile-field">
            <span>${label}</span>
            <strong>${value}</strong>
        </div>
    `).join("");

    el("driverVehicleCard").innerHTML = vehicle ? `
        <article class="list-item">
            <div>
                <strong>${vehicle.plate}</strong>
                <p>${statusText(vehicle.type)} - ${vehicle.capacity.toLocaleString()} kg - ${vehicle.fuel}</p>
            </div>
            <span class="badge ${vehicle.status === "available" ? "" : "warn"}">${statusText(vehicle.status)}</span>
        </article>
    ` : renderEmptyState("No vehicle assigned", "Your assigned vehicle will appear here when one is linked to your driver profile.", "V");

    el("driverTripSummary").textContent = `${trips.length} assigned`;
    el("driverTripList").innerHTML = trips.length ? trips.map((trip) => `
        <button class="list-item list-button ${selectedDriverTripId === trip.id ? "selected" : ""}" data-driver-trip-id="${trip.id}" type="button">
                <div>
                    <strong>#${trip.id} ${trip.origin} to ${trip.destination}</strong>
                    <p>${getCustomerName(trip)} - ${tripDateRange(trip)}</p>
                    <p>${trip.cargoType}, ${trip.loadWeight.toLocaleString()} kg</p>
                </div>
            <span class="badge ${statusBadgeClass(trip.status)}">${statusText(trip.status)}</span>
        </button>
    `).join("") : renderEmptyState("No assigned trips", "Trips assigned to you will appear here once scheduled.", "→");
    renderDriverTripDetail();

    el("driverDisciplineSummary").textContent = `${offences.length} offences, ${warnings.length} warnings, ${suspensions.length} suspensions`;
    el("driverDisciplineList").innerHTML = [
        ...offences.map((offence) => `
            <article class="list-item">
                <div>
                    <strong>${offence.type}</strong>
                    <p>Trip ${offence.tripId ? `#${offence.tripId}` : "not linked"}</p>
                </div>
                <span class="badge warn">${money.format(offence.surcharge)}</span>
            </article>
        `),
        ...warnings.map((warning) => `
            <article class="list-item">
                <div>
                    <strong>Warning</strong>
                    <p>${warning.reason}</p>
                </div>
            </article>
        `),
        ...suspensions.map((suspension) => `
            <article class="list-item">
                <div>
                    <strong>Suspension</strong>
                    <p>${suspension.startDate} to ${suspension.endDate} - ${suspension.reason}</p>
                </div>
            </article>
        `)
    ].join("") || renderEmptyState("No discipline records", "Offences, warnings, and suspensions will appear here.", "!");

    renderOptions(el("serviceVehicleSelect"), state.vehicles, (item) => `${item.plate} - ${statusText(item.status)}`);
    el("serviceTripSelect").innerHTML = `<option value="">No related trip</option>` + trips.map((trip) => (
        `<option value="${trip.id}">#${trip.id} ${trip.origin} to ${trip.destination}</option>`
    )).join("");
};

const renderDriverTripDetail = () => {
    const trip = byId(state.trips, selectedDriverTripId);
    el("driverTripDetailPanel").classList.toggle("auth-hidden", !trip);
    if (!trip) {
        el("driverTripDetail").innerHTML = "";
        return;
    }

    const vehicle = getVehicle(trip.vehicleId);
    const costs = tripCost(trip);
    const paid = sum(trip.payments.map((payment) => payment.amount));
    const balance = Math.max(costs.total - paid, 0);
    const services = state.serviceRecords.filter((record) => record.tripId === trip.id || record.vehicleId === trip.vehicleId);
    const fuel = state.fuelRecords.filter((record) => record.tripId === trip.id);
    el("driverTripDetail").innerHTML = `
        <div class="profile-grid compact">
            <div class="profile-field"><span>Route</span><strong>${trip.origin} to ${trip.destination}</strong></div>
            <div class="profile-field"><span>Pickup</span><strong>${trip.tripDate}</strong></div>
            <div class="profile-field"><span>Delivery</span><strong>${trip.deliveryDate || trip.tripDate}</strong></div>
            <div class="profile-field"><span>Cargo</span><strong>${trip.cargoType}</strong></div>
            <div class="profile-field"><span>Load</span><strong>${trip.loadWeight.toLocaleString()} kg</strong></div>
            <div class="profile-field"><span>Vehicle</span><strong>${vehicle ? vehicle.plate : "Unassigned"}</strong></div>
            <div class="profile-field"><span>Loaders</span><strong>${tripLoadersText(trip)}</strong></div>
            <div class="profile-field"><span>Total</span><strong>${money.format(costs.total)}</strong></div>
            <div class="profile-field"><span>Balance</span><strong>${money.format(balance)}</strong></div>
        </div>
        <div class="detail-section">
            <h4>Vehicle records</h4>
            <div class="stack-list">
                ${[
                    ...fuel.map((record) => `
                        <article class="list-item">
                            <div><strong>Fuel</strong><p>${record.liters.toLocaleString()} L on ${record.fuelDate}</p></div>
                            <span class="badge warn">${money.format(record.cost)}</span>
                        </article>
                    `),
                    ...services.map((record) => `
                        <article class="list-item">
                            <div><strong>${record.description || "Service"}</strong><p>${record.serviceDate}</p></div>
                            <span class="badge warn">${money.format(record.cost)}</span>
                        </article>
                    `)
                ].join("") || renderEmptyState("No vehicle records", "Fuel and maintenance entries linked to this trip will show here.", "R")}
            </div>
        </div>
    `;
};

const renderTripTable = () => {
    const filter = el("tripStatusFilter").value;
    const trips = state.trips.filter((trip) => filter === "all" || trip.status === filter);
    if (!trips.length) {
        const detail = filter === "all"
            ? "Create a trip from the Trips tab to populate the manifest."
            : `No trips with status "${statusText(filter)}" right now. Try another filter.`;
        el("tripTable").innerHTML = `
            <tr class="table-empty">
                <td colspan="6">${renderEmptyState("No trips to show", detail, "→")}</td>
            </tr>
        `;
        return;
    }
    el("tripTable").innerHTML = trips.map((trip) => {
        const costs = tripCost(trip);
        return `
            <tr data-trip-id="${trip.id}">
                <td>#${trip.id}<br><span class="muted-label">${tripDateRange(trip)}</span></td>
                <td>${getCustomerName(trip)}</td>
                <td>${getDriverName(trip.driverId)}</td>
                <td>${trip.origin}<br><span class="muted-label">${trip.destination}</span></td>
                <td>${renderBadge(trip.status)}</td>
                <td>${money.format(costs.total)}</td>
            </tr>
        `;
    }).join("");
};

const renderRules = () => {
    const overloaded = state.trips.filter((trip) => trip.loadWeight > (getVehicle(trip.vehicleId)?.capacity || 0));
    const loaderless = state.trips.filter((trip) => trip.loaders.length === 0);
    const ineligibleGroups = state.groups.filter((group) => group.members.length < 5);
    const suspendedAssignments = state.trips.filter((trip) => byId(state.drivers, trip.driverId)?.status !== "active");
    const schedulingConflicts = state.trips.filter((trip, index) => state.trips.some((other, otherIndex) => {
        if (otherIndex <= index || trip.status === "cancelled" || other.status === "cancelled") return false;
        if (!dateRangesOverlap(trip.tripDate, trip.deliveryDate || trip.tripDate, other.tripDate, other.deliveryDate || other.tripDate)) return false;
        return trip.driverId === other.driverId
            || trip.vehicleId === other.vehicleId
            || trip.loaders.some((loaderId) => other.loaders.includes(loaderId));
    }));

    const rules = [
        { label: "Vehicle capacity", detail: overloaded.length ? `${overloaded.length} trips exceed capacity.` : "All scheduled loads fit selected vehicles.", tone: overloaded.length ? "danger" : "" },
        { label: "Loader requirement", detail: loaderless.length ? `${loaderless.length} trips need at least one loader.` : "Every trip has a loader assigned.", tone: loaderless.length ? "warn" : "" },
        { label: "Group eligibility", detail: ineligibleGroups.length ? `${ineligibleGroups.length} groups have fewer than 5 members.` : "All groups can request transport.", tone: ineligibleGroups.length ? "warn" : "" },
        { label: "Driver status", detail: suspendedAssignments.length ? `${suspendedAssignments.length} trips use inactive drivers.` : "Trips use active drivers only.", tone: suspendedAssignments.length ? "danger" : "" },
        { label: "Scheduling conflicts", detail: schedulingConflicts.length ? `${schedulingConflicts.length} trips overlap on driver, vehicle, or loader.` : "Active assignments do not overlap.", tone: schedulingConflicts.length ? "danger" : "" }
    ];

    el("ruleList").innerHTML = rules.map((rule) => `
        <div class="rule-item">
            <span class="rule-icon ${rule.tone}">${rule.tone === "danger" ? "!" : rule.tone === "warn" ? "?" : "+"}</span>
            <div>
                <strong>${rule.label}</strong>
                <p>${rule.detail}</p>
            </div>
        </div>
    `).join("");
};

const renderTripFormOptions = () => {
    const farmerAccount = currentUser?.role === "farmer";
    const farmerProfile = byId(state.farmers, currentUser?.farmerId);
    const chairGroups = farmerAccount ? farmerChairedGroups() : [];
    const eligibleChairGroups = chairGroups.filter((group) => group.members.length >= 5);
    const farmerRadio = document.querySelector("[name='customerType'][value='farmer']");
    const groupRadio = document.querySelector("[name='customerType'][value='group']");
    if (farmerAccount) {
        farmerRadio.disabled = farmerProfile?.type !== "large_scale";
        groupRadio.disabled = eligibleChairGroups.length === 0;
        if (farmerRadio.disabled && !groupRadio.disabled) {
            groupRadio.checked = true;
        } else if (!farmerRadio.disabled && groupRadio.disabled) {
            farmerRadio.checked = true;
        } else if (farmerRadio.disabled && groupRadio.disabled) {
            farmerRadio.checked = true;
        }
    } else {
        farmerRadio.disabled = false;
        groupRadio.disabled = false;
    }

    const customerType = document.querySelector("[name='customerType']:checked").value;
    const customers = farmerAccount
        ? customerType === "farmer"
            ? state.farmers.filter((farmer) => farmer.id === currentUser.farmerId && farmer.type === "large_scale")
            : eligibleChairGroups
        : customerType === "farmer"
        ? state.farmers.filter((farmer) => farmer.type === "large_scale")
        : state.groups;

    renderOptions(el("customerSelect"), customers, (item) => {
        if (customerType === "farmer") return `${item.name} (${statusText(item.type)})`;
        return `${item.name} (${item.members.length} members)`;
    });
    const availableVehicles = state.vehicles.filter((vehicle) => vehicle.status === "available" && !activeTripConflicts(null, "vehicle", vehicle.id));
    const activeDrivers = state.drivers.filter((driver) => driver.status === "active" && !activeTripConflicts(null, "driver", driver.id));
    const availableLoaders = state.loaders.filter((loader) => !activeTripConflicts(null, "loader", loader.id));

    renderOptions(
        el("vehicleSelect"),
        availableVehicles,
        (vehicle) => `${vehicle.plate} - ${statusText(vehicle.size)}, ${vehicle.capacity.toLocaleString()} kg, ${statusText(vehicle.status)}`
    );
    renderOptions(
        el("driverSelect"),
        activeDrivers,
        (driver) => `${driver.name} - ${statusText(driver.status)}`
    );
    renderOptions(el("loaderSelect"), availableLoaders, (loader) => `${loader.name} - ${money.format(loader.rate)}/hr`);
    renderOptions(el("offenceDriverSelect"), state.drivers, (driver) => `${driver.name} - ${statusText(driver.status)}`);
};

const renderWorkload = () => {
    const scheduled = state.trips.filter((trip) => trip.status === "scheduled");
    el("workloadCount").textContent = `${scheduled.length} scheduled`;
    el("workloadList").innerHTML = scheduled.length ? scheduled.map((trip) => {
        const vehicle = getVehicle(trip.vehicleId);
        return `
            <button class="list-item list-button ${selectedTripId === trip.id ? "selected" : ""}" data-trip-id="${trip.id}" type="button">
                <div>
                    <strong>#${trip.id} ${trip.cargoType}</strong>
                    <p>${trip.origin} to ${trip.destination}</p>
                    <p>${trip.loadWeight.toLocaleString()} kg on ${vehicle ? vehicle.plate : "unassigned vehicle"}</p>
                </div>
                <span class="badge">${tripDateRange(trip)}</span>
            </button>
        `;
    }).join("") : renderEmptyState("No scheduled trips", "Upcoming workload appears here when trips are scheduled.", "T");
};

const tripDetailMarkup = (trip) => {
    const vehicle = getVehicle(trip.vehicleId);
    const costs = tripCost(trip);
    const paid = tripPaymentTotal(trip);
    const balance = tripBalance(trip);
    const statusActions = canUpdateTripStatus() && nextStatuses(trip.status).length
        ? `
            <div class="detail-section">
                <h4>Status actions</h4>
                <div class="action-row">
                    ${nextStatuses(trip.status).map((status) => `
                        <button class="primary-button ${status === "cancelled" ? "danger-button" : ""}" data-trip-status="${status}" data-status-trip-id="${trip.id}" type="button">
                            ${statusText(status)}
                        </button>
                    `).join("")}
                </div>
                <div id="tripStatusMessage" class="form-message" aria-live="polite"></div>
            </div>
        `
        : "";
    const paymentForm = canRecordPayments() && trip.status !== "cancelled" && balance > 0
        ? `
            <form class="detail-section payment-form" data-payment-trip-id="${trip.id}">
                <h4>Record payment</h4>
                <div class="field-row">
                    <label>
                        Amount
                        <input name="amount" type="number" min="0.01" max="${balance}" step="0.01" value="${balance.toFixed(2)}" required>
                    </label>
                    <label>
                        Method
                        <select name="method" required>
                            <option value="cash">Cash</option>
                            <option value="mobile_money">Mobile money</option>
                            <option value="bank_transfer">Bank transfer</option>
                            <option value="card">Card</option>
                        </select>
                    </label>
                </div>
                <button class="primary-button" type="submit">Save payment</button>
                <div id="paymentMessage" class="form-message" aria-live="polite"></div>
            </form>
        `
        : "";
    const loaderManagement = canUpdateTripStatus()
        ? `
            <div class="detail-section">
                <h4>Loaders</h4>
                <p class="field-hint">Each trip must keep at least one loader.</p>
                <div class="stack-list">
                    ${trip.loaders.length ? trip.loaders.map((loaderId) => `
                        <article class="list-item">
                            <div><strong>${getLoaderName(loaderId)}</strong></div>
                            ${trip.loaders.length > 1
                                ? `<button class="ghost-button remove-loader-button" data-remove-loader-trip-id="${trip.id}" data-remove-loader-id="${loaderId}" type="button">Remove</button>`
                                : `<span class="badge">last loader</span>`}
                        </article>
                    `).join("") : renderEmptyState("No loaders assigned", "Loaders are assigned when the trip is created.", "L")}
                </div>
            </div>
        `
        : "";
    return `
        <div class="profile-grid compact">
            <div class="profile-field"><span>Customer</span><strong>${getCustomerName(trip)}</strong></div>
            <div class="profile-field"><span>Status</span>${renderBadge(trip.status)}</div>
            <div class="profile-field"><span>Route</span><strong>${trip.origin} to ${trip.destination}</strong></div>
            <div class="profile-field"><span>Pickup</span><strong>${trip.tripDate}</strong></div>
            <div class="profile-field"><span>Delivery</span><strong>${trip.deliveryDate || trip.tripDate}</strong></div>
            <div class="profile-field"><span>Cargo</span><strong>${trip.cargoType}</strong></div>
            <div class="profile-field"><span>Load</span><strong>${trip.loadWeight.toLocaleString()} kg</strong></div>
            <div class="profile-field"><span>Driver</span><strong>${getDriverName(trip.driverId)}</strong></div>
            <div class="profile-field"><span>Vehicle</span><strong>${vehicle ? vehicle.plate : "Unassigned"}</strong></div>
            <div class="profile-field"><span>Loaders</span><strong>${tripLoadersText(trip)}</strong></div>
            <div class="profile-field"><span>Payment</span>${renderBadge(paymentStatus(trip))}</div>
            <div class="profile-field"><span>Paid</span><strong>${money.format(paid)}</strong></div>
            <div class="profile-field"><span>Balance</span><strong>${money.format(balance)}</strong></div>
        </div>
        <div class="cost-preview">
            <div><span>Transport</span><strong>${money.format(costs.transport)}</strong></div>
            <div><span>Tax</span><strong>${money.format(costs.tax)}</strong></div>
            <div><span>Total</span><strong>${money.format(costs.total)}</strong></div>
        </div>
        <p class="field-hint">${costs.source === "database" ? "Calculated and stored by the database (source of truth)." : "Estimate \u2014 the database recalculates this on submit."}</p>
        <div class="detail-section">
            <h4>Payments</h4>
            <div class="stack-list">
                ${trip.payments.length ? trip.payments.map((payment) => `
                    <article class="list-item">
                        <div><strong>${money.format(payment.amount)}</strong><p>${statusText(payment.method)}${payment.paymentDate ? ` on ${payment.paymentDate}` : ""}</p></div>
                    </article>
                `).join("") : renderEmptyState("No payments recorded", "Record a payment using the form below.", "$")}
            </div>
        </div>
        ${loaderManagement}
        ${statusActions}
        ${paymentForm}
    `;
};

const renderSelectedTripDetail = () => {
    const trip = byId(state.trips, selectedTripId);
    el("tripDetailPanel").classList.toggle("auth-hidden", !trip);
    if (!trip) {
        el("tripDetail").innerHTML = "";
        return;
    }
    el("tripDetail").innerHTML = tripDetailMarkup(trip);
};

const renderFleet = () => {
    const minCapacity = Number(el("capacityFilter").value) || 0;
    const vehicles = state.vehicles.filter((vehicle) => vehicle.capacity >= minCapacity);
    el("vehicleGrid").innerHTML = vehicles.length ? vehicles.map((vehicle) => {
        const driver = vehicle.assignedDriverId ? getDriverName(vehicle.assignedDriverId) : "No assigned driver";
        const badgeTone = vehicle.status === "available" ? "" : "warn";
        const fuelRecords = state.fuelRecords.filter((record) => record.vehicleId === vehicle.id);
        const serviceRecords = state.serviceRecords.filter((record) => record.vehicleId === vehicle.id);
        const fuelCost = sum(fuelRecords.map((record) => record.cost));
        const serviceCost = sum(serviceRecords.map((record) => record.cost));
        const totalCost = fuelCost + serviceCost;
        const latestFuel = fuelRecords[0];
        const latestService = serviceRecords[0];
        return `
            <article class="vehicle-card">
                <div>
                    <strong>${vehicle.plate}</strong>
                    <p>${statusText(vehicle.type)} assigned to ${driver}</p>
                </div>
                <div class="vehicle-meta">
                    <span class="badge ${badgeTone}">${statusText(vehicle.status)}</span>
                    <span class="badge">${statusText(vehicle.size)}</span>
                    <span class="badge">${vehicle.capacity.toLocaleString()} kg</span>
                    <span class="badge">${vehicle.fuel}</span>
                </div>
                <div class="cost-ledger">
                    <div>
                        <span>Fuel cost</span>
                        <strong>${money.format(fuelCost)}</strong>
                        <p>${latestFuel ? `${latestFuel.liters.toLocaleString()} L on ${latestFuel.fuelDate}` : "No fuel records"}</p>
                    </div>
                    <div>
                        <span>Maintenance</span>
                        <strong>${money.format(serviceCost)}</strong>
                        <p>${latestService ? `${latestService.description || "Service"} on ${latestService.serviceDate}` : "No service records"}</p>
                    </div>
                    <div>
                        <span>Total vehicle cost</span>
                        <strong>${money.format(totalCost)}</strong>
                        <p>${fuelRecords.length + serviceRecords.length} cost records</p>
                    </div>
                </div>
            </article>
        `;
    }).join("") : renderEmptyState("No vehicles match this filter", "Lower the minimum load filter to see more vehicles.", "F");
    renderPayroll();
};

const renderPayroll = () => {
    const canSeePayroll = ["system_admin", "ops_manager", "accountant"].includes(currentUser?.role);
    el("payrollPanel").classList.toggle("auth-hidden", !canSeePayroll);
    if (!canSeePayroll) {
        el("driverPayList").innerHTML = "";
        el("loaderPayList").innerHTML = "";
        return;
    }

    el("driverPayList").innerHTML = state.drivers.map((driver) => {
        const assignedTrips = state.trips.filter((trip) => trip.driverId === driver.id);
        return `
            <article class="list-item">
                <div>
                    <strong>${driver.name}</strong>
                    <p>${assignedTrips.length} assigned trips - ${statusText(driver.status)}</p>
                </div>
                <div class="amount-stack">
                    <span>Salary rate</span>
                    <strong>${money.format(driver.salaryRate)}</strong>
                </div>
            </article>
        `;
    }).join("");

    el("loaderPayList").innerHTML = state.loaders.map((loader) => {
        const payments = state.loaderPayments.filter((payment) => payment.loaderId === loader.id);
        const totalPaid = sum(payments.map((payment) => payment.amount));
        return `
            <article class="list-item">
                <div>
                    <strong>${loader.name}</strong>
                    <p>${payments.length} trip payments recorded</p>
                </div>
                <div class="amount-stack">
                    <span>${money.format(loader.rate)} rate</span>
                    <strong>${money.format(totalPaid)}</strong>
                </div>
            </article>
        `;
    }).join("");
};

const renderFarmers = () => {
    const farmerAccount = currentUser?.role === "farmer";
    const directoryAllowed = ["system_admin", "ops_manager"].includes(currentUser?.role);
    el("farmerPortal").classList.toggle("auth-hidden", !farmerAccount);
    el("customerDirectory").classList.toggle("auth-hidden", farmerAccount || !directoryAllowed);

    if (farmerAccount) {
        renderFarmerPortal();
        return;
    }
    if (!directoryAllowed) {
        el("farmerList").innerHTML = "";
        el("groupList").innerHTML = "";
        return;
    }

    el("farmerList").innerHTML = state.farmers.length ? state.farmers.map((farmer) => `
        <article class="list-item">
            <div>
                <strong>${farmer.name}</strong>
                <p>${farmer.address}</p>
            </div>
            <span class="badge">${statusText(farmer.type)}</span>
        </article>
    `).join("") : renderEmptyState("No farmers found", "Farmer customer records will appear here.", "F");

    el("groupList").innerHTML = state.groups.length ? state.groups.map((group) => {
        const eligible = group.members.length >= 5;
        return `
            <article class="list-item">
                <div>
                    <strong>${group.name}</strong>
                    <p>${group.region} - ${group.members.length} members</p>
                </div>
                <span class="badge ${eligible ? "" : "warn"}">${eligible ? "eligible" : "needs members"}</span>
            </article>
        `;
    }).join("") : renderEmptyState("No farmer groups", "Small-scale farmers can create or join groups from the farmer portal.", "G");
};

const renderFarmerPortal = () => {
    const farmer = byId(state.farmers, currentUser?.farmerId);
    if (!farmer) {
        el("farmerProfileCard").innerHTML = renderEmptyState("No farmer profile linked", "This account is not connected to a farmer record.", "?");
        el("farmerPaymentSummary").textContent = "";
        el("farmerPaymentList").innerHTML = "";
        el("farmerTripList").innerHTML = "";
        el("smallScaleOnboardingPanel").classList.add("auth-hidden");
        return;
    }

    const trips = state.trips.filter((trip) => trip.farmerId === farmer.id || byId(state.groups, trip.groupId)?.members.includes(farmer.id));
    const totalDue = sum(trips.map((trip) => Math.max(tripCost(trip).total - sum(trip.payments.map((payment) => payment.amount)), 0)));
    const totalPaid = sum(trips.flatMap((trip) => trip.payments.map((payment) => payment.amount)));
    const groups = state.groups.filter((group) => group.members.includes(farmer.id));

    el("farmerProfileCard").innerHTML = [
        ["Name", farmer.name],
        ["Phone", farmer.phone],
        ["Address", farmer.address],
        ["Farmer type", statusText(farmer.type)],
        ["Groups", groups.length ? groups.map((group) => group.name).join(", ") : "None"],
        ["Balance due", money.format(totalDue)]
    ].map(([label, value]) => `
        <div class="profile-field">
            <span>${label}</span>
            <strong>${value}</strong>
        </div>
    `).join("");

    renderSmallScaleOnboarding(farmer, groups);

    el("farmerPaymentSummary").textContent = `${money.format(totalPaid)} paid`;
    el("farmerPaymentList").innerHTML = trips.length ? trips.map((trip) => {
        const costs = tripCost(trip);
        const paid = sum(trip.payments.map((payment) => payment.amount));
        const balance = Math.max(costs.total - paid, 0);
        const paymentText = trip.payments.length
            ? trip.payments.map((payment) => `${money.format(payment.amount)} via ${statusText(payment.method)}${payment.paymentDate ? ` on ${payment.paymentDate}` : ""}`).join("<br>")
            : "No payment recorded";
        return `
            <article class="list-item">
                <div>
                    <strong>Trip #${trip.id} ${trip.cargoType}</strong>
                    <p>${paymentText}</p>
                </div>
                <div class="amount-stack">
                    <span class="badge ${balance > 0 ? "warn" : ""}">${balance > 0 ? "balance due" : "paid"}</span>
                    <strong>${money.format(balance)}</strong>
                </div>
            </article>
        `;
    }).join("") : renderEmptyState("No trip payments yet", "Payment history appears here after trips are billed and paid.", "$");

    el("farmerTripList").innerHTML = trips.length ? trips.map((trip) => {
        const costs = tripCost(trip);
        return `
            <button class="list-item list-button ${selectedTripId === trip.id ? "selected" : ""}" data-trip-id="${trip.id}" type="button">
                <div>
                    <strong>#${trip.id} ${trip.origin} to ${trip.destination}</strong>
                    <p>${tripDateRange(trip)} - ${trip.cargoType}, ${trip.loadWeight.toLocaleString()} kg</p>
                    <p>${getDriverName(trip.driverId)} - ${money.format(costs.total)}</p>
                </div>
                <span class="badge ${statusBadgeClass(trip.status)}">${statusText(trip.status)}</span>
            </button>
        `;
    }).join("") : renderEmptyState("No trip requests yet", "Use Request trip to schedule your first transport.", "→");

    renderReviewFormOptions(trips);
    renderFarmerReviews(farmer.id);
};

const renderSmallScaleOnboarding = (farmer, memberGroups) => {
    const panel = el("smallScaleOnboardingPanel");
    const isSmallScale = farmer.type === "small_scale";
    panel.classList.toggle("auth-hidden", !isSmallScale);
    if (!isSmallScale) return;

    const chairGroups = memberGroups.filter((group) => groupChairId(group) === farmer.id);
    const eligibleChairGroups = chairGroups.filter((group) => group.members.length >= 5);
    const availableGroups = state.groups.filter((group) => !group.members.includes(farmer.id));
    el("groupOnboardingSummary").textContent = eligibleChairGroups.length
        ? "Eligible to request group transport"
        : "Join or form a group";

    const membershipItems = memberGroups.map((group) => {
        const chair = groupChairId(group) === farmer.id;
        const eligible = group.members.length >= 5;
        return `
            <article class="list-item">
                <div>
                    <strong>${group.name}</strong>
                    <p>${group.region} - ${group.members.length} members - ${chair ? "you are chair" : "member"}</p>
                </div>
                <span class="badge ${eligible ? "" : "warn"}">${eligible ? "eligible" : "needs members"}</span>
            </article>
        `;
    });
    const joinItems = availableGroups.map((group) => `
        <article class="list-item">
            <div>
                <strong>${group.name}</strong>
                <p>${group.region} - ${group.members.length} members</p>
            </div>
            <button class="primary-button" data-join-group-id="${group.id}" type="button">Join</button>
        </article>
    `);

    el("groupOnboardingList").innerHTML = [
        memberGroups.length ? `<p class="muted-label">Your groups</p>` : `<p class="muted-label">You are not in a farmer group yet.</p>`,
        ...membershipItems,
        availableGroups.length ? `<p class="muted-label">Available groups</p>` : `<p class="muted-label">No other groups are available to join.</p>`,
        ...joinItems
    ].join("");
};

const renderReviewFormOptions = (trips) => {
    // Reviews are only supported for individual-farmer trips. Group trips
    // (customer_group_id set, no customer_farmer_id) cannot be reviewed yet,
    // so they are excluded here and the farmer is told why.
    const reviewableTrips = trips.filter((trip) => isPastTrip(trip) && trip.farmerId != null);
    const blockedGroupTrips = trips.some((trip) => isPastTrip(trip) && trip.farmerId == null && trip.groupId != null);
    renderOptions(el("reviewTripSelect"), reviewableTrips, (trip) => `#${trip.id} ${trip.cargoType} - ${tripDateRange(trip)}`);
    const selectedTrip = byId(reviewableTrips, el("reviewTripSelect").value) || reviewableTrips[0];
    const targetType = el("reviewTargetType").value;
    el("reviewLoaderSelect").disabled = targetType !== "loader";
    const loaders = selectedTrip ? selectedTrip.loaders.map((loaderId) => byId(state.loaders, loaderId)).filter(Boolean) : [];
    renderOptions(el("reviewLoaderSelect"), loaders, (loader) => loader.name);
    el("tripReviewForm").classList.toggle("role-disabled", reviewableTrips.length === 0);
    el("tripReviewForm").querySelectorAll("select, input, button").forEach((field) => {
        field.disabled = reviewableTrips.length === 0 || (field.id === "reviewLoaderSelect" && targetType !== "loader");
    });
    if (reviewableTrips.length === 0) {
        const message = blockedGroupTrips
            ? "Reviews are currently available for individual farmer trips only."
            : "No past trips are available for review yet.";
        setMessage(el("reviewMessage"), message, "");
    } else {
        setMessage(el("reviewMessage"), "", "");
    }
};

const renderFarmerReviews = (farmerId) => {
    const reviews = state.reviews.filter((review) => review.farmerId === farmerId);
    el("farmerReviewSummary").textContent = `${reviews.length} submitted`;
    el("farmerReviewList").innerHTML = reviews.length ? reviews.map((review) => {
        const target = review.targetType === "driver"
            ? getDriverName(review.driverId)
            : getLoaderName(review.loaderId);
        return `
            <article class="list-item">
                <div>
                    <strong>Trip #${review.tripId} - ${target}</strong>
                    <p>${review.comment || "No comment"} ${review.reviewDate ? `- ${review.reviewDate}` : ""}</p>
                </div>
                <span class="badge">${review.rating}/5</span>
            </article>
        `;
    }).join("") : renderEmptyState("No reviews submitted yet", "Review a completed trip using the form above.", "★");
};

const getDiscipline = (driverId) => {
    const offences = state.offences.filter((offence) => offence.driverId === driverId);
    const warnings = state.warnings.filter((warning) => warning.driverId === driverId);
    const suspensions = state.suspensions.filter((suspension) => suspension.driverId === driverId);
    return { offences, warnings, suspensions };
};

const renderDiscipline = () => {
    el("disciplineList").innerHTML = state.drivers.length ? state.drivers.map((driver) => {
        const summary = getDiscipline(driver.id);
        const tone = driver.status === "active" ? "" : "danger";
        return `
            <article class="list-item">
                <div>
                    <strong>${driver.name}</strong>
                    <p>${summary.offences.length} offences, ${summary.warnings.length} warnings, ${summary.suspensions.length} suspensions</p>
                </div>
                <span class="badge ${tone}">${statusText(driver.status)}</span>
            </article>
        `;
    }).join("") : renderEmptyState("No drivers found", "Driver records will appear here when available.", "D");
};

const renderUsers = () => {
    const panel = el("usersView");
    if (!panel) return;
    const allowed = currentUser?.role === "system_admin";
    el("staffUserForm").classList.toggle("role-disabled", !allowed);
    el("staffUserForm").querySelectorAll("input, select, button").forEach((field) => {
        field.disabled = !allowed;
    });
    if (!allowed) {
        el("userSummary").textContent = "";
        el("userList").innerHTML = "";
        return;
    }

    el("userSummary").textContent = `${state.users.length} accounts`;
    el("userList").innerHTML = state.users.map((user) => {
        const linked = user.farmerId ? "farmer profile" : user.driverId ? "driver profile" : "staff account";
        const canEdit = !user.farmerId && !user.driverId && user.id !== currentUser?.id;
        return `
            <article class="list-item user-account">
                <div>
                    <strong>${user.username}</strong>
                    <p>${linked}</p>
                </div>
                ${canEdit ? `
                    <label class="inline-role">
                        Role
                        <select data-user-role-id="${user.id}">
                            ${staffRoles.map((role) => `
                                <option value="${role}" ${user.role === role ? "selected" : ""}>${statusText(role)}</option>
                            `).join("")}
                        </select>
                    </label>
                ` : `<span class="badge">${statusText(user.role)}</span>`}
            </article>
        `;
    }).join("") || renderEmptyState("No user accounts found", "Create staff users using the form on the right.", "U");
};

const updateCostPreview = () => {
    const trip = {
        distanceKm: Number(el("distanceInput").value),
        loadWeight: Number(el("weightInput").value),
        baseRate: state.config.baseRate
    };
    el("rateInput").value = state.config.baseRate;
    const costs = tripCost(trip);
    el("transportPreview").textContent = money.format(costs.transport);
    el("taxPreview").textContent = money.format(costs.tax);
    el("totalPreview").textContent = money.format(costs.total);
};

const setDefaultTripDates = () => {
    const pickupDate = minimumPickupDate();
    const deliveryDate = addDays(pickupDate, 1);
    el("tripDate").min = pickupDate;
    el("tripDate").value = pickupDate;
    el("deliveryDate").min = pickupDate;
    el("deliveryDate").value = deliveryDate;
};

const syncDeliveryDateMinimum = () => {
    const pickupDate = el("tripDate").value || minimumPickupDate();
    el("deliveryDate").min = pickupDate;
    if (!el("deliveryDate").value || el("deliveryDate").value < pickupDate) {
        el("deliveryDate").value = pickupDate;
    }
};

const validateTrip = (trip) => {
    if (!canRequestTransport()) return "Your role cannot create trip requests.";
    const vehicle = byId(state.vehicles, trip.vehicleId);
    const driver = byId(state.drivers, trip.driverId);
    const farmerProfile = byId(state.farmers, currentUser?.farmerId);

    if (!trip.farmerId && !trip.groupId) return "Choose a customer before scheduling a trip.";
    if (!trip.tripDate || !trip.deliveryDate) return "Choose pickup and delivery dates.";
    if (trip.tripDate < minimumPickupDate()) return "Pickup date must be at least 3 days from today.";
    if (trip.deliveryDate < trip.tripDate) return "Delivery date cannot be before pickup date.";
    if (currentUser?.role === "farmer" && trip.farmerId && farmerProfile?.type !== "large_scale") {
        return "Small-scale farmers must request transport through a farmer group.";
    }
    if (trip.groupId) {
        const group = byId(state.groups, trip.groupId);
        if (group.members.length < 5) return `${group.name} needs at least 5 members before requesting a trip.`;
        if (currentUser?.role === "farmer" && groupChairId(group) !== currentUser.farmerId) {
            return "Only the group chair can request transport for a farmer group.";
        }
    }
    if (!vehicle || vehicle.status !== "available") return "Vehicle must be available before trip assignment.";
    if (trip.loadWeight > vehicle.capacity) return "Trip load exceeds vehicle capacity.";
    if (!driver || driver.status !== "active") return "Driver must be active before trip assignment.";
    if (vehicle.assignedDriverId && vehicle.assignedDriverId !== driver.id) return "Trip driver must match the vehicle assigned driver.";
    if (trip.loaders.length === 0) return "A trip must have at least one loader before completion.";
    if (activeTripConflicts(trip, "driver", trip.driverId)) return "Driver is already assigned during those dates.";
    if (activeTripConflicts(trip, "vehicle", trip.vehicleId)) return "Vehicle is already assigned during those dates.";
    const busyLoader = trip.loaders.find((loaderId) => activeTripConflicts(trip, "loader", loaderId));
    if (busyLoader) return `${getLoaderName(busyLoader)} is already assigned during those dates.`;
    return "";
};

const handleTripSubmit = async (event) => {
    event.preventDefault();
    const customerType = document.querySelector("[name='customerType']:checked").value;
    const selectedLoaders = Array.from(el("loaderSelect").selectedOptions).map((option) => Number(option.value));
    const selectedGroup = customerType === "group" ? byId(state.groups, el("customerSelect").value) : null;
    const trip = {
        id: nextId(state.trips),
        vehicleId: Number(el("vehicleSelect").value),
        driverId: Number(el("driverSelect").value),
        farmerId: customerType === "farmer" ? Number(el("customerSelect").value) : null,
        groupId: customerType === "group" ? Number(el("customerSelect").value) : null,
        origin: el("originInput").value.trim(),
        destination: el("destinationInput").value.trim(),
        distanceKm: Number(el("distanceInput").value),
        tripDate: el("tripDate").value,
        deliveryDate: el("deliveryDate").value,
        cargoType: el("cargoInput").value.trim(),
        loadWeight: Number(el("weightInput").value),
        baseRate: state.config.baseRate,
        status: "scheduled",
        requestedByFarmerId: customerType === "group" ? groupChairId(selectedGroup) : currentUser?.role === "farmer" ? currentUser.farmerId : null,
        loaders: selectedLoaders,
        payments: []
    };

    const error = validateTrip(trip);
    if (error) {
        setMessage(el("tripFormMessage"), error, "error");
        return;
    }

    if (apiAvailable) {
        try {
            const payload = await withLoading("Scheduling trip...", () => apiRequest("/api/trips", {
                method: "POST",
                body: JSON.stringify({
                    vehicleId: trip.vehicleId,
                    driverId: trip.driverId,
                    farmerId: trip.farmerId,
                    groupId: trip.groupId,
                    requestedByFarmerId: trip.requestedByFarmerId,
                    origin: trip.origin,
                    destination: trip.destination,
                    distanceKm: trip.distanceKm,
                    tripDate: trip.tripDate,
                    deliveryDate: trip.deliveryDate,
                    cargoType: trip.cargoType,
                    loadWeight: trip.loadWeight,
                    baseRate: trip.baseRate,
                    loaders: trip.loaders
                })
            }));
            replaceState(payload.state);
            setMessage(el("tripFormMessage"), `Trip #${payload.tripId} saved to MySQL.`, "success");
            showToast("Trip scheduled", `Trip #${payload.tripId} was created successfully.`);
            event.target.reset();
            setDefaultTripDates();
            updateCostPreview();
        } catch (error) {
            setMessage(el("tripFormMessage"), error.message, "error");
        }
        return;
    }

    state.trips.push(trip);
    setMessage(el("tripFormMessage"), `Trip #${trip.id} scheduled in demo data.`, "success");
    showToast("Trip scheduled", `Trip #${trip.id} was created in demo data.`);
    event.target.reset();
    setDefaultTripDates();
    renderAll();
};

const handleOffenceSubmit = async (event) => {
    event.preventDefault();
    if (!canRecordOffences()) {
        setMessage(el("offenceMessage"), "Your role cannot record driver offences.", "error");
        return;
    }
    const driverId = Number(el("offenceDriverSelect").value);
    const offence = {
        id: nextId(state.offences),
        driverId,
        tripId: null,
        type: el("offenceTypeInput").value.trim(),
        surcharge: Number(el("surchargeInput").value) || 0
    };

    if (apiAvailable) {
        try {
            const payload = await withLoading("Saving offence...", () => apiRequest("/api/offences", {
                method: "POST",
                body: JSON.stringify(offence)
            }));
            replaceState(payload.state);
            setMessage(el("offenceMessage"), `Offence #${payload.offenceId} saved to MySQL.`, "success");
            showToast("Offence recorded", `Offence #${payload.offenceId} was saved.`);
            event.target.reset();
        } catch (error) {
            setMessage(el("offenceMessage"), error.message, "error");
        }
        return;
    }

    state.offences.push(offence);

    const surchargeCount = state.offences.filter((item) => item.driverId === driverId && item.surcharge > 0).length;
    const warningCount = state.warnings.filter((item) => item.driverId === driverId).length;
    if (surchargeCount >= 3 && warningCount === 0) {
        state.warnings.push({ id: state.warnings.length + 1, driverId, reason: "Automatic warning: 3 surcharge offences" });
        setMessage(el("offenceMessage"), "Offence saved. Automatic warning letter created.", "success");
    } else {
        setMessage(el("offenceMessage"), "Offence saved.", "success");
    }

    event.target.reset();
    renderAll();
};

const handleTripStatusUpdate = async (button) => {
    const tripId = Number(button.dataset.statusTripId);
    const status = button.dataset.tripStatus;
    if (!canUpdateTripStatus()) return;

    if (status === "cancelled") {
        const confirmed = await showConfirm({
            title: "Cancel this trip?",
            message: "This marks the trip as cancelled. Cancelled trips cannot accept payments and this status is final.",
            confirmLabel: "Cancel trip",
            danger: true
        });
        if (!confirmed) return;
    }

    if (apiAvailable) {
        try {
            const payload = await withLoading("Updating trip status...", () => apiRequest(`/api/trips/${tripId}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status })
            }));
            replaceState(payload.state);
            showToast("Trip updated", `Trip #${tripId} is now ${statusText(status)}.`);
        } catch (error) {
            showToast("Could not update trip", error.message, "error");
        }
        return;
    }

    const trip = byId(state.trips, tripId);
    if (!trip || !nextStatuses(trip.status).includes(status)) return;
    trip.status = status;
    const vehicle = getVehicle(trip.vehicleId);
    if (vehicle && status === "in_progress") vehicle.status = "in_transit";
    if (vehicle && ["completed", "cancelled"].includes(status)) vehicle.status = "available";
    showToast("Trip updated", `Trip #${tripId} is now ${statusText(status)}.`);
    renderAll();
};

const handleRemoveLoader = async (button) => {
    const tripId = Number(button.dataset.removeLoaderTripId);
    const loaderId = Number(button.dataset.removeLoaderId);
    const trip = byId(state.trips, tripId);
    if (!trip || !canUpdateTripStatus()) return;
    if (trip.loaders.length <= 1) {
        showToast("Cannot remove loader", "A trip must keep at least one loader.", "error");
        return;
    }

    const confirmed = await showConfirm({
        title: "Remove this loader?",
        message: `Remove ${getLoaderName(loaderId)} from trip #${tripId}? A trip must keep at least one loader.`,
        confirmLabel: "Remove loader",
        danger: true
    });
    if (!confirmed) return;

    if (apiAvailable) {
        try {
            const payload = await withLoading("Removing loader...", () => apiRequest(`/api/trips/${tripId}/loaders/${loaderId}`, {
                method: "DELETE"
            }));
            replaceState(payload.state);
            showToast("Loader removed", `${getLoaderName(loaderId)} was removed from trip #${tripId}.`);
        } catch (error) {
            showToast("Could not remove loader", error.message, "error");
        }
        return;
    }

    trip.loaders = trip.loaders.filter((id) => id !== loaderId);
    showToast("Loader removed", `${getLoaderName(loaderId)} was removed from trip #${tripId}.`);
    renderAll();
};

const handlePaymentSubmit = async (form) => {
    const tripId = Number(form.dataset.paymentTripId);
    const amount = Number(form.elements.amount.value) || 0;
    const method = form.elements.method.value;
    const trip = byId(state.trips, tripId);
    if (!canRecordPayments() || !trip) return;
    if (amount <= 0) {
        setMessage(el("paymentMessage"), "Payment amount must be greater than zero.", "error");
        return;
    }
    if (trip.status === "cancelled") {
        setMessage(el("paymentMessage"), "Cancelled trips cannot accept payments.", "error");
        return;
    }
    if (amount > tripBalance(trip)) {
        setMessage(el("paymentMessage"), `Payment exceeds the remaining balance of ${money.format(tripBalance(trip))}.`, "error");
        return;
    }

    if (apiAvailable) {
        try {
            const payload = await withLoading("Recording payment...", () => apiRequest("/api/payments", {
                method: "POST",
                body: JSON.stringify({ tripId, amount, method })
            }));
            replaceState(payload.state);
            showToast("Payment recorded", `${money.format(amount)} applied to trip #${tripId}.`);
        } catch (error) {
            setMessage(el("paymentMessage"), error.message, "error");
        }
        return;
    }

    trip.payments.push({
        id: nextId(trip.payments),
        amount,
        method,
        paymentDate: today
    });
    showToast("Payment recorded", `${money.format(amount)} applied to trip #${tripId}.`);
    renderAll();
};

const handleOffenceUpdate = async (form) => {
    const offenceId = Number(form.dataset.offenceId);
    const type = form.elements.type.value.trim();
    const surcharge = Number(form.elements.surcharge.value) || 0;
    if (!type) return;

    if (apiAvailable) {
        try {
            const payload = await withLoading("Updating offence...", () => apiRequest(`/api/offences/${offenceId}`, {
                method: "PATCH",
                body: JSON.stringify({ type, surcharge })
            }));
            replaceState(payload.state);
            showToast("Offence updated", "Changes were saved.");
        } catch (error) {
            showToast("Could not update offence", error.message, "error");
        }
        return;
    }

    const offence = byId(state.offences, offenceId);
    if (offence) {
        offence.type = type;
        offence.surcharge = surcharge;
        showToast("Offence updated", "Changes were saved in demo data.");
        renderAll();
    }
};

const handleServiceRecordSubmit = async (event) => {
    event.preventDefault();
    setMessage(el("serviceMessage"), "Saving maintenance record...", "");
    const serviceRecord = {
        vehicleId: Number(el("serviceVehicleSelect").value),
        tripId: el("serviceTripSelect").value ? Number(el("serviceTripSelect").value) : null,
        description: el("serviceDescriptionInput").value.trim(),
        serviceCost: Number(el("serviceCostInput").value) || 0
    };

    if (apiAvailable) {
        try {
            const payload = await withLoading("Saving maintenance record...", () => apiRequest("/api/service-records", {
                method: "POST",
                body: JSON.stringify(serviceRecord)
            }));
            replaceState(payload.state);
            setMessage(el("serviceMessage"), `Maintenance #${payload.serviceId} saved.`, "success");
            showToast("Maintenance saved", `Record #${payload.serviceId} was created.`);
            event.target.reset();
            el("serviceCostInput").value = 0;
        } catch (error) {
            setMessage(el("serviceMessage"), error.message, "error");
        }
        return;
    }

    state.serviceRecords.push({
        id: nextId(state.serviceRecords),
        ...serviceRecord,
        serviceDate: today,
        cost: serviceRecord.serviceCost
    });
    setMessage(el("serviceMessage"), "Maintenance saved in demo data.", "success");
    showToast("Maintenance saved", "Record added in demo data.");
    event.target.reset();
    renderAll();
};

const handleTripReviewSubmit = async (event) => {
    event.preventDefault();
    setMessage(el("reviewMessage"), "Saving review...", "");
    const targetType = el("reviewTargetType").value;
    const review = {
        tripId: Number(el("reviewTripSelect").value),
        targetType,
        loaderId: targetType === "loader" ? Number(el("reviewLoaderSelect").value) : null,
        rating: Number(el("reviewRatingSelect").value),
        comment: el("reviewCommentInput").value.trim()
    };

    if (apiAvailable) {
        try {
            const payload = await withLoading("Submitting review...", () => apiRequest("/api/reviews", {
                method: "POST",
                body: JSON.stringify(review)
            }));
            replaceState(payload.state);
            setMessage(el("reviewMessage"), `Review #${payload.reviewId} saved.`, "success");
            showToast("Review submitted", "Thank you for your feedback.");
            event.target.reset();
            renderAll();
        } catch (error) {
            setMessage(el("reviewMessage"), error.message, "error");
        }
        return;
    }

    state.reviews.push({
        id: nextId(state.reviews),
        farmerId: currentUser?.farmerId,
        driverId: targetType === "driver" ? byId(state.trips, review.tripId)?.driverId : null,
        reviewDate: today,
        ...review
    });
    setMessage(el("reviewMessage"), "Review saved in demo data.", "success");
    showToast("Review submitted", "Saved in demo data.");
    event.target.reset();
    renderAll();
};

const handleGroupCreateSubmit = async (event) => {
    event.preventDefault();
    const farmer = byId(state.farmers, currentUser?.farmerId);
    if (farmer?.type !== "small_scale") {
        setMessage(el("groupMessage"), "Only small-scale farmers can create farmer groups.", "error");
        return;
    }
    const group = {
        name: el("groupNameInput").value.trim(),
        region: el("groupRegionInput").value.trim()
    };
    if (!group.name || !group.region) {
        setMessage(el("groupMessage"), "Group name and region are required.", "error");
        return;
    }

    if (apiAvailable) {
        try {
            const payload = await withLoading("Creating group...", () => apiRequest("/api/groups", {
                method: "POST",
                body: JSON.stringify(group)
            }));
            replaceState(payload.state);
            setMessage(el("groupMessage"), `Group #${payload.groupId} created.`, "success");
            showToast("Group created", "You are now the group chair.");
            event.target.reset();
        } catch (error) {
            setMessage(el("groupMessage"), error.message, "error");
        }
        return;
    }

    state.groups.push({
        id: nextId(state.groups),
        name: group.name,
        region: group.region,
        members: [farmer.id],
        chairId: farmer.id,
        memberRoles: { [String(farmer.id)]: "chair" }
    });
    setMessage(el("groupMessage"), "Group created in demo data.", "success");
    showToast("Group created", "You are now the group chair.");
    event.target.reset();
    renderAll();
};

const handleGroupJoin = async (button) => {
    const farmer = byId(state.farmers, currentUser?.farmerId);
    const groupId = Number(button.dataset.joinGroupId);
    const group = byId(state.groups, groupId);
    if (farmer?.type !== "small_scale" || !group) return;

    if (apiAvailable) {
        try {
            const payload = await withLoading("Joining group...", () => apiRequest(`/api/groups/${groupId}/join`, {
                method: "POST",
                body: JSON.stringify({})
            }));
            replaceState(payload.state);
            setMessage(el("groupMessage"), `Joined ${group.name}.`, "success");
            showToast("Joined group", `You are now a member of ${group.name}.`);
        } catch (error) {
            setMessage(el("groupMessage"), error.message, "error");
        }
        return;
    }

    if (group.members.includes(farmer.id)) {
        setMessage(el("groupMessage"), "You are already a member of this group.", "error");
        return;
    }
    group.members.push(farmer.id);
    group.memberRoles = { ...(group.memberRoles || {}), [String(farmer.id)]: "member" };
    setMessage(el("groupMessage"), `Joined ${group.name} in demo data.`, "success");
    showToast("Joined group", `You are now a member of ${group.name}.`);
    renderAll();
};

const handleStaffUserSubmit = async (event) => {
    event.preventDefault();
    if (currentUser?.role !== "system_admin") {
        setMessage(el("staffUserMessage"), "Only system admins can create staff users.", "error");
        return;
    }

    const staffUser = {
        username: el("staffUsernameInput").value.trim(),
        password: el("staffPasswordInput").value,
        role: el("staffRoleSelect").value
    };
    if (!staffUser.username || !staffUser.password || !staffUser.role) {
        setMessage(el("staffUserMessage"), "Username, password, and role are required.", "error");
        return;
    }
    if (staffUser.password.length < 6) {
        setMessage(el("staffUserMessage"), "Password must be at least 6 characters.", "error");
        return;
    }

    if (apiAvailable) {
        try {
            const payload = await withLoading("Creating user...", () => apiRequest("/api/users/staff", {
                method: "POST",
                body: JSON.stringify(staffUser)
            }));
            replaceState(payload.state);
            setMessage(el("staffUserMessage"), `User #${payload.userId} created.`, "success");
            showToast("Staff user created", `${staffUser.username} can now sign in.`);
            event.target.reset();
        } catch (error) {
            setMessage(el("staffUserMessage"), error.message, "error");
        }
        return;
    }

    if (state.users.some((user) => user.username === staffUser.username)) {
        setMessage(el("staffUserMessage"), "Username is already taken.", "error");
        return;
    }
    state.users.push({
        id: nextId(state.users),
        username: staffUser.username,
        role: staffUser.role,
        farmerId: null,
        driverId: null
    });
    setMessage(el("staffUserMessage"), "Staff user created in demo data.", "success");
    event.target.reset();
    renderAll();
};

const handleUserRoleUpdate = async (select) => {
    const userId = Number(select.dataset.userRoleId);
    const role = select.value;
    const user = byId(state.users, userId);
    if (!user || currentUser?.role !== "system_admin") return;

    if (role !== user.role) {
        const confirmed = await showConfirm({
            title: "Change user role?",
            message: `Update ${user.username} from ${statusText(user.role)} to ${statusText(role)}?`,
            confirmLabel: "Update role"
        });
        if (!confirmed) {
            select.value = user.role;
            return;
        }
    } else {
        return;
    }

    if (apiAvailable) {
        try {
            const payload = await withLoading("Updating role...", () => apiRequest(`/api/users/${userId}/role`, {
                method: "PATCH",
                body: JSON.stringify({ role })
            }));
            replaceState(payload.state);
            setMessage(el("staffUserMessage"), `Updated ${user.username}.`, "success");
            showToast("Role updated", `${user.username} is now ${statusText(role)}.`);
        } catch (error) {
            setMessage(el("staffUserMessage"), error.message, "error");
            select.value = user.role;
        }
        return;
    }

    user.role = role;
    setMessage(el("staffUserMessage"), `Updated ${user.username} in demo data.`, "success");
    showToast("Role updated", `${user.username} is now ${statusText(role)}.`);
    renderAll();
};

const switchView = (viewName) => {
    if (!canView(viewName)) viewName = "dashboard";
    document.querySelectorAll(".nav-tab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.view === viewName);
    });
    document.querySelectorAll(".view").forEach((view) => {
        const active = view.id === `${viewName}View`;
        view.classList.toggle("active", active);
        if (active) {
            el("viewTitle").textContent = view.dataset.title;
            if (el("viewSubtitle")) {
                el("viewSubtitle").textContent = viewSubtitles[viewName] || "";
            }
        }
    });
};

const applyRoleAccess = () => {
    const tripAllowed = canRequestTransport();
    const offenceAllowed = canRecordOffences();
    document.querySelectorAll(".nav-tab").forEach((tab) => {
        tab.classList.toggle("auth-hidden", !canView(tab.dataset.view));
    });
    const activeTab = document.querySelector(".nav-tab.active");
    if (activeTab && !canView(activeTab.dataset.view)) switchView("dashboard");
    el("tripForm").classList.toggle("role-disabled", !tripAllowed);
    el("offenceForm").classList.toggle("role-disabled", !offenceAllowed);
    el("tripForm").querySelectorAll("input, select, button").forEach((field) => {
        field.disabled = !tripAllowed;
    });
    el("offenceForm").querySelectorAll("input, select, button").forEach((field) => {
        field.disabled = !offenceAllowed;
    });
    document.querySelectorAll("[data-open-trip]").forEach((button) => {
        button.disabled = !tripAllowed;
        button.classList.toggle("auth-hidden", !tripAllowed);
    });
    if (!tripAllowed) {
        const message = currentUser?.role === "farmer"
            ? "Small-scale farmers must chair an eligible group (5+ members) before requesting transport."
            : "This role can view trips but cannot create new trip requests.";
        setRoleNotice(el("tripRoleNotice"), message);
    } else {
        setRoleNotice(el("tripRoleNotice"), "");
    }
    if (!offenceAllowed) {
        setRoleNotice(el("offenceRoleNotice"), "This role can view discipline data but cannot record offences.");
    } else {
        setRoleNotice(el("offenceRoleNotice"), "");
    }
};

const renderAll = () => {
    renderMetrics();
    renderTripTable();
    renderRules();
    renderTripFormOptions();
    renderWorkload();
    renderSelectedTripDetail();
    renderFleet();
    renderFarmers();
    renderDiscipline();
    renderUsers();
    updateCostPreview();
    if (currentUser) applyRoleAccess();
};

document.querySelectorAll(".nav-tab").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
});

document.querySelectorAll("[name='customerType']").forEach((input) => {
    input.addEventListener("change", renderTripFormOptions);
});

["distanceInput", "weightInput"].forEach((id) => {
    el(id).addEventListener("input", updateCostPreview);
});

el("tripDate").addEventListener("change", () => {
    syncDeliveryDateMinimum();
    renderTripFormOptions();
});
el("deliveryDate").addEventListener("change", renderTripFormOptions);
el("tripStatusFilter").addEventListener("change", renderTripTable);
el("capacityFilter").addEventListener("input", renderFleet);
el("tripForm").addEventListener("submit", handleTripSubmit);
el("offenceForm").addEventListener("submit", handleOffenceSubmit);
el("serviceRecordForm").addEventListener("submit", handleServiceRecordSubmit);
el("tripReviewForm").addEventListener("submit", handleTripReviewSubmit);
el("groupCreateForm").addEventListener("submit", handleGroupCreateSubmit);
el("staffUserForm").addEventListener("submit", handleStaffUserSubmit);
document.addEventListener("click", (event) => {
    const joinGroupButton = event.target.closest("[data-join-group-id]");
    if (joinGroupButton) {
        handleGroupJoin(joinGroupButton);
        return;
    }

    const removeLoaderButton = event.target.closest("[data-remove-loader-id]");
    if (removeLoaderButton) {
        handleRemoveLoader(removeLoaderButton);
        return;
    }

    const statusButton = event.target.closest("[data-trip-status]");
    if (statusButton) {
        handleTripStatusUpdate(statusButton);
        return;
    }

    const tripRow = event.target.closest("[data-trip-id]");
    if (tripRow && !event.target.closest("[data-driver-trip-id]")) {
        selectedTripId = Number(tripRow.dataset.tripId);
        switchView("trips");
        renderAll();
        return;
    }

    const driverTripButton = event.target.closest("[data-driver-trip-id]");
    if (driverTripButton) {
        selectedDriverTripId = Number(driverTripButton.dataset.driverTripId);
        renderDriverPortal();
        return;
    }

    const hrDriverButton = event.target.closest("[data-hr-driver-id]");
    if (hrDriverButton) {
        selectedHrDriverId = Number(hrDriverButton.dataset.hrDriverId);
        renderHrDashboard();
    }
});
document.addEventListener("submit", (event) => {
    const paymentForm = event.target.closest(".payment-form");
    if (paymentForm) {
        event.preventDefault();
        handlePaymentSubmit(paymentForm);
        return;
    }

    const offenceForm = event.target.closest(".offence-edit-form");
    if (!offenceForm) return;
    event.preventDefault();
    handleOffenceUpdate(offenceForm);
});
el("reviewTripSelect").addEventListener("change", () => {
    const farmer = byId(state.farmers, currentUser?.farmerId);
    if (!farmer) return;
    const trips = state.trips.filter((trip) => trip.farmerId === farmer.id || byId(state.groups, trip.groupId)?.members.includes(farmer.id));
    renderReviewFormOptions(trips);
});
el("reviewTargetType").addEventListener("change", () => {
    const farmer = byId(state.farmers, currentUser?.farmerId);
    if (!farmer) return;
    const trips = state.trips.filter((trip) => trip.farmerId === farmer.id || byId(state.groups, trip.groupId)?.members.includes(farmer.id));
    renderReviewFormOptions(trips);
});
document.addEventListener("change", (event) => {
    const roleSelect = event.target.closest("[data-user-role-id]");
    if (!roleSelect) return;
    handleUserRoleUpdate(roleSelect);
});
el("loginForm").addEventListener("submit", handleLogin);
el("farmerSignupForm").addEventListener("submit", handleFarmerSignup);
document.querySelectorAll("[name='authMode']").forEach((input) => {
    input.addEventListener("change", () => {
        const mode = document.querySelector("[name='authMode']:checked").value;
        el("loginForm").classList.toggle("auth-hidden", mode !== "login");
        el("farmerSignupForm").classList.toggle("auth-hidden", mode !== "signup");
        setMessage(el("loginMessage"), "", "");
        setMessage(el("signupMessage"), "", "");
    });
});
el("logoutButton").addEventListener("click", () => {
    clearSession();
    updateConnectionStatus();
    showLogin("Signed out.");
    showToast("Signed out", "Your session has ended.");
});
el("seedButton").addEventListener("click", async () => {
    if (apiAvailable) {
        await loadFromApi();
        showToast("Data refreshed", "Latest records loaded from the database.");
        return;
    }
    state = seedState();
    setMessage(el("tripFormMessage"), "Sample data reloaded.", "success");
    setMessage(el("offenceMessage"), "", "");
    showToast("Demo data reloaded", "Local sample data has been reset.");
    renderAll();
});
document.querySelectorAll("[data-open-trip]").forEach((button) => {
    button.addEventListener("click", () => switchView("trips"));
});

setDefaultTripDates();
el("originInput").value = "North Valley Farm";
el("destinationInput").value = "Central Market";
el("cargoInput").value = "Tomatoes";
el("weightInput").value = 1000;
el("distanceInput").value = 40;
el("rateInput").value = state.config.baseRate;

if (el("viewSubtitle")) {
    el("viewSubtitle").textContent = viewSubtitles.dashboard;
}

renderAll();
restoreSession();
updateConnectionStatus();
