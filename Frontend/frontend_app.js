const seedState = () => ({
    config: {
        baseRate: 0.75
    },
    farmers: [
        { id: 1, name: "Amina Mensah", phone: "555-0101", address: "North Valley Farm Road", type: "large_scale" },
        { id: 2, name: "Kwame Boateng", phone: "555-0102", address: "East Ridge Farm 12", type: "small_scale" },
        { id: 3, name: "Grace Njeri", phone: "555-0103", address: "Lakeview Plot 8", type: "small_scale" },
        { id: 4, name: "Samuel Okoro", phone: "555-0104", address: "Greenfield Plot 4", type: "small_scale" },
        { id: 5, name: "Fatima Diallo", phone: "555-0105", address: "Harvest Lane 2", type: "small_scale" },
        { id: 6, name: "Peter Moyo", phone: "555-0106", address: "Riverbend Plot 11", type: "small_scale" }
    ],
    groups: [
        { id: 1, name: "Riverbend Growers", region: "North Region", members: [2, 3, 4, 5, 6] }
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
            origin: "Riverbend Cooperative Store",
            destination: "Metro Retail Depot",
            distanceKm: 88,
            tripDate: "2026-02-03",
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
const today = "2026-05-26";

const el = (id) => document.getElementById(id);

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

const showLogin = (message = "") => {
    el("authScreen").classList.remove("auth-hidden");
    el("appShell").classList.add("auth-hidden");
    if (message) setMessage(el("loginMessage"), message, "error");
};

const showApp = () => {
    el("authScreen").classList.add("auth-hidden");
    el("appShell").classList.remove("auth-hidden");
    el("sidebarRole").textContent = `${statusText(currentUser.role)}: ${currentUser.username}`;
    applyRoleAccess();
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
        const payload = await apiRequest("/api/login", {
            method: "POST",
            body: JSON.stringify({
                username: el("usernameInput").value.trim(),
                password: el("passwordInput").value,
                role: el("roleInput").value
            })
        });
        saveSession(payload.token, payload.user);
        event.target.reset();
        setMessage(el("loginMessage"), "", "");
        showApp();
        await loadFromApi();
    } catch (error) {
        clearSession();
        showLogin(error.message);
    }
};

const handleFarmerSignup = async (event) => {
    event.preventDefault();
    setMessage(el("signupMessage"), "Creating farmer account...", "");
    try {
        const payload = await apiRequest("/api/signup/farmer", {
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
        });
        saveSession(payload.token, payload.user);
        event.target.reset();
        setMessage(el("signupMessage"), "", "");
        showApp();
        await loadFromApi();
    } catch (error) {
        setMessage(el("signupMessage"), error.message, "error");
    }
};

const restoreSession = async () => {
    if (!authToken) {
        showLogin();
        return;
    }
    try {
        const payload = await apiRequest("/api/me");
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
        return;
    }
    try {
        const payload = await apiRequest("/api/bootstrap");
        apiAvailable = true;
        replaceState(payload);
        setMessage(el("tripFormMessage"), "Connected to MySQL database.", "success");
    } catch (error) {
        apiAvailable = false;
        if (authToken) {
            setMessage(el("tripFormMessage"), error.message, "error");
        } else {
            showLogin(error.message);
        }
    }
};

const tripCost = (trip) => {
    const transport = roundMoney((trip.baseRate ?? state.config.baseRate) * trip.distanceKm * trip.loadWeight);
    const tax = roundMoney(transport * 0.2);
    return { transport, tax, total: roundMoney(transport + tax) };
};

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const sum = (values) => values.reduce((total, value) => total + value, 0);
const byId = (items, id) => items.find((item) => item.id === Number(id));
const nextId = (items) => items.length ? Math.max(...items.map((item) => item.id)) + 1 : 1;
const statusText = (value) => value.replaceAll("_", " ");
const canManageTrips = () => ["system_admin", "ops_manager", "farmer"].includes(currentUser?.role);
const canRecordOffences = () => ["system_admin", "hr_manager", "ops_manager"].includes(currentUser?.role);
const roleViews = {
    system_admin: ["dashboard", "trips", "fleet", "farmers", "discipline"],
    ops_manager: ["dashboard", "trips", "fleet", "farmers", "discipline"],
    accountant: ["dashboard", "trips", "fleet"],
    hr_manager: ["dashboard", "discipline"],
    driver: ["dashboard", "trips", "fleet", "discipline"],
    farmer: ["dashboard", "trips", "farmers"]
};

const canView = (viewName) => (roleViews[currentUser?.role] || ["dashboard"]).includes(viewName);

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

const setMessage = (node, text, tone = "") => {
    node.className = `form-message ${tone}`.trim();
    node.textContent = text;
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
    el("hrOffenceList").innerHTML = offenceItems.join("") || `<p class="muted-label">No offences recorded.</p>`;
    el("hrReviewSummary").textContent = `${reviewItems.length} reviews`;
    el("hrReviewList").innerHTML = reviewItems.join("") || `<p class="muted-label">No trip reviews submitted.</p>`;
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
                `).join("") : `<p class="muted-label">No offences recorded for this driver.</p>`}
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
                ].join("") || `<p class="muted-label">No warnings or suspensions recorded.</p>`}
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
        el("driverProfileCard").innerHTML = `<p class="muted-label">No driver profile is linked to this account.</p>`;
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
    ` : `<p class="muted-label">No vehicle is currently assigned.</p>`;

    el("driverTripSummary").textContent = `${trips.length} assigned`;
    el("driverTripList").innerHTML = trips.length ? trips.map((trip) => `
        <button class="list-item list-button ${selectedDriverTripId === trip.id ? "selected" : ""}" data-driver-trip-id="${trip.id}" type="button">
                <div>
                    <strong>#${trip.id} ${trip.origin} to ${trip.destination}</strong>
                    <p>${getCustomerName(trip)} - ${trip.tripDate}</p>
                    <p>${trip.cargoType}, ${trip.loadWeight.toLocaleString()} kg</p>
                </div>
            <span class="badge">${statusText(trip.status)}</span>
        </button>
    `).join("") : `<p class="muted-label">No assigned trips yet.</p>`;
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
    ].join("") || `<p class="muted-label">No discipline records.</p>`;

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
            <div class="profile-field"><span>Date</span><strong>${trip.tripDate}</strong></div>
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
                ].join("") || `<p class="muted-label">No vehicle records linked yet.</p>`}
            </div>
        </div>
    `;
};

const renderTripTable = () => {
    const filter = el("tripStatusFilter").value;
    const trips = state.trips.filter((trip) => filter === "all" || trip.status === filter);
    el("tripTable").innerHTML = trips.map((trip) => {
        const costs = tripCost(trip);
        return `
            <tr data-trip-id="${trip.id}">
                <td>#${trip.id}<br><span class="muted-label">${trip.tripDate}</span></td>
                <td>${getCustomerName(trip)}</td>
                <td>${getDriverName(trip.driverId)}</td>
                <td>${trip.origin}<br><span class="muted-label">${trip.destination}</span></td>
                <td><span class="badge">${statusText(trip.status)}</span></td>
                <td>${money.format(costs.total)}</td>
            </tr>
        `;
    }).join("");
};

const renderRules = () => {
    const overloaded = state.trips.filter((trip) => trip.loadWeight > getVehicle(trip.vehicleId).capacity);
    const loaderless = state.trips.filter((trip) => trip.loaders.length === 0);
    const ineligibleGroups = state.groups.filter((group) => group.members.length < 5);
    const suspendedAssignments = state.trips.filter((trip) => byId(state.drivers, trip.driverId).status !== "active");

    const rules = [
        { label: "Vehicle capacity", detail: overloaded.length ? `${overloaded.length} trips exceed capacity.` : "All scheduled loads fit selected vehicles.", tone: overloaded.length ? "danger" : "" },
        { label: "Loader requirement", detail: loaderless.length ? `${loaderless.length} trips need at least one loader.` : "Every trip has a loader assigned.", tone: loaderless.length ? "warn" : "" },
        { label: "Group eligibility", detail: ineligibleGroups.length ? `${ineligibleGroups.length} groups have fewer than 5 members.` : "All groups can request transport.", tone: ineligibleGroups.length ? "warn" : "" },
        { label: "Driver status", detail: suspendedAssignments.length ? `${suspendedAssignments.length} trips use inactive drivers.` : "Trips use active drivers only.", tone: suspendedAssignments.length ? "danger" : "" }
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
    if (farmerAccount) {
        document.querySelector("[name='customerType'][value='farmer']").checked = true;
    }
    document.querySelector("[name='customerType'][value='group']").disabled = farmerAccount;

    const customerType = document.querySelector("[name='customerType']:checked").value;
    const customers = farmerAccount
        ? state.farmers.filter((farmer) => farmer.id === currentUser.farmerId)
        : customerType === "farmer"
        ? state.farmers.filter((farmer) => farmer.type === "large_scale")
        : state.groups;

    renderOptions(el("customerSelect"), customers, (item) => {
        if (customerType === "farmer") return `${item.name} (${statusText(item.type)})`;
        return `${item.name} (${item.members.length} members)`;
    });
    renderOptions(
        el("vehicleSelect"),
        state.vehicles,
        (vehicle) => `${vehicle.plate} - ${statusText(vehicle.size)}, ${vehicle.capacity.toLocaleString()} kg, ${statusText(vehicle.status)}`
    );
    renderOptions(
        el("driverSelect"),
        state.drivers,
        (driver) => `${driver.name} - ${statusText(driver.status)}`
    );
    renderOptions(el("loaderSelect"), state.loaders, (loader) => `${loader.name} - ${money.format(loader.rate)}/hr`);
    renderOptions(el("offenceDriverSelect"), state.drivers, (driver) => `${driver.name} - ${statusText(driver.status)}`);
};

const renderWorkload = () => {
    const scheduled = state.trips.filter((trip) => trip.status === "scheduled");
    el("workloadCount").textContent = `${scheduled.length} scheduled`;
    el("workloadList").innerHTML = scheduled.map((trip) => {
        const vehicle = getVehicle(trip.vehicleId);
        return `
            <button class="list-item list-button ${selectedTripId === trip.id ? "selected" : ""}" data-trip-id="${trip.id}" type="button">
                <div>
                    <strong>#${trip.id} ${trip.cargoType}</strong>
                    <p>${trip.origin} to ${trip.destination}</p>
                    <p>${trip.loadWeight.toLocaleString()} kg on ${vehicle ? vehicle.plate : "unassigned vehicle"}</p>
                </div>
                <span class="badge">${trip.tripDate}</span>
            </button>
        `;
    }).join("");
};

const tripDetailMarkup = (trip) => {
    const vehicle = getVehicle(trip.vehicleId);
    const costs = tripCost(trip);
    const paid = sum(trip.payments.map((payment) => payment.amount));
    const balance = Math.max(costs.total - paid, 0);
    return `
        <div class="profile-grid compact">
            <div class="profile-field"><span>Customer</span><strong>${getCustomerName(trip)}</strong></div>
            <div class="profile-field"><span>Status</span><strong>${statusText(trip.status)}</strong></div>
            <div class="profile-field"><span>Route</span><strong>${trip.origin} to ${trip.destination}</strong></div>
            <div class="profile-field"><span>Date</span><strong>${trip.tripDate}</strong></div>
            <div class="profile-field"><span>Cargo</span><strong>${trip.cargoType}</strong></div>
            <div class="profile-field"><span>Load</span><strong>${trip.loadWeight.toLocaleString()} kg</strong></div>
            <div class="profile-field"><span>Driver</span><strong>${getDriverName(trip.driverId)}</strong></div>
            <div class="profile-field"><span>Vehicle</span><strong>${vehicle ? vehicle.plate : "Unassigned"}</strong></div>
            <div class="profile-field"><span>Loaders</span><strong>${tripLoadersText(trip)}</strong></div>
            <div class="profile-field"><span>Balance</span><strong>${money.format(balance)}</strong></div>
        </div>
        <div class="cost-preview">
            <div><span>Transport</span><strong>${money.format(costs.transport)}</strong></div>
            <div><span>Tax</span><strong>${money.format(costs.tax)}</strong></div>
            <div><span>Total</span><strong>${money.format(costs.total)}</strong></div>
        </div>
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
    el("vehicleGrid").innerHTML = vehicles.map((vehicle) => {
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
    }).join("");
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

    el("farmerList").innerHTML = state.farmers.map((farmer) => `
        <article class="list-item">
            <div>
                <strong>${farmer.name}</strong>
                <p>${farmer.address}</p>
            </div>
            <span class="badge">${statusText(farmer.type)}</span>
        </article>
    `).join("");

    el("groupList").innerHTML = state.groups.map((group) => {
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
    }).join("");
};

const renderFarmerPortal = () => {
    const farmer = byId(state.farmers, currentUser?.farmerId);
    if (!farmer) {
        el("farmerProfileCard").innerHTML = `<p class="muted-label">No farmer profile is linked to this account.</p>`;
        el("farmerPaymentSummary").textContent = "";
        el("farmerPaymentList").innerHTML = "";
        el("farmerTripList").innerHTML = "";
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
    }).join("") : `<p class="muted-label">No trip payments yet.</p>`;

    el("farmerTripList").innerHTML = trips.length ? trips.map((trip) => {
        const costs = tripCost(trip);
        return `
            <button class="list-item list-button ${selectedTripId === trip.id ? "selected" : ""}" data-trip-id="${trip.id}" type="button">
                <div>
                    <strong>#${trip.id} ${trip.origin} to ${trip.destination}</strong>
                    <p>${trip.tripDate} - ${trip.cargoType}, ${trip.loadWeight.toLocaleString()} kg</p>
                    <p>${getDriverName(trip.driverId)} - ${money.format(costs.total)}</p>
                </div>
                <span class="badge">${statusText(trip.status)}</span>
            </button>
        `;
    }).join("") : `<p class="muted-label">No trip requests yet.</p>`;

    renderReviewFormOptions(trips);
    renderFarmerReviews(farmer.id);
};

const renderReviewFormOptions = (trips) => {
    const reviewableTrips = trips.filter(isPastTrip);
    renderOptions(el("reviewTripSelect"), reviewableTrips, (trip) => `#${trip.id} ${trip.cargoType} - ${trip.tripDate}`);
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
        setMessage(el("reviewMessage"), "No past trips are available for review yet.", "error");
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
    }).join("") : `<p class="muted-label">No reviews submitted yet.</p>`;
};

const getDiscipline = (driverId) => {
    const offences = state.offences.filter((offence) => offence.driverId === driverId);
    const warnings = state.warnings.filter((warning) => warning.driverId === driverId);
    const suspensions = state.suspensions.filter((suspension) => suspension.driverId === driverId);
    return { offences, warnings, suspensions };
};

const renderDiscipline = () => {
    el("disciplineList").innerHTML = state.drivers.map((driver) => {
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
    }).join("");
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

const validateTrip = (trip) => {
    if (!canManageTrips()) return "Your role cannot create trip requests.";
    const vehicle = byId(state.vehicles, trip.vehicleId);
    const driver = byId(state.drivers, trip.driverId);

    if (trip.groupId) {
        const group = byId(state.groups, trip.groupId);
        if (group.members.length < 5) return `${group.name} needs at least 5 members before requesting a trip.`;
    }
    if (!vehicle || vehicle.status !== "available") return "Vehicle must be available before trip assignment.";
    if (trip.loadWeight > vehicle.capacity) return "Trip load exceeds vehicle capacity.";
    if (!driver || driver.status !== "active") return "Driver must be active before trip assignment.";
    if (vehicle.assignedDriverId && vehicle.assignedDriverId !== driver.id) return "Trip driver must match the vehicle assigned driver.";
    if (trip.loaders.length === 0) return "A trip must have at least one loader before completion.";
    return "";
};

const handleTripSubmit = async (event) => {
    event.preventDefault();
    const customerType = document.querySelector("[name='customerType']:checked").value;
    const selectedLoaders = Array.from(el("loaderSelect").selectedOptions).map((option) => Number(option.value));
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
        cargoType: el("cargoInput").value.trim(),
        loadWeight: Number(el("weightInput").value),
        baseRate: state.config.baseRate,
        status: "scheduled",
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
            const payload = await apiRequest("/api/trips", {
                method: "POST",
                body: JSON.stringify({
                    vehicleId: trip.vehicleId,
                    driverId: trip.driverId,
                    farmerId: trip.farmerId,
                    groupId: trip.groupId,
                    origin: trip.origin,
                    destination: trip.destination,
                    distanceKm: trip.distanceKm,
                    tripDate: trip.tripDate,
                    cargoType: trip.cargoType,
                    loadWeight: trip.loadWeight,
                    baseRate: trip.baseRate,
                    loaders: trip.loaders
                })
            });
            replaceState(payload.state);
            setMessage(el("tripFormMessage"), `Trip #${payload.tripId} saved to MySQL.`, "success");
            event.target.reset();
            el("tripDate").value = today;
            updateCostPreview();
        } catch (error) {
            setMessage(el("tripFormMessage"), error.message, "error");
        }
        return;
    }

    state.trips.push(trip);
    setMessage(el("tripFormMessage"), `Trip #${trip.id} scheduled in demo data.`, "success");
    event.target.reset();
    el("tripDate").value = today;
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
            const payload = await apiRequest("/api/offences", {
                method: "POST",
                body: JSON.stringify(offence)
            });
            replaceState(payload.state);
            setMessage(el("offenceMessage"), `Offence #${payload.offenceId} saved to MySQL.`, "success");
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

const handleOffenceUpdate = async (form) => {
    const offenceId = Number(form.dataset.offenceId);
    const type = form.elements.type.value.trim();
    const surcharge = Number(form.elements.surcharge.value) || 0;
    if (!type) return;

    if (apiAvailable) {
        try {
            const payload = await apiRequest(`/api/offences/${offenceId}`, {
                method: "PATCH",
                body: JSON.stringify({ type, surcharge })
            });
            replaceState(payload.state);
        } catch (error) {
            window.alert(error.message);
        }
        return;
    }

    const offence = byId(state.offences, offenceId);
    if (offence) {
        offence.type = type;
        offence.surcharge = surcharge;
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
            const payload = await apiRequest("/api/service-records", {
                method: "POST",
                body: JSON.stringify(serviceRecord)
            });
            replaceState(payload.state);
            setMessage(el("serviceMessage"), `Maintenance #${payload.serviceId} saved.`, "success");
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
            const payload = await apiRequest("/api/reviews", {
                method: "POST",
                body: JSON.stringify(review)
            });
            replaceState(payload.state);
            setMessage(el("reviewMessage"), `Review #${payload.reviewId} saved.`, "success");
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
    event.target.reset();
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
        if (active) el("viewTitle").textContent = view.dataset.title;
    });
};

const applyRoleAccess = () => {
    const tripAllowed = canManageTrips();
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
    });
    if (!tripAllowed) setMessage(el("tripFormMessage"), "This role can view trips but cannot create new trip requests.", "error");
    if (!offenceAllowed) setMessage(el("offenceMessage"), "This role can view discipline data but cannot record offences.", "error");
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

el("tripStatusFilter").addEventListener("change", renderTripTable);
el("capacityFilter").addEventListener("input", renderFleet);
el("tripForm").addEventListener("submit", handleTripSubmit);
el("offenceForm").addEventListener("submit", handleOffenceSubmit);
el("serviceRecordForm").addEventListener("submit", handleServiceRecordSubmit);
el("tripReviewForm").addEventListener("submit", handleTripReviewSubmit);
document.addEventListener("click", (event) => {
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
    showLogin("Signed out.");
});
el("seedButton").addEventListener("click", () => {
    if (apiAvailable) {
        loadFromApi();
        return;
    }
    state = seedState();
    setMessage(el("tripFormMessage"), "Sample data reloaded.", "success");
    setMessage(el("offenceMessage"), "", "");
    renderAll();
});
document.querySelectorAll("[data-open-trip]").forEach((button) => {
    button.addEventListener("click", () => switchView("trips"));
});

el("tripDate").value = today;
el("originInput").value = "North Valley Farm";
el("destinationInput").value = "Central Market";
el("cargoInput").value = "Tomatoes";
el("weightInput").value = 1000;
el("distanceInput").value = 40;
el("rateInput").value = state.config.baseRate;

renderAll();
restoreSession();
