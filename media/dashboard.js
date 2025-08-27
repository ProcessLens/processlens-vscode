"use strict";
(function () {
    const vscode = acquireVsCodeApi();
    let currentFilters = {
        projectId: "",
        command: "",
        success: "all",
        window: "all",
        deviceInstance: null,
    };
    let chart = null;
    let isLoadingData = false;
    let isCommandRunning = false;
    let runningTaskExecution = null;
    let lastData = {
        runs: [],
        perCommand: [],
        projects: [],
        commands: [],
        devices: [],
    };
    let timeFormat = "human";
    let commandTableSort = {
        column: "runs",
        direction: "desc",
    };
    let commandTablePage = 0;
    const COMMANDS_PER_PAGE = 10;
    let currentCommandData = [];
    let currentCommandFilter = null;
    let currentFailedFilter = false;
    let trendPeriodDays = 7;
    let selectedHeatmapDay = null;
    let previousFiltersState = null;
    let currentHeatmapYear = new Date().getFullYear();
    let visibleColumns = {
        command: true,
        runs: true,
        avgMs: true,
        medianMs: false,
        p95Ms: false,
        minMs: false,
        maxMs: false,
        successRate: true,
        trend: false,
        sparkline: false,
        totalTime: true,
        impact: true,
        timePerDay: false,
        projectedSavings: false,
        optimizationPotential: false,
    };
    function formatDuration(ms, format = timeFormat) {
        if (format === "raw") {
            return `${ms}ms`;
        }
        if (ms < 1000) {
            return `${ms}ms`;
        }
        else if (ms < 60000) {
            const seconds = (ms / 1000).toFixed(1);
            return `${seconds}s`;
        }
        else if (ms < 3600000) {
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
        }
        else {
            const hours = Math.floor(ms / 3600000);
            const minutes = Math.floor((ms % 3600000) / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            if (minutes > 0 && seconds > 0) {
                return `${hours}h ${minutes}m ${seconds}s`;
            }
            else if (minutes > 0) {
                return `${hours}h ${minutes}m`;
            }
            else {
                return `${hours}h`;
            }
        }
    }
    document.addEventListener("DOMContentLoaded", function () {
        setupEventListeners();
        console.log("DOM loaded - checking global functions:", {
            sortCommandTable: typeof window.sortCommandTable,
            nextCommandPage: typeof window.nextCommandPage,
            prevCommandPage: typeof window.prevCommandPage,
        });
    });
    function setupEventListeners() {
        setupMultiSelectDropdown("project", "All Projects");
        setupMultiSelectDropdown("command", "All Commands");
        setupMultiSelectDropdown("success", "All");
        setupMultiSelectDropdown("device", "All Devices");
        setupTimeRangeDropdown();
        setupDeviceTooltips();
        setupChartTabs();
        setupHeatmapYearNavigation();
        const timeFormatToggle = document.getElementById("timeFormatToggle");
        if (timeFormatToggle) {
            timeFormatToggle.addEventListener("change", function () {
                timeFormat = this.value;
                saveCurrentSettings();
                const lastData = vscode.getState();
                if (lastData && lastData.runs) {
                    renderData(lastData.runs, lastData.perCommand, lastData.projects, lastData.commands, lastData.devices);
                }
            });
        }
        const trendPeriodSelect = document.getElementById("trendPeriodSelect");
        if (trendPeriodSelect) {
            trendPeriodSelect.addEventListener("change", function () {
                trendPeriodDays = parseInt(this.value);
                console.log("Trend period changed to:", trendPeriodDays, "days");
                saveCurrentSettings();
                loadData();
            });
        }
        const clearFiltersBtn = document.getElementById("clearFiltersBtn");
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener("click", clearAllFilters);
        }
        const coffeeBtn = document.getElementById("coffeeBtn");
        if (coffeeBtn) {
            coffeeBtn.addEventListener("click", () => {
                vscode.postMessage({
                    type: "OPEN_COFFEE_LINK",
                });
            });
        }
        const exportDataBtn = document.getElementById("exportDataBtn");
        if (exportDataBtn) {
            exportDataBtn.addEventListener("click", exportData);
        }
        const exportProfileBtn = document.getElementById("exportProfileBtn");
        if (exportProfileBtn) {
            exportProfileBtn.addEventListener("click", exportProfile);
        }
        const importDataBtn = document.getElementById("importDataBtn");
        if (importDataBtn) {
            importDataBtn.addEventListener("click", importData);
        }
        const importProfileBtn = document.getElementById("importProfileBtn");
        if (importProfileBtn) {
            importProfileBtn.addEventListener("click", importProfile);
        }
        const cancelTaskBtn = document.getElementById("cancelTaskBtn");
        if (cancelTaskBtn) {
            cancelTaskBtn.addEventListener("click", cancelRunningTask);
        }
        const clearBtn = document.getElementById("clearBtn");
        if (clearBtn) {
            clearBtn.addEventListener("click", clearData);
        }
        document.addEventListener("click", function (event) {
            const target = event.target;
            if (!target)
                return;
            if (target.matches("th[data-sort]")) {
                const column = target.getAttribute("data-sort");
                console.log("Table header clicked:", column);
                if (column) {
                    window.sortCommandTable(column);
                }
                return;
            }
            if (target.matches(".play-btn")) {
                if (isCommandRunning) {
                    console.log("Command already running, ignoring play button click");
                    return;
                }
                const command = target.getAttribute("data-command");
                if (command) {
                    setCommandRunning(true);
                    window.runCommand(command);
                }
                return;
            }
            if (target.matches(".delete-run-btn")) {
                const runId = target.getAttribute("data-run-id");
                if (runId) {
                    deleteRun(runId);
                }
                return;
            }
            if (target.matches(".runs-count.clickable")) {
                const command = target.getAttribute("data-filter-command");
                if (command) {
                    window.filterByCommand(command);
                }
                return;
            }
            if (target.matches(".success-rate.clickable")) {
                const command = target.getAttribute("data-filter-failed");
                if (command) {
                    window.filterByFailed(command);
                }
                return;
            }
        });
        document.addEventListener("click", function (event) {
            const columnBtn = document.querySelector(".column-menu-btn");
            const columnMenu = document.querySelector(".column-menu");
            const target = event.target;
            if (!columnMenu || !target)
                return;
            if (target === columnBtn) {
                columnMenu.classList.toggle("element-hidden");
            }
            else if (!columnMenu.contains(target)) {
                columnMenu.classList.add("element-hidden");
            }
        });
        document.addEventListener("change", function (event) {
            const target = event.target;
            if (target && target.matches('.column-menu input[type="checkbox"]')) {
                const column = target.getAttribute("data-column");
                if (column && column in visibleColumns) {
                    visibleColumns[column] = target.checked;
                    updateColumnVisibility();
                    saveCurrentSettings();
                }
            }
        });
        const signinBtn = document.getElementById("signinBtn");
        if (signinBtn) {
            signinBtn.addEventListener("click", function (e) {
                e.preventDefault();
                const btn = e.target;
                const originalText = btn.textContent;
                btn.textContent = "Coming Soon!";
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 1500);
            });
        }
        function updateFilters() {
            currentFilters = {
                projectId: getMultiSelectValues("project"),
                command: getMultiSelectValues("command"),
                success: getMultiSelectValues("success"),
                window: currentFilters.window || "7d",
                customFrom: currentFilters.customFrom,
                customTo: currentFilters.customTo,
                deviceInstance: getMultiSelectDeviceInstances(),
            };
            saveCurrentSettings();
            if (selectedHeatmapDay && !isHeatmapFilterUpdate) {
                clearHeatmapSelection();
            }
            loadData();
        }
        let isHeatmapFilterUpdate = false;
        function clearHeatmapSelection() {
            selectedHeatmapDay = null;
            previousFiltersState = null;
            document.querySelectorAll(".heatmap-cell.selected").forEach((cell) => {
                cell.classList.remove("selected");
            });
        }
        function getMultiSelectValues(filterType) {
            const dropdown = document.getElementById(`${filterType}FilterDropdown`);
            if (!dropdown)
                return undefined;
            const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:checked');
            const allValues = Array.from(checkboxes)
                .map((cb) => cb.parentElement?.getAttribute("data-value"))
                .filter((value) => value !== null);
            const specificValues = allValues.filter(Boolean);
            console.log(`getMultiSelectValues for ${filterType}:`, {
                allValues,
                specificValues,
                hasAll: allValues.includes(""),
                hasSpecific: specificValues.length > 0,
            });
            if (allValues.includes("") || allValues.length === 0) {
                return undefined;
            }
            return specificValues.length > 0 ? specificValues : undefined;
        }
        function getMultiSelectDeviceInstances() {
            const dropdown = document.getElementById("deviceFilterDropdown");
            if (!dropdown)
                return undefined;
            const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:checked');
            const allValues = Array.from(checkboxes)
                .map((cb) => cb.parentElement?.getAttribute("data-value"))
                .filter((value) => value !== null);
            const specificValues = allValues.filter(Boolean);
            console.log(`getMultiSelectDeviceInstances:`, {
                allValues,
                specificValues,
                hasAll: allValues.includes(""),
            });
            if (allValues.includes("") || allValues.length === 0)
                return undefined;
            return specificValues
                .map((value) => parseDeviceInstance(value))
                .filter(Boolean);
        }
        function parseDeviceInstance(value) {
            if (!value)
                return null;
            const [deviceId, hardwareHash] = value.split("|");
            return deviceId && hardwareHash ? { deviceId, hardwareHash } : null;
        }
        function loadData() {
            if (isLoadingData) {
                console.log("loadData() called but already loading, skipping");
                return;
            }
            isLoadingData = true;
            console.log("Loading data with trend period:", trendPeriodDays, "days");
            vscode.postMessage({
                type: "LOAD",
                filters: currentFilters,
                trendPeriodDays: trendPeriodDays,
            });
        }
        function exportData() {
            vscode.postMessage({
                type: "EXPORT_DATA",
                filters: currentFilters,
            });
        }
        function exportProfile() {
            const profile = {
                name: `ProcessLens Profile ${new Date().toISOString().split("T")[0]}`,
                version: "1.0.0",
                created: new Date().toISOString(),
                createdBy: "ProcessLens VS Code Extension",
                config: {
                    visibleColumns: visibleColumns,
                    filters: currentFilters,
                    trendPeriodDays: trendPeriodDays,
                    timeFormat: timeFormat,
                    commandTableSort: commandTableSort,
                },
            };
            vscode.postMessage({
                type: "EXPORT_PROFILE",
                profile: profile,
            });
        }
        function importData() {
            vscode.postMessage({
                type: "IMPORT_DATA",
            });
        }
        function importProfile() {
            vscode.postMessage({
                type: "IMPORT_PROFILE",
            });
        }
        function saveCurrentSettings() {
            const currentState = vscode.getState();
            if (currentState) {
                currentState.settings = {
                    visibleColumns,
                    filters: currentFilters,
                    trendPeriodDays,
                    timeFormat,
                    commandTableSort,
                };
                vscode.setState(currentState);
            }
        }
        function restoreSettings(settings) {
            console.log("Restoring settings:", settings);
            if (settings.visibleColumns) {
                visibleColumns = { ...visibleColumns, ...settings.visibleColumns };
                Object.keys(settings.visibleColumns).forEach((column) => {
                    const checkbox = document.querySelector(`input[data-column="${column}"]`);
                    if (checkbox) {
                        checkbox.checked = settings.visibleColumns[column];
                    }
                });
            }
            if (settings.filters) {
                currentFilters = { ...currentFilters, ...settings.filters };
                restoreMultiSelectFilter("project", settings.filters.projectId, "All Projects");
                restoreMultiSelectFilter("command", settings.filters.command, "All Commands");
                restoreMultiSelectFilter("success", settings.filters.success, "All");
                restoreMultiSelectFilter("device", settings.filters.deviceInstance, "All Devices");
            }
            if (settings.trendPeriodDays) {
                trendPeriodDays = settings.trendPeriodDays;
                const trendSelect = document.getElementById("trendPeriodSelect");
                if (trendSelect) {
                    trendSelect.value = settings.trendPeriodDays.toString();
                }
            }
            if (settings.timeFormat) {
                timeFormat = settings.timeFormat;
                const formatSelect = document.getElementById("timeFormatToggle");
                if (formatSelect) {
                    formatSelect.value = settings.timeFormat;
                }
            }
            if (settings.commandTableSort) {
                commandTableSort = {
                    ...commandTableSort,
                    ...settings.commandTableSort,
                };
            }
        }
        function applyProfile(profile) {
            if (!profile || !profile.config)
                return;
            restoreSettings(profile.config);
            loadData();
        }
        function clearData() {
            vscode.postMessage({
                type: "CONFIRM_CLEAR_DATA",
            });
        }
        function clearAllFilters() {
            currentFilters = {
                projectId: "",
                command: "",
                success: "all",
                window: "all",
                deviceInstance: null,
            };
            const projectDisplay = document.getElementById("projectFilterDisplay");
            const commandDisplay = document.getElementById("commandFilterDisplay");
            const deviceDisplay = document.getElementById("deviceFilterDisplay");
            if (projectDisplay)
                projectDisplay.textContent = "All Projects";
            if (commandDisplay)
                commandDisplay.textContent = "All Commands";
            if (deviceDisplay)
                deviceDisplay.textContent = "All Devices";
            resetMultiSelectFilter("project", "All Projects");
            resetMultiSelectFilter("command", "All Commands");
            resetMultiSelectFilter("device", "All Devices");
            const successFilter = document.getElementById("successFilter");
            if (successFilter)
                successFilter.value = "all";
            currentFilters.window = "7d";
            const timeRangeDisplay = document.getElementById("timeRangeDisplay");
            if (timeRangeDisplay) {
                timeRangeDisplay.textContent = "Last 7 days";
                const dropdown = document.getElementById("timeRangeDropdown");
                if (dropdown) {
                    dropdown.querySelectorAll(".time-range-option").forEach((opt) => {
                        opt.removeAttribute("data-selected");
                    });
                    const defaultOption = dropdown.querySelector('[data-value="7d"]');
                    if (defaultOption) {
                        defaultOption.setAttribute("data-selected", "true");
                    }
                }
            }
            saveCurrentSettings();
            loadData();
        }
        function resetMultiSelectFilter(filterId, defaultText) {
            const dropdown = document.getElementById(`${filterId}FilterDropdown`);
            if (!dropdown)
                return;
            const allCheckbox = dropdown.querySelector(`#${filterId}-all`);
            const otherCheckboxes = dropdown.querySelectorAll(`input[type="checkbox"]:not(#${filterId}-all)`);
            if (allCheckbox)
                allCheckbox.checked = true;
            otherCheckboxes.forEach((cb) => (cb.checked = false));
        }
        function setupDeviceTooltips() {
            let tooltip = document.getElementById("device-tooltip");
            if (!tooltip) {
                tooltip = document.createElement("div");
                tooltip.id = "device-tooltip";
                tooltip.style.cssText = `
        position: absolute;
        background: var(--vscode-editorHoverWidget-background);
        color: var(--vscode-editorHoverWidget-foreground);
        border: 1px solid var(--vscode-editorHoverWidget-border);
        padding: 8px;
        border-radius: 3px;
        font-size: 12px;
        z-index: 1000;
        pointer-events: none;
        display: none;
        max-width: 300px;
        word-wrap: break-word;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      `;
                document.body.appendChild(tooltip);
            }
            document.addEventListener("mouseover", function (e) {
                const target = e.target;
                if (target && target.matches(".device-icon, .device-icon-small")) {
                    const tooltipText = target.getAttribute("data-tooltip");
                    if (tooltipText) {
                        tooltip.textContent = tooltipText;
                        tooltip.style.display = "block";
                        const rect = target.getBoundingClientRect();
                        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                        const isInRecentRuns = target.closest(".recent-runs") !== null;
                        if (isInRecentRuns) {
                            tooltip.style.left = "-9999px";
                            tooltip.style.top = rect.top + scrollTop - 5 + "px";
                            requestAnimationFrame(() => {
                                const tooltipWidth = tooltip.offsetWidth;
                                tooltip.style.left =
                                    rect.left + scrollLeft - tooltipWidth - 10 + "px";
                            });
                        }
                        else {
                            tooltip.style.left = rect.right + scrollLeft + 10 + "px";
                            tooltip.style.top = rect.top + scrollTop - 5 + "px";
                        }
                    }
                }
            });
            document.addEventListener("mouseout", function (e) {
                const target = e.target;
                if (target && target.matches(".device-icon, .device-icon-small")) {
                    tooltip.style.display = "none";
                }
            });
        }
        function setCommandRunning(running) {
            isCommandRunning = running;
            updatePlayButtonStates();
            updateCancelButtonState();
        }
        function updateCancelButtonState() {
            const cancelBtn = document.getElementById("cancelTaskBtn");
            if (cancelBtn) {
                if (isCommandRunning) {
                    cancelBtn.classList.remove("element-hidden");
                }
                else {
                    cancelBtn.classList.add("element-hidden");
                }
            }
        }
        function cancelRunningTask() {
            if (!isCommandRunning)
                return;
            vscode.postMessage({
                type: "CANCEL_TASK",
            });
        }
        function deleteRun(runId) {
            vscode.postMessage({
                type: "CONFIRM_DELETE_RUN",
                runId: runId,
            });
        }
        function updatePlayButtonStates() {
            const playButtons = document.querySelectorAll(".play-btn");
            playButtons.forEach((btn) => {
                const button = btn;
                if (isCommandRunning) {
                    button.disabled = true;
                    button.style.opacity = "0.5";
                    button.style.cursor = "not-allowed";
                    button.title = "A command is already running...";
                }
                else {
                    button.disabled = false;
                    button.style.opacity = "1";
                    button.style.cursor = "pointer";
                    button.title = "Run this command";
                }
            });
        }
        window.addEventListener("message", function (event) {
            const message = event.data;
            switch (message.type) {
                case "DATA":
                    renderData(message.runs, message.perCommand, message.projects, message.commands, message.devices);
                    break;
                case "UPDATED":
                    loadData();
                    break;
                case "COMMAND_STARTED":
                    setCommandRunning(true);
                    break;
                case "COMMAND_COMPLETED":
                    setCommandRunning(false);
                    break;
                case "DATA_CLEARED":
                    currentFilters = {
                        projectId: "",
                        command: "",
                        success: "all",
                        window: "all",
                        deviceInstance: null,
                    };
                    showEmptyState();
                    break;
                case "RUN_DELETED":
                    loadData();
                    break;
                case "PROFILE_IMPORTED":
                    applyProfile(message.profile);
                    break;
            }
        });
        function renderData(runs, perCommand, projects, commands, devices) {
            isLoadingData = false;
            commandTablePage = 0;
            lastData = {
                runs,
                perCommand,
                projects,
                commands,
                devices,
            };
            rerenderActiveChartTab();
            vscode.setState({
                runs,
                perCommand,
                projects,
                commands,
                devices,
                settings: {
                    visibleColumns,
                    filters: currentFilters,
                    trendPeriodDays,
                    timeFormat,
                    commandTableSort,
                },
            });
            updateFilterOptions("project", projects, "All Projects");
            updateFilterOptions("command", commands, "All Commands");
            updateFilterOptions("device", devices, "All Devices");
            const savedState = vscode.getState();
            const hasExistingFilters = savedState && savedState.settings && savedState.settings.filters;
            if (!currentFilters.projectId &&
                projects.length > 0 &&
                !hasExistingFilters) {
                const defaultProject = projects[0];
                setMultiSelectDefault("project", defaultProject.value, defaultProject.label);
                currentFilters.projectId = defaultProject.value;
                console.log("Set default project to:", defaultProject.label);
            }
            if (runs.length === 0) {
                showEmptyState(currentFilters);
                return;
            }
            document.querySelector(".loading")?.classList.add("element-hidden");
            document.querySelector(".empty-state")?.classList.add("element-hidden");
            document.querySelector(".cards")?.classList.remove("element-hidden");
            document
                .querySelector(".global-stats")
                ?.classList.remove("element-hidden");
            try {
                if (runs && runs.length > 0) {
                    renderChart(runs);
                }
                else {
                    const container = document.getElementById("durationChart")?.parentElement;
                    if (container) {
                        container.innerHTML =
                            '<div class="chart-message">No timing data to display</div>';
                    }
                }
            }
            catch (error) {
                const container = document.getElementById("durationChart")?.parentElement;
                if (container) {
                    container.innerHTML =
                        '<div class="chart-error">Chart failed to load. Try clearing data to reset.</div>';
                }
            }
            renderCommandTable(perCommand, runs);
            renderGlobalStats(runs, perCommand, projects, commands, devices);
            renderRecentRuns(runs.slice(-10));
            setDeviceIconColors();
        }
        function renderGlobalStats(runs, perCommand, projects, commands, devices) {
            const totalRuns = runs.length;
            const commandCount = perCommand.length;
            const successfulRuns = runs.filter((r) => r.success === true || r.exitCode === 0).length;
            const overallSuccess = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;
            const uniqueProjects = new Set(runs.map((r) => r.projectId)).size;
            const uniqueDevices = new Set(runs.map((r) => `${r.deviceId}|${r.hardwareHash}`)).size;
            const totalRunsEl = document.getElementById("totalRuns");
            if (totalRunsEl)
                totalRunsEl.textContent = totalRuns.toLocaleString();
            const commandCountEl = document.getElementById("commandCount");
            if (commandCountEl)
                commandCountEl.textContent = commandCount.toLocaleString();
            const overallSuccessEl = document.getElementById("overallSuccess");
            if (overallSuccessEl)
                overallSuccessEl.textContent = `${overallSuccess}%`;
            const activeProjectsEl = document.getElementById("activeProjects");
            if (activeProjectsEl)
                activeProjectsEl.textContent = uniqueProjects.toLocaleString();
            const activeDevicesEl = document.getElementById("activeDevices");
            if (activeDevicesEl)
                activeDevicesEl.textContent = uniqueDevices.toLocaleString();
        }
        function setupMultiSelectDropdown(filterType, allText) {
            const display = document.getElementById(`${filterType}FilterDisplay`);
            const dropdown = document.getElementById(`${filterType}FilterDropdown`);
            if (!display || !dropdown)
                return;
            display.addEventListener("click", function (e) {
                e.stopPropagation();
                document.querySelectorAll(".multi-select-dropdown").forEach((dd) => {
                    if (dd !== dropdown)
                        dd.classList.add("element-hidden");
                });
                dropdown.classList.toggle("element-hidden");
            });
            dropdown.addEventListener("change", function (e) {
                const target = e.target;
                if (target && target.type === "checkbox") {
                    console.log(`Checkbox change detected for ${filterType}:`, target.id, target.checked);
                    handleMultiSelectChange(filterType, allText);
                }
            });
            dropdown.addEventListener("click", function (e) {
                e.stopPropagation();
                const target = e.target;
                let checkbox = null;
                if (target.tagName === "INPUT" && target.type === "checkbox") {
                    return;
                }
                else if (target.tagName === "LABEL") {
                    const forId = target.getAttribute("for");
                    if (forId) {
                        checkbox = document.getElementById(forId);
                    }
                }
                else if (target.classList.contains("multi-select-option")) {
                    checkbox = target.querySelector('input[type="checkbox"]');
                }
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    const changeEvent = new Event("change", { bubbles: true });
                    checkbox.dispatchEvent(changeEvent);
                }
            });
            if (!document.hasMultiSelectClickHandler) {
                document.addEventListener("click", function () {
                    document.querySelectorAll(".multi-select-dropdown").forEach((dd) => {
                        dd.classList.add("element-hidden");
                    });
                });
                document.hasMultiSelectClickHandler = true;
            }
        }
        function handleMultiSelectChange(filterType, allText) {
            const dropdown = document.getElementById(`${filterType}FilterDropdown`);
            const display = document.getElementById(`${filterType}FilterDisplay`);
            if (!dropdown || !display)
                return;
            const allCheckbox = dropdown.querySelector('input[type="checkbox"][id$="-all"]');
            const otherCheckboxes = dropdown.querySelectorAll('input[type="checkbox"]:not([id$="-all"])');
            const event = window.event ||
                arguments.callee.caller?.arguments?.[0];
            const target = event?.target;
            if (!target)
                return;
            console.log(`Multi-select change for ${filterType}:`, {
                target: target.id,
                checked: target.checked,
                isAll: target === allCheckbox,
                allCheckboxState: allCheckbox?.checked,
                otherCheckboxCount: Array.from(otherCheckboxes).filter((cb) => cb.checked).length,
            });
            let shouldUpdateFilters = true;
            if (target === allCheckbox) {
                if (allCheckbox.checked) {
                    otherCheckboxes.forEach((cb) => (cb.checked = false));
                    display.textContent = allText;
                }
                else {
                    allCheckbox.checked = true;
                    shouldUpdateFilters = false;
                    return;
                }
            }
            else {
                if (target.checked) {
                    if (allCheckbox)
                        allCheckbox.checked = false;
                }
                const checkedBoxes = Array.from(otherCheckboxes).filter((cb) => cb.checked);
                console.log(`Checked boxes count after change: ${checkedBoxes.length}`);
                if (checkedBoxes.length === 0) {
                    if (allCheckbox) {
                        allCheckbox.checked = true;
                        display.textContent = allText;
                    }
                }
                else if (checkedBoxes.length === 1) {
                    const label = checkedBoxes[0].nextElementSibling?.textContent;
                    display.textContent =
                        label && label.length > 25
                            ? label.substring(0, 25) + "..."
                            : label || "";
                }
                else {
                    display.textContent = `${checkedBoxes.length} selected`;
                }
            }
            if (shouldUpdateFilters) {
                console.log(`Updating filters for ${filterType}`);
                updateFilters();
            }
        }
        function updateFilterOptions(filterId, options, defaultText) {
            const dropdown = document.getElementById(`${filterId}FilterDropdown`);
            const display = document.getElementById(`${filterId}FilterDisplay`);
            if (!dropdown) {
                console.warn(`Dropdown not found for ${filterId}`);
                return;
            }
            console.log(`Updating filter options for ${filterId}:`, options.length, "options");
            const currentSelections = new Map();
            const existingCheckboxes = dropdown.querySelectorAll('input[type="checkbox"]');
            existingCheckboxes.forEach((cb) => {
                currentSelections.set(cb.id, cb.checked);
            });
            dropdown.innerHTML = "";
            const allOptionDiv = document.createElement("div");
            allOptionDiv.className = "multi-select-option";
            allOptionDiv.setAttribute("data-value", "");
            const allCheckbox = document.createElement("input");
            allCheckbox.type = "checkbox";
            allCheckbox.id = `${filterId}-all`;
            allCheckbox.checked = currentSelections.has(`${filterId}-all`)
                ? currentSelections.get(`${filterId}-all`)
                : true;
            const allLabel = document.createElement("label");
            allLabel.setAttribute("for", allCheckbox.id);
            allLabel.textContent = defaultText;
            allLabel.style.cursor = "pointer";
            allLabel.style.userSelect = "none";
            allOptionDiv.appendChild(allCheckbox);
            allOptionDiv.appendChild(allLabel);
            dropdown.appendChild(allOptionDiv);
            options.forEach((option) => {
                const optionDiv = document.createElement("div");
                optionDiv.className = "multi-select-option";
                optionDiv.setAttribute("data-value", option.value);
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.id = `${filterId}-${option.value}`;
                checkbox.checked = currentSelections.has(`${filterId}-${option.value}`)
                    ? currentSelections.get(`${filterId}-${option.value}`)
                    : false;
                const label = document.createElement("label");
                label.setAttribute("for", checkbox.id);
                label.textContent = option.label;
                label.style.cursor = "pointer";
                label.style.userSelect = "none";
                optionDiv.appendChild(checkbox);
                optionDiv.appendChild(label);
                dropdown.appendChild(optionDiv);
            });
            if (display) {
                const checkedSpecificBoxes = dropdown.querySelectorAll('input[type="checkbox"]:not([id$="-all"]):checked');
                const allCheckbox = dropdown.querySelector('input[id$="-all"]');
                if (allCheckbox &&
                    allCheckbox.checked &&
                    checkedSpecificBoxes.length === 0) {
                    display.textContent = defaultText;
                }
                else if (checkedSpecificBoxes.length === 1) {
                    const label = checkedSpecificBoxes[0].nextElementSibling?.textContent;
                    display.textContent =
                        label && label.length > 25
                            ? label.substring(0, 25) + "..."
                            : label || "";
                }
                else if (checkedSpecificBoxes.length > 1) {
                    display.textContent = `${checkedSpecificBoxes.length} selected`;
                }
                else {
                    display.textContent = defaultText;
                    if (allCheckbox)
                        allCheckbox.checked = true;
                }
                console.log(`updateFilterOptions for ${filterId}: display set to "${display.textContent}"`);
            }
        }
        function setMultiSelectDefault(filterType, value, label) {
            const dropdown = document.getElementById(`${filterType}FilterDropdown`);
            const display = document.getElementById(`${filterType}FilterDisplay`);
            if (!dropdown || !display)
                return;
            const allCheckbox = dropdown.querySelector('input[type="checkbox"][id$="-all"]');
            if (allCheckbox)
                allCheckbox.checked = false;
            const targetCheckbox = dropdown.querySelector(`input[id="${filterType}-${value}"]`);
            if (targetCheckbox) {
                targetCheckbox.checked = true;
                display.textContent = label;
            }
        }
        function restoreMultiSelectFilter(filterType, filterValue, allText) {
            const dropdown = document.getElementById(`${filterType}FilterDropdown`);
            const display = document.getElementById(`${filterType}FilterDisplay`);
            if (!dropdown || !display)
                return;
            dropdown
                .querySelectorAll('input[type="checkbox"]')
                .forEach((cb) => (cb.checked = false));
            if (!filterValue ||
                (Array.isArray(filterValue) && filterValue.length === 0)) {
                const allCheckbox = dropdown.querySelector('input[type="checkbox"][id$="-all"]');
                if (allCheckbox)
                    allCheckbox.checked = true;
                display.textContent = allText;
            }
            else {
                const values = Array.isArray(filterValue) ? filterValue : [filterValue];
                let checkedCount = 0;
                values.forEach((value) => {
                    let checkboxId;
                    if (filterType === "device" && typeof value === "object") {
                        checkboxId = `${filterType}-${value.deviceId}|${value.hardwareHash}`;
                    }
                    else {
                        checkboxId = `${filterType}-${value}`;
                    }
                    const checkbox = dropdown.querySelector(`input[id="${checkboxId}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                        checkedCount++;
                    }
                });
                if (checkedCount === 1) {
                    const checkedCheckbox = dropdown.querySelector('input[type="checkbox"]:checked:not([id$="-all"])');
                    if (checkedCheckbox && checkedCheckbox.nextElementSibling) {
                        display.textContent =
                            checkedCheckbox.nextElementSibling.textContent;
                    }
                }
                else if (checkedCount > 1) {
                    display.textContent = `${checkedCount} selected`;
                }
                else {
                    const allCheckbox = dropdown.querySelector('input[type="checkbox"][id$="-all"]');
                    if (allCheckbox)
                        allCheckbox.checked = true;
                    display.textContent = allText;
                }
            }
        }
        function renderChart(runs) {
            if (typeof Chart === "undefined") {
                console.error("Chart.js is not available");
                return;
            }
            const canvas = document.getElementById("durationChart");
            if (!canvas) {
                console.error("Chart canvas not found");
                return;
            }
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                console.error("Chart context not available");
                return;
            }
            if (chart) {
                chart.destroy();
                chart = null;
            }
            if (!runs || !Array.isArray(runs) || runs.length === 0) {
                throw new Error("No valid data to chart");
            }
            const data = runs.map((run) => ({
                x: new Date(run.tsEnd),
                y: run.durationMs,
                success: run.success !== undefined ? run.success : run.exitCode === 0,
                command: run.command,
                deviceId: run.deviceId,
                hardwareHash: run.hardwareHash,
            }));
            const hardwareChanges = [];
            let lastHardwareHash = null;
            runs.forEach((run) => {
                if (lastHardwareHash && run.hardwareHash !== lastHardwareHash) {
                    hardwareChanges.push({
                        x: new Date(run.tsEnd),
                        label: "Hardware Change",
                        device: run.deviceId,
                    });
                }
                lastHardwareHash = run.hardwareHash;
            });
            if (data.length === 0) {
                throw new Error("No valid timing data found");
            }
            const pointColors = data.map((point) => {
                if (point.success === true)
                    return "#22c55e";
                if (point.success === false)
                    return "#ef4444";
                return "#eab308";
            });
            const values = data.map((d) => d.y);
            const maxVal = Math.max(...values);
            const minVal = Math.min(...values.filter((v) => v > 0));
            const ratio = maxVal / minVal;
            const useLogScale = false;
            console.log("Chart values:", {
                maxVal,
                minVal,
                ratio,
                useLogScale,
                values: values.slice(0, 10),
            });
            chart = new Chart(ctx, {
                type: "line",
                data: {
                    datasets: [
                        {
                            label: "Duration (ms)",
                            data: data,
                            borderColor: "#4FC3F7",
                            backgroundColor: "rgba(79, 195, 247, 0.1)",
                            borderWidth: 2,
                            fill: false,
                            tension: 0,
                            stepped: false,
                            pointBackgroundColor: pointColors,
                            pointRadius: 4,
                            pointHoverRadius: 7,
                            pointBorderColor: "rgba(255, 255, 255, 0.5)",
                            pointBorderWidth: 1,
                            pointHoverBorderWidth: 2,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            type: "linear",
                            position: "bottom",
                            grid: {
                                color: "rgba(255, 255, 255, 0.1)",
                            },
                            ticks: {
                                color: "rgba(255, 255, 255, 0.7)",
                                maxTicksLimit: 8,
                                callback: function (value, index) {
                                    if (index < data.length) {
                                        const date = new Date(data[index].x);
                                        const now = new Date();
                                        const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
                                        if (diffHours < 1) {
                                            return date.toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            });
                                        }
                                        else if (diffHours < 24) {
                                            return date.toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            });
                                        }
                                        else {
                                            return date.toLocaleDateString([], {
                                                month: "short",
                                                day: "numeric",
                                            });
                                        }
                                    }
                                    return "";
                                },
                            },
                        },
                        y: {
                            type: "linear",
                            beginAtZero: true,
                            grid: {
                                color: "rgba(255, 255, 255, 0.1)",
                            },
                            ticks: {
                                color: "rgba(255, 255, 255, 0.7)",
                                maxTicksLimit: 8,
                                callback: function (value) {
                                    return formatDuration(Math.round(value));
                                },
                            },
                        },
                    },
                    plugins: {
                        legend: {
                            display: false,
                        },
                        tooltip: {
                            callbacks: {
                                title: function (context) {
                                    return new Date(context[0].parsed.x).toLocaleString();
                                },
                                label: function (context) {
                                    const dataPoint = data[context.dataIndex];
                                    const deviceLabel = dataPoint.deviceId
                                        ? dataPoint.deviceId.slice(0, 8) + "..."
                                        : "Unknown device";
                                    return [
                                        `Command: ${dataPoint.command}`,
                                        `Duration: ${formatDuration(context.parsed.y)}`,
                                        `Status: ${dataPoint.success === true
                                            ? "✅ Success"
                                            : dataPoint.success === false
                                                ? "❌ Failed"
                                                : "⚠️ Unknown"}`,
                                        `Device: ${deviceLabel}`,
                                    ];
                                },
                            },
                        },
                        annotation: {
                            annotations: hardwareChanges.map((change) => ({
                                type: "line",
                                mode: "vertical",
                                scaleID: "x",
                                value: change.x,
                                borderColor: "rgba(255, 193, 7, 0.8)",
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    display: true,
                                    content: "🔧 Hardware Change",
                                    position: "top",
                                    backgroundColor: "rgba(255, 193, 7, 0.8)",
                                    color: "#000",
                                    font: {
                                        size: 10,
                                    },
                                },
                            })),
                        },
                    },
                    onHover: (event, elements) => {
                        const legendEl = document.getElementById("chart-legend");
                        if (legendEl && elements.length > 0) {
                            const dataIndex = elements[0].index;
                            const dataPoint = data[dataIndex];
                            legendEl.innerHTML = `
              <div class="chart-hover-info">
                <strong>${dataPoint.command}</strong><br>
                <span class="duration">${formatDuration(dataPoint.y)}</span> • 
                <span class="status ${dataPoint.success === true
                                ? "success"
                                : dataPoint.success === false
                                    ? "error"
                                    : "warning"}">
                  ${dataPoint.success === true
                                ? "✅ Success"
                                : dataPoint.success === false
                                    ? "❌ Failed"
                                    : "⚠️ Unknown"}
                </span><br>
                <small>${new Date(dataPoint.x).toLocaleString()}</small>
              </div>
            `;
                            legendEl.style.display = "block";
                        }
                        else if (legendEl) {
                            legendEl.style.display = "none";
                        }
                    },
                },
            });
        }
        function sortCommands(commands, column, direction) {
            return [...commands].sort((a, b) => {
                let aVal, bVal;
                switch (column) {
                    case "command":
                        aVal = a.command.toLowerCase();
                        bVal = b.command.toLowerCase();
                        break;
                    case "runs":
                        aVal = a.runs;
                        bVal = b.runs;
                        break;
                    case "avgMs":
                        aVal = a.avgMs;
                        bVal = b.avgMs;
                        break;
                    case "successRate":
                        aVal = a.successRate;
                        bVal = b.successRate;
                        break;
                    case "totalTimeMs":
                        aVal = a.totalTimeMs;
                        bVal = b.totalTimeMs;
                        break;
                    case "impactScore":
                        aVal = a.impactScore;
                        bVal = b.impactScore;
                        break;
                    case "timePerDay":
                        aVal = a.timePerDayMs;
                        bVal = b.timePerDayMs;
                        break;
                    case "medianMs":
                        aVal = a.medianMs;
                        bVal = b.medianMs;
                        break;
                    case "p95Ms":
                        aVal = a.p95Ms;
                        bVal = b.p95Ms;
                        break;
                    case "minMs":
                        aVal = a.minMs;
                        bVal = b.minMs;
                        break;
                    case "maxMs":
                        aVal = a.maxMs;
                        bVal = b.maxMs;
                        break;
                    case "projectedSavingsMs":
                        aVal = a.projectedSavingsMs;
                        bVal = b.projectedSavingsMs;
                        break;
                    case "optimizationPotential":
                        aVal = a.optimizationPotential;
                        bVal = b.optimizationPotential;
                        break;
                    default:
                        return 0;
                }
                if (aVal < bVal)
                    return direction === "asc" ? -1 : 1;
                if (aVal > bVal)
                    return direction === "asc" ? 1 : -1;
                return 0;
            });
        }
        function renderCommandTable(perCommand, runs = []) {
            currentCommandData = perCommand;
            const tbody = document.getElementById("commandTableBody");
            if (!tbody) {
                console.error("Command table body not found");
                return;
            }
            const tableContainer = tbody.closest(".table-container");
            const sorted = sortCommands(perCommand, commandTableSort.column, commandTableSort.direction);
            const startIndex = commandTablePage * COMMANDS_PER_PAGE;
            const endIndex = startIndex + COMMANDS_PER_PAGE;
            const paginatedCommands = sorted.slice(startIndex, endIndex);
            tbody.innerHTML = "";
            paginatedCommands.forEach((cmd) => {
                const row = document.createElement("tr");
                const successRate = Math.round(cmd.successRate * 100);
                const successClass = successRate >= 90
                    ? "success"
                    : successRate >= 50
                        ? "warning"
                        : "error";
                const deviceIcons = getCommandDeviceIcons(cmd.command, runs);
                const commandCell = `
        <div class="command-cell">
          <button class="play-btn" data-command="${cmd.command.replace(/"/g, "&quot;")}">▶</button>
          <div class="command-text" data-tooltip="${cmd.command}">
            <span class="command-display">${cmd.command}</span>
          </div>
          <div class="command-devices">
            ${deviceIcons}
          </div>
        </div>
      `;
                const trendIcon = cmd.trend === "up" ? "↗" : cmd.trend === "down" ? "↘" : "→";
                const trendClass = `trend-${cmd.trend}`;
                row.innerHTML = `
        <td data-column="command" class="command-name">${commandCell}</td>
        <td data-column="runs" class="runs-count clickable" data-filter-command="${cmd.command.replace(/"/g, "&quot;")}">
          ${cmd.runs}
        </td>
        <td data-column="avgMs" class="avg-duration">${formatDuration(Math.round(cmd.avgMs))}</td>
        <td data-column="medianMs" class="median-duration column-hidden">${formatDuration(Math.round(cmd.medianMs || cmd.avgMs))}</td>
        <td data-column="p95Ms" class="p95-duration column-hidden">${formatDuration(Math.round(cmd.p95Ms || cmd.avgMs))}</td>
        <td data-column="minMs" class="min-duration column-hidden">${formatDuration(Math.round(cmd.minMs || cmd.avgMs))}</td>
        <td data-column="maxMs" class="max-duration column-hidden">${formatDuration(Math.round(cmd.maxMs || cmd.avgMs))}</td>
        <td data-column="successRate" class="success-rate ${successClass} clickable" data-filter-failed="${cmd.command.replace(/"/g, "&quot;")}">
          ${successRate}%
        </td>
        <td data-column="trend" class="trend-indicator ${trendClass} column-hidden" title="Performance trend for selected period">
          ${trendIcon}
        </td>
        <td data-column="sparkline" class="sparkline-cell column-hidden"></td>
        <td data-column="totalTime" class="total-time column-visible" title="Total time consumed: ${formatDuration(cmd.totalTimeMs)}">
          ${formatDuration(Math.round(cmd.totalTimeMs))}
        </td>
        <td data-column="impact" class="impact-score column-visible" title="Impact score: ${cmd.impactScore}/100">
          <div class="impact-bar" data-impact="${cmd.impactScore}">
            <div class="impact-fill"></div>
            <span class="impact-text">${cmd.impactScore}</span>
          </div>
        </td>
        <td data-column="timePerDay" class="time-per-day column-hidden" title="Average time per day: ${formatDuration(cmd.timePerDayMs)}">
          ${formatDuration(Math.round(cmd.timePerDayMs))}
        </td>
        <td data-column="projectedSavings" class="projected-savings column-hidden" title="Potential savings: ${formatDuration(cmd.projectedSavingsMs || 0)}">
          ${formatDuration(Math.round(cmd.projectedSavingsMs || 0))}
        </td>
        <td data-column="optimizationPotential" class="optimization-potential column-hidden" title="Optimization priority: ${cmd.optimizationPotential || "low"}">
          <span class="priority-badge priority-${cmd.optimizationPotential || "low"}">${String(cmd.optimizationPotential || "low").toUpperCase()}</span>
        </td>
      `;
                tbody.appendChild(row);
                row.commandData = cmd;
                const impactBar = row.querySelector(".impact-bar");
                if (impactBar) {
                    impactBar.style.setProperty("--impact-width", `${cmd.impactScore}%`);
                }
                if (visibleColumns.sparkline) {
                    const sparklineCell = row.querySelector(".sparkline-cell");
                    if (sparklineCell) {
                        if (cmd.sparkline && cmd.sparkline.length > 1) {
                            const sparkline = createSparkline(cmd.sparkline);
                            sparklineCell.appendChild(sparkline);
                        }
                        else {
                            sparklineCell.innerHTML =
                                '<span class="sparkline-placeholder" title="Needs 2+ runs to show trend">—</span>';
                        }
                    }
                }
            });
            updateCommandTablePagination(sorted.length);
            setTimeout(() => updateSortIndicators(), 10);
            updateColumnVisibility();
            updatePlayButtonStates();
            setDeviceIconColors();
        }
        function updateColumnVisibility() {
            const table = document.getElementById("commandTable");
            if (!table)
                return;
            const headers = table.querySelectorAll("th[data-column]");
            headers.forEach((header) => {
                const column = header.getAttribute("data-column");
                if (column && visibleColumns[column]) {
                    header.classList.remove("column-hidden");
                    header.classList.add("column-visible");
                }
                else {
                    header.classList.remove("column-visible");
                    header.classList.add("column-hidden");
                }
            });
            const rows = table.querySelectorAll("tbody tr");
            rows.forEach((row) => {
                const cells = row.querySelectorAll("td[data-column]");
                cells.forEach((cell) => {
                    const column = cell.getAttribute("data-column");
                    if (column && visibleColumns[column]) {
                        cell.classList.remove("column-hidden");
                        cell.classList.add("column-visible");
                    }
                    else {
                        cell.classList.remove("column-visible");
                        cell.classList.add("column-hidden");
                    }
                    if (column === "sparkline" &&
                        visibleColumns[column] &&
                        cell.innerHTML === "") {
                        const commandData = row.commandData;
                        if (commandData) {
                            if (commandData.recentDurations &&
                                commandData.recentDurations.length > 1) {
                                const sparkline = createSparkline(commandData.recentDurations);
                                cell.appendChild(sparkline);
                            }
                            else {
                                cell.innerHTML =
                                    '<span class="sparkline-placeholder" title="Needs 2+ runs to show trend">—</span>';
                            }
                        }
                    }
                });
            });
        }
        function createSparkline(durations) {
            const canvas = document.createElement("canvas");
            canvas.width = 60;
            canvas.height = 20;
            canvas.className = "sparkline";
            const ctx = canvas.getContext("2d");
            if (!ctx || durations.length < 2)
                return canvas;
            const max = Math.max(...durations);
            const min = Math.min(...durations);
            const range = max - min || 1;
            ctx.strokeStyle = "#007ACC";
            ctx.lineWidth = 1;
            ctx.beginPath();
            durations.forEach((duration, i) => {
                const x = (i / (durations.length - 1)) * 58 + 1;
                const y = 19 - ((duration - min) / range) * 18;
                if (i === 0) {
                    ctx.moveTo(x, y);
                }
                else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();
            return canvas;
        }
        function updateCommandTablePagination(totalCommands) {
            let paginationEl = document.querySelector(".command-pagination");
            if (!paginationEl) {
                paginationEl = document.createElement("div");
                paginationEl.className = "command-pagination";
                const tableBody = document.getElementById("commandTableBody");
                const tableContainer = tableBody?.closest(".table-container");
                if (tableContainer) {
                    tableContainer.appendChild(paginationEl);
                }
            }
            const totalPages = Math.ceil(totalCommands / COMMANDS_PER_PAGE);
            const currentPage = commandTablePage + 1;
            if (totalPages <= 1) {
                paginationEl.innerHTML = "";
                return;
            }
            paginationEl.innerHTML = `
      <div class="pagination-info">
        Showing ${commandTablePage * COMMANDS_PER_PAGE + 1}-${Math.min((commandTablePage + 1) * COMMANDS_PER_PAGE, totalCommands)} of ${totalCommands} commands
      </div>
      <div class="pagination-controls">
        <button class="pagination-btn" data-action="prev" ${commandTablePage === 0 ? "disabled" : ""}>← Previous</button>
        <span>Page ${currentPage} of ${totalPages}</span>
        <button class="pagination-btn" data-action="next" ${commandTablePage >= totalPages - 1 ? "disabled" : ""}>Next →</button>
      </div>
    `;
            paginationEl.addEventListener("click", (e) => {
                const target = e.target;
                if (target?.classList.contains("pagination-btn") &&
                    !target.disabled) {
                    const action = target.getAttribute("data-action");
                    if (action === "prev") {
                        window.prevCommandPage();
                    }
                    else if (action === "next") {
                        window.nextCommandPage();
                    }
                }
            });
        }
        function updateSortIndicators() {
            document.querySelectorAll(".sort-indicator").forEach((el) => el.remove());
            const headers = document.querySelectorAll("th[data-sort]");
            headers.forEach((header) => {
                if (header.dataset.sort === commandTableSort.column) {
                    const indicator = document.createElement("span");
                    indicator.className = "sort-indicator";
                    indicator.textContent =
                        commandTableSort.direction === "asc" ? " ↑" : " ↓";
                    header.appendChild(indicator);
                }
            });
        }
        window.nextCommandPage = function () {
            if (!lastData || !lastData.perCommand)
                return;
            const totalPages = Math.ceil(lastData.perCommand.length / COMMANDS_PER_PAGE);
            if (commandTablePage < totalPages - 1) {
                commandTablePage++;
                renderCommandTable(lastData.perCommand, lastData.runs);
            }
        };
        window.prevCommandPage = function () {
            if (!lastData || !lastData.perCommand)
                return;
            if (commandTablePage > 0) {
                commandTablePage--;
                renderCommandTable(lastData.perCommand, lastData.runs);
            }
        };
        window.sortCommandTable = function (column) {
            console.log("sortCommandTable called with column:", column);
            console.log("Current sort state BEFORE:", commandTableSort);
            if (commandTableSort.column === column) {
                commandTableSort.direction =
                    commandTableSort.direction === "asc" ? "desc" : "asc";
            }
            else {
                commandTableSort.column = column;
                commandTableSort.direction = "desc";
            }
            console.log("Current sort state AFTER:", commandTableSort);
            console.log("Current data length:", currentCommandData.length);
            commandTablePage = 0;
            if (lastData && lastData.perCommand && lastData.runs) {
                renderCommandTable(lastData.perCommand, lastData.runs);
            }
        };
        window.runCommand = function (command) {
            vscode.postMessage({
                type: "RUN_COMMAND",
                command: command,
            });
        };
        window.filterByCommand = function (command) {
            currentCommandFilter = command;
            if (lastData && lastData.runs) {
                renderRecentRuns(lastData.runs);
            }
        };
        window.filterByFailed = function (command) {
            currentCommandFilter = command;
            currentFailedFilter = true;
            if (lastData && lastData.runs) {
                renderRecentRuns(lastData.runs);
            }
        };
        function setupTimeRangeDropdown() {
            const display = document.getElementById("timeRangeDisplay");
            const dropdown = document.getElementById("timeRangeDropdown");
            if (!display || !dropdown) {
                console.log("Time range elements not found, skipping setup");
                return;
            }
            display.addEventListener("click", function (e) {
                e.stopPropagation();
                document.querySelectorAll(".multi-select-dropdown").forEach((dd) => {
                    dd.classList.add("element-hidden");
                });
                dropdown.classList.toggle("element-hidden");
            });
            dropdown.addEventListener("click", function (e) {
                const target = e.target;
                if (!target)
                    return;
                const option = target.closest(".time-range-option");
                if (option) {
                    dropdown.querySelectorAll(".time-range-option").forEach((opt) => {
                        opt.removeAttribute("data-selected");
                    });
                    option.setAttribute("data-selected", "true");
                    display.textContent = option.textContent;
                    const value = option.getAttribute("data-value");
                    if (value)
                        currentFilters.window = value;
                    dropdown.classList.add("element-hidden");
                    updateFilters();
                }
            });
            const applyBtn = document.getElementById("applyCustomRange");
            const fromDate = document.getElementById("customFromDate");
            const toDate = document.getElementById("customToDate");
            if (applyBtn && fromDate && toDate) {
                applyBtn.addEventListener("click", function () {
                    const from = fromDate.value;
                    const to = toDate.value;
                    if (from && to) {
                        dropdown.querySelectorAll(".time-range-option").forEach((opt) => {
                            opt.removeAttribute("data-selected");
                        });
                        const fromFormatted = new Date(from).toLocaleDateString();
                        const toFormatted = new Date(to).toLocaleDateString();
                        display.textContent = `${fromFormatted} - ${toFormatted}`;
                        currentFilters.window = "custom";
                        currentFilters.customFrom = from;
                        currentFilters.customTo = to;
                        dropdown.classList.add("element-hidden");
                        updateFilters();
                    }
                });
            }
            dropdown.addEventListener("click", function (e) {
                e.stopPropagation();
            });
            document.addEventListener("click", function () {
                dropdown.classList.add("element-hidden");
            });
        }
        function setDeviceIconColors() {
            document
                .querySelectorAll(".device-icon[data-device-color], .device-icon-small[data-device-color]")
                .forEach((icon) => {
                const color = icon.getAttribute("data-device-color");
                if (color) {
                    icon.style.setProperty("--device-color", color);
                }
            });
        }
        function renderRecentRuns(runs) {
            const container = document.getElementById("recentRuns");
            if (!container)
                return;
            container.innerHTML = "";
            if (runs.length === 0) {
                container.innerHTML =
                    '<div class="empty-state">No recent runs to display</div>';
                return;
            }
            runs.reverse().forEach((run, index) => {
                const item = document.createElement("div");
                item.className = "run-item";
                const success = run.success;
                const relativeTime = getRelativeTime(run.tsEnd);
                let trendIndicator = "";
                if (index < runs.length - 1) {
                    const previousRuns = runs.slice(index + 1);
                    const previousSameCommand = previousRuns.find((prevRun) => prevRun.command === run.command);
                    if (previousSameCommand) {
                        const currentDuration = run.durationMs;
                        const previousDuration = previousSameCommand.durationMs;
                        const tolerance = 0.1;
                        const percentChange = (currentDuration - previousDuration) / previousDuration;
                        if (percentChange > tolerance) {
                            trendIndicator =
                                '<span class="trend-up" title="Slower than last run">⬆️</span>';
                        }
                        else if (percentChange < -tolerance) {
                            trendIndicator =
                                '<span class="trend-down" title="Faster than last run">⬇️</span>';
                        }
                        else {
                            trendIndicator =
                                '<span class="trend-same" title="Similar to last run">➡️</span>';
                        }
                    }
                }
                const deviceInfo = getDeviceInfo(run);
                item.innerHTML = `
        <span class="run-status ${success ? "success" : "fail"}">
          ${success ? "✅" : "❌"}
        </span>
        <span class="run-command" title="${run.command}">
          ${run.command}${trendIndicator}
        </span>
        <span class="run-duration">
          ${formatDuration(Math.round(run.durationMs))}
        </span>
        <span class="run-time">
          ${relativeTime}
        </span>
        <span class="run-device">
          <span class="device-icon" title="${deviceInfo.tooltip}" data-device-color="${deviceInfo.color}" data-tooltip="${deviceInfo.tooltip}">
            ${deviceInfo.icon}
          </span>
                     <button class="delete-run-btn" data-run-id="${run.tsEnd}-${run.command}" title="Delete this run (cannot be undone)">🗑️</button>
        </span>
      `;
                if (container)
                    container.appendChild(item);
            });
        }
        function getRelativeTime(timestamp) {
            const now = Date.now();
            const diff = now - timestamp;
            if (diff < 60000)
                return "just now";
            if (diff < 3600000)
                return `${Math.floor(diff / 60000)}m ago`;
            if (diff < 86400000)
                return `${Math.floor(diff / 3600000)}h ago`;
            return `${Math.floor(diff / 86400000)}d ago`;
        }
        function getDeviceColor(deviceId) {
            let hash = 0;
            for (let i = 0; i < deviceId.length; i++) {
                hash = deviceId.charCodeAt(i) + ((hash << 5) - hash);
            }
            const hue = Math.abs(hash % 360);
            return `hsl(${hue}, 45%, 60%)`;
        }
        function supportsNerdFonts() {
            const testCanvas = document.createElement("canvas");
            const ctx = testCanvas.getContext("2d");
            if (!ctx)
                return false;
            ctx.font = '16px "MesloLGS NF", "FiraCode Nerd Font", monospace';
            const nerdFontWidth = ctx.measureText("\uF179").width;
            ctx.font = "16px monospace";
            const fallbackWidth = ctx.measureText("\uF179").width;
            return Math.abs(nerdFontWidth - fallbackWidth) > 1;
        }
        function getDeviceInfo(run) {
            const deviceId = run.deviceId;
            const device = run.device;
            const color = getDeviceColor(deviceId);
            let icon = "💻";
            let nerdFontIcon = "\uF109";
            let osName = "Unknown";
            let osVersion = "";
            if (device && device.os) {
                const os = device.os.toLowerCase();
                if (os.includes("darwin") || os.includes("mac")) {
                    nerdFontIcon = "\uF179";
                    icon = "🍎";
                    osName = "macOS";
                    const versionMatch = device.os.match(/darwin\s*(\d+\.\d+)/i) ||
                        device.os.match(/(\d+\.\d+\.\d+)/);
                    if (versionMatch) {
                        osVersion = versionMatch[1];
                        const darwinVersion = parseFloat(versionMatch[1]);
                        if (darwinVersion >= 23)
                            osVersion = "14";
                        else if (darwinVersion >= 22)
                            osVersion = "13";
                        else if (darwinVersion >= 21)
                            osVersion = "12";
                        else if (darwinVersion >= 20)
                            osVersion = "11";
                        else if (darwinVersion >= 19)
                            osVersion = "10.15";
                    }
                }
                else if (os.includes("win")) {
                    nerdFontIcon = "\uF17A";
                    icon = "🪟";
                    osName = "Windows";
                    const versionMatch = device.os.match(/windows\s*(\d+)/i) || device.os.match(/win(\d+)/i);
                    if (versionMatch) {
                        osVersion = versionMatch[1];
                        if (osVersion === "10") {
                            osName = "Windows 10";
                        }
                        else if (osVersion === "11") {
                            osName = "Windows 11";
                        }
                    }
                }
                else if (os.includes("linux")) {
                    if (os.includes("ubuntu")) {
                        nerdFontIcon = "\uF31B";
                        icon = "🟠";
                        osName = "Ubuntu";
                    }
                    else if (os.includes("debian")) {
                        nerdFontIcon = "\uF306";
                        icon = "🌀";
                        osName = "Debian";
                    }
                    else if (os.includes("fedora")) {
                        nerdFontIcon = "\uF30A";
                        icon = "🎩";
                        osName = "Fedora";
                    }
                    else if (os.includes("arch")) {
                        nerdFontIcon = "\uF303";
                        icon = "🏔️";
                        osName = "Arch Linux";
                    }
                    else if (os.includes("centos")) {
                        nerdFontIcon = "\uF304";
                        icon = "🔴";
                        osName = "CentOS";
                    }
                    else if (os.includes("rhel")) {
                        nerdFontIcon = "\uF316";
                        icon = "🔴";
                        osName = "RHEL";
                    }
                    else if (os.includes("suse") || os.includes("opensuse")) {
                        nerdFontIcon = "\uF314";
                        icon = "🟢";
                        osName = "SUSE";
                    }
                    else if (os.includes("mint")) {
                        nerdFontIcon = "\uF30E";
                        icon = "🌿";
                        osName = "Linux Mint";
                    }
                    else if (os.includes("manjaro")) {
                        nerdFontIcon = "\uF312";
                        icon = "🟢";
                        osName = "Manjaro";
                    }
                    else if (os.includes("alpine")) {
                        nerdFontIcon = "\uF300";
                        icon = "⛰️";
                        osName = "Alpine";
                    }
                    else {
                        nerdFontIcon = "\uF17C";
                        icon = "🐧";
                        osName = "Linux";
                    }
                    const versionMatch = device.os.match(/(\d+\.\d+)/);
                    if (versionMatch) {
                        osVersion = versionMatch[1];
                    }
                }
            }
            let tooltip = deviceId.slice(0, 8) + "...";
            if (device) {
                tooltip = `${osName}${osVersion ? " " + osVersion : ""} • ${device.arch}`;
                if (device.cpuModel) {
                    const cleanCpu = device.cpuModel.replace(/\s+/g, " ").trim();
                    tooltip += ` • ${cleanCpu}`;
                }
                if (device.cpus) {
                    tooltip += ` • ${device.cpus}-core`;
                }
                if (device.memGB) {
                    tooltip += ` • ${device.memGB}GB`;
                }
                tooltip += ` • ${deviceId.slice(0, 8)}...`;
            }
            const finalIcon = nerdFontIcon && supportsNerdFonts() ? nerdFontIcon : icon;
            return {
                icon: finalIcon,
                color,
                tooltip,
                osName,
                osVersion,
            };
        }
        function getCommandDeviceIcons(command, runs = []) {
            const commandRuns = runs.filter((run) => run.command === command);
            const uniqueDevices = new Map();
            commandRuns.forEach((run) => {
                if (!uniqueDevices.has(run.deviceId)) {
                    uniqueDevices.set(run.deviceId, run);
                }
            });
            const deviceArray = Array.from(uniqueDevices.values()).slice(0, 3);
            const icons = deviceArray.map((run) => {
                const deviceInfo = getDeviceInfo(run);
                return `<span class="device-icon-small" title="${deviceInfo.tooltip}" data-device-color="${deviceInfo.color}" data-tooltip="${deviceInfo.tooltip}">${deviceInfo.icon}</span>`;
            });
            if (uniqueDevices.size > 3) {
                icons.push(`<span class="device-more" title="${uniqueDevices.size - 3} more devices">+${uniqueDevices.size - 3}</span>`);
            }
            return icons.join("");
        }
        function showEmptyState(filters = {}) {
            document.querySelector(".loading")?.classList.add("element-hidden");
            document.querySelector(".cards")?.classList.add("element-hidden");
            document
                .querySelector(".empty-state")
                ?.classList.remove("element-hidden");
            document.querySelector(".global-stats")?.classList.add("element-hidden");
            const emptyStateEl = document.querySelector(".empty-state");
            if (emptyStateEl) {
                let message = "";
                let suggestion = "";
                if (filters.window === "custom" &&
                    filters.customFrom &&
                    filters.customTo) {
                    const fromDate = new Date(filters.customFrom).toLocaleDateString();
                    const toDate = new Date(filters.customTo).toLocaleDateString();
                    message = `📅 No data found in the selected time range: ${fromDate} - ${toDate}`;
                    suggestion =
                        "Try selecting a different date range or check if you have any commands recorded during this period.";
                }
                else if (filters.window &&
                    filters.window !== "all" &&
                    filters.window !== "7d") {
                    const timeLabels = {
                        "1h": "last hour",
                        "24h": "last 24 hours",
                        "30d": "last 30 days",
                        "90d": "last 3 months",
                        "1y": "last year",
                    };
                    const timeLabel = timeLabels[filters.window] || filters.window;
                    message = `⏰ No commands recorded in the ${timeLabel}`;
                    suggestion =
                        "Try expanding the time range or run some commands to start tracking performance.";
                }
                else if (hasActiveFilters(filters)) {
                    message = "🔍 No data matches your current filters";
                    suggestion =
                        "Try adjusting your filters (Project, Command, Success, or Device) to see more data.";
                }
                else {
                    message = "👋 Welcome to ProcessLens!";
                    suggestion =
                        "Start tracking your command execution times to identify performance trends and bottlenecks.";
                }
                emptyStateEl.innerHTML = `
        <div class="welcome-message">
          <h2>${message}</h2>
          <p>${suggestion}</p>
          <div class="getting-started">
            <h3>Getting Started:</h3>
            <ol>
              <li>Click <strong>"ProcessLens: Run"</strong> in the Command Palette</li>
              <li>Select a package.json script or enter a custom command</li>
              <li>Watch the dashboard populate with performance data!</li>
            </ol>
            <p class="tip">💡 <strong>Tip:</strong> You can also browse your shell history or run package.json scripts!</p>
          </div>
        </div>
      `;
            }
        }
        function hasActiveFilters(filters) {
            return ((filters.projectId && filters.projectId.length > 0) ||
                (filters.command && filters.command.length > 0) ||
                (filters.success && filters.success !== "all") ||
                (filters.deviceInstance && filters.deviceInstance.length > 0));
        }
        function rerenderActiveChartTab() {
            const activeTab = document.querySelector(".chart-tab.active");
            if (!activeTab || !lastData)
                return;
            const targetTab = activeTab.getAttribute("data-tab");
            if (targetTab === "heatmap") {
                renderHeatmap(lastData.runs);
            }
            else if (targetTab === "performance") {
                renderPerformanceMatrix(lastData.perCommand);
            }
        }
        function setupChartTabs() {
            const tabs = document.querySelectorAll(".chart-tab");
            const views = document.querySelectorAll(".chart-view");
            tabs.forEach((tab) => {
                tab.addEventListener("click", () => {
                    const targetTab = tab.getAttribute("data-tab");
                    tabs.forEach((t) => t.classList.remove("active"));
                    tab.classList.add("active");
                    views.forEach((view) => {
                        view.classList.remove("active");
                        view.classList.add("element-hidden");
                    });
                    const targetView = document.getElementById(`${targetTab}Chart`);
                    if (targetView) {
                        targetView.classList.add("active");
                        targetView.classList.remove("element-hidden");
                        if (targetTab === "heatmap" && lastData) {
                            renderHeatmap(lastData.runs);
                        }
                        else if (targetTab === "performance" && lastData) {
                            renderPerformanceMatrix(lastData.perCommand);
                        }
                    }
                });
            });
        }
        function renderHeatmap(runs) {
            const heatmapGrid = document.getElementById("heatmapGrid");
            const heatmapMonths = document.getElementById("heatmapMonths");
            if (!heatmapGrid || !runs || runs.length === 0)
                return;
            heatmapGrid.innerHTML = "";
            if (heatmapMonths)
                heatmapMonths.innerHTML = "";
            updateYearNavigationVisibility();
            updateYearDropdown();
            const hasTimeFilter = currentFilters.window && currentFilters.window !== "all";
            let startDate, endDate, gridStartDate;
            if (hasTimeFilter) {
                const now = Date.now();
                let cutoff;
                if (currentFilters.window === "custom" &&
                    currentFilters.customFrom &&
                    currentFilters.customTo) {
                    startDate = new Date(currentFilters.customFrom);
                    endDate = new Date(currentFilters.customTo);
                    startDate.setHours(0, 0, 0, 0);
                    endDate.setHours(23, 59, 59, 999);
                }
                else {
                    switch (currentFilters.window) {
                        case "1h":
                            cutoff = now - 60 * 60 * 1000;
                            break;
                        case "24h":
                            cutoff = now - 24 * 60 * 60 * 1000;
                            break;
                        case "7d":
                            cutoff = now - 7 * 24 * 60 * 60 * 1000;
                            break;
                        case "30d":
                            cutoff = now - 30 * 24 * 60 * 60 * 1000;
                            break;
                        case "90d":
                            cutoff = now - 90 * 24 * 60 * 60 * 1000;
                            break;
                        case "1y":
                            cutoff = now - 365 * 24 * 60 * 60 * 1000;
                            break;
                        default:
                            cutoff = now - 7 * 24 * 60 * 60 * 1000;
                    }
                    startDate = new Date(cutoff);
                    endDate = new Date(now);
                    startDate.setHours(0, 0, 0, 0);
                    endDate.setHours(23, 59, 59, 999);
                }
                const dayRange = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
                if (dayRange <= 30) {
                    gridStartDate = new Date(startDate);
                    const dayOfWeek = gridStartDate.getDay();
                    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    gridStartDate.setDate(gridStartDate.getDate() - daysToMonday);
                    gridStartDate.setHours(0, 0, 0, 0);
                }
                else {
                    gridStartDate = new Date(startDate);
                    const dayOfWeek = gridStartDate.getDay();
                    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    gridStartDate.setDate(gridStartDate.getDate() - daysToMonday);
                    gridStartDate.setHours(0, 0, 0, 0);
                }
            }
            else {
                if (currentHeatmapYear === new Date().getFullYear()) {
                    const today = new Date();
                    endDate = new Date(today);
                    endDate.setHours(23, 59, 59, 999);
                    startDate = new Date(endDate);
                    startDate.setDate(startDate.getDate() - 364);
                    startDate.setHours(0, 0, 0, 0);
                }
                else {
                    startDate = new Date(currentHeatmapYear, 0, 1);
                    endDate = new Date(currentHeatmapYear, 11, 31, 23, 59, 59, 999);
                }
                gridStartDate = new Date(startDate);
                const dayOfWeek = gridStartDate.getDay();
                const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                gridStartDate.setDate(gridStartDate.getDate() - daysToMonday);
                gridStartDate.setHours(0, 0, 0, 0);
            }
            const runsByDate = new Map();
            runs.forEach((run) => {
                const date = new Date(run.tsEnd);
                const dateKey = date.toISOString().split("T")[0];
                if (!runsByDate.has(dateKey)) {
                    runsByDate.set(dateKey, []);
                }
                runsByDate.get(dateKey).push(run);
            });
            console.log("Heatmap debug - Date range:", {
                startDate: startDate.toISOString().split("T")[0],
                endDate: endDate.toISOString().split("T")[0],
                gridStartDate: gridStartDate.toISOString().split("T")[0],
                totalRuns: runs.length,
                datesWithData: Array.from(runsByDate.keys()).sort().slice(-7),
            });
            const maxRunsPerDay = Math.max(...Array.from(runsByDate.values()).map((dayRuns) => dayRuns.length), 1);
            const totalDays = Math.ceil((endDate.getTime() - gridStartDate.getTime()) / (24 * 60 * 60 * 1000));
            const weeksNeeded = Math.ceil(totalDays / 7);
            const maxWeeks = hasTimeFilter && currentFilters.window !== "1y"
                ? Math.min(weeksNeeded, 53)
                : 53;
            const cells = [];
            const monthLabels = [];
            let currentDate = new Date(gridStartDate);
            for (let week = 0; week < maxWeeks; week++) {
                const weekCells = [];
                const weekStartDate = new Date(currentDate);
                for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
                    const dateKey = currentDate.toISOString().split("T")[0];
                    const dayRuns = runsByDate.get(dateKey) || [];
                    const runCount = dayRuns.length;
                    const isInRange = currentDate >= startDate && currentDate <= endDate;
                    const actualRunCount = isInRange ? runCount : 0;
                    const intensity = actualRunCount === 0
                        ? 0
                        : Math.min(4, Math.ceil((actualRunCount / maxRunsPerDay) * 4));
                    const cell = document.createElement("div");
                    cell.className = `heatmap-cell level-${intensity}`;
                    cell.setAttribute("data-date", dateKey);
                    cell.setAttribute("data-runs", actualRunCount);
                    cell.setAttribute("data-day", currentDate.toLocaleDateString("en-US", { weekday: "long" }));
                    addTimeRangeHighlighting(cell, currentDate);
                    cell.addEventListener("mouseenter", (e) => {
                        showHeatmapTooltip(e, dateKey, actualRunCount, dayRuns);
                    });
                    cell.addEventListener("mouseleave", () => {
                        hideHeatmapTooltip();
                    });
                    cell.addEventListener("click", () => {
                        handleHeatmapDayClick(dateKey, cell);
                    });
                    weekCells.push(cell);
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                cells.push(weekCells);
                if (week === 0) {
                    monthLabels.push({
                        week: week,
                        month: weekStartDate.getMonth(),
                        year: weekStartDate.getFullYear(),
                    });
                }
                else {
                    const prevWeekDate = new Date(gridStartDate.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
                    if (weekStartDate.getMonth() !== prevWeekDate.getMonth()) {
                        monthLabels.push({
                            week: week,
                            month: weekStartDate.getMonth(),
                            year: weekStartDate.getFullYear(),
                        });
                    }
                }
            }
            cells.forEach((weekCells) => {
                weekCells.forEach((cell) => {
                    heatmapGrid.appendChild(cell);
                });
            });
            if (heatmapMonths) {
                const monthNames = [
                    "Jan",
                    "Feb",
                    "Mar",
                    "Apr",
                    "May",
                    "Jun",
                    "Jul",
                    "Aug",
                    "Sep",
                    "Oct",
                    "Nov",
                    "Dec",
                ];
                heatmapMonths.innerHTML = "";
                for (let week = 0; week < 53; week++) {
                    const monthLabel = document.createElement("div");
                    const monthPos = monthLabels.find((ml) => ml.week === week);
                    if (monthPos) {
                        monthLabel.textContent = monthNames[monthPos.month];
                    }
                    heatmapMonths.appendChild(monthLabel);
                }
            }
            const heatmapYear = document.getElementById("heatmapYear");
            if (heatmapYear) {
                const endYear = endDate.getFullYear();
                const startYear = startDate.getFullYear();
                if (startYear !== endYear) {
                    heatmapYear.textContent = `${startYear}-${endYear}`;
                }
                else {
                    heatmapYear.textContent = endYear.toString();
                }
            }
            const heatmapXLabels = document.getElementById("heatmapXLabels");
            if (heatmapXLabels) {
                heatmapXLabels.innerHTML = "";
            }
        }
        function showHeatmapTooltip(event, date, runCount, runs) {
            const tooltip = document.getElementById("heatmapTooltip");
            if (!tooltip)
                return;
            const formattedDate = new Date(date).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            });
            let content = `<strong>${formattedDate}</strong><br/>`;
            if (runCount === 0) {
                content += "No commands executed";
            }
            else {
                content += `${runCount} command${runCount === 1 ? "" : "s"} executed`;
                if (runs.length > 0) {
                    const totalTime = runs.reduce((sum, run) => sum + run.durationMs, 0);
                    content += `<br/>Total time: ${formatDuration(totalTime)}`;
                }
            }
            tooltip.innerHTML = content;
            tooltip.classList.remove("element-hidden");
            const rect = event.target.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            tooltip.style.left =
                rect.left +
                    scrollLeft +
                    rect.width / 2 -
                    tooltip.offsetWidth / 2 +
                    "px";
            tooltip.style.top =
                rect.top + scrollTop - tooltip.offsetHeight - 8 + "px";
        }
        function hideHeatmapTooltip() {
            const tooltip = document.getElementById("heatmapTooltip");
            if (tooltip) {
                tooltip.classList.add("element-hidden");
            }
        }
        function handleHeatmapDayClick(dateKey, cellElement) {
            if (selectedHeatmapDay === dateKey) {
                resetHeatmapDayFilter();
                return;
            }
            previousFiltersState = {
                window: currentFilters.window,
                customFrom: currentFilters.customFrom,
                customTo: currentFilters.customTo,
            };
            selectedHeatmapDay = dateKey;
            document.querySelectorAll(".heatmap-cell.selected").forEach((cell) => {
                cell.classList.remove("selected");
            });
            cellElement.classList.add("selected");
            const selectedDate = new Date(dateKey);
            const dateStr = selectedDate.toISOString().split("T")[0];
            currentFilters.window = "custom";
            currentFilters.customFrom = dateStr;
            currentFilters.customTo = dateStr;
            updateTimeRangeDropdownForDay(dateStr);
            isHeatmapFilterUpdate = true;
            updateFilters();
            isHeatmapFilterUpdate = false;
        }
        function resetHeatmapDayFilter() {
            selectedHeatmapDay = null;
            document.querySelectorAll(".heatmap-cell.selected").forEach((cell) => {
                cell.classList.remove("selected");
            });
            if (previousFiltersState) {
                currentFilters.window = previousFiltersState.window || "7d";
                currentFilters.customFrom = previousFiltersState.customFrom;
                currentFilters.customTo = previousFiltersState.customTo;
                previousFiltersState = null;
            }
            else {
                currentFilters.window = "7d";
                currentFilters.customFrom = undefined;
                currentFilters.customTo = undefined;
            }
            resetTimeRangeDropdown();
            isHeatmapFilterUpdate = true;
            updateFilters();
            isHeatmapFilterUpdate = false;
        }
        function updateTimeRangeDisplay(selectedDate = null) {
            const display = document.querySelector(".time-range-display");
            if (!display)
                return;
            if (selectedDate) {
                const date = new Date(selectedDate);
                const formattedDate = date.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                });
                display.textContent = `📅 ${formattedDate}`;
            }
            else {
                const windowLabels = {
                    "1h": "Last 1 hour",
                    "24h": "Last 24 hours",
                    "7d": "Last 7 days",
                    "30d": "Last 30 days",
                    "90d": "Last 90 days",
                    "1y": "Last 1 year",
                    all: "All time",
                    custom: "Custom range",
                };
                display.textContent =
                    windowLabels[currentFilters.window] || "Last 7 days";
            }
        }
        function updateTimeRangeDropdownForDay(dateStr) {
            const display = document.getElementById("timeRangeDisplay");
            const dropdown = document.getElementById("timeRangeDropdown");
            const fromDate = document.getElementById("customFromDate");
            const toDate = document.getElementById("customToDate");
            if (!display || !dropdown)
                return;
            const date = new Date(dateStr);
            const formattedDate = date.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
            });
            display.textContent = `📅 ${formattedDate}`;
            dropdown.querySelectorAll(".time-range-option").forEach((opt) => {
                opt.removeAttribute("data-selected");
            });
            if (fromDate && toDate) {
                fromDate.value = dateStr;
                toDate.value = dateStr;
            }
            const customOption = dropdown.querySelector('[data-value="custom"]');
            if (customOption) {
                customOption.setAttribute("data-selected", "true");
            }
        }
        function resetTimeRangeDropdown() {
            const display = document.getElementById("timeRangeDisplay");
            const dropdown = document.getElementById("timeRangeDropdown");
            const fromDate = document.getElementById("customFromDate");
            const toDate = document.getElementById("customToDate");
            if (!display || !dropdown)
                return;
            if (fromDate)
                fromDate.value = "";
            if (toDate)
                toDate.value = "";
            dropdown.querySelectorAll(".time-range-option").forEach((opt) => {
                opt.removeAttribute("data-selected");
            });
            const currentOption = dropdown.querySelector(`[data-value="${currentFilters.window}"]`);
            if (currentOption) {
                currentOption.setAttribute("data-selected", "true");
                display.textContent = currentOption.textContent;
            }
            else {
                const defaultOption = dropdown.querySelector('[data-value="7d"]');
                if (defaultOption) {
                    defaultOption.setAttribute("data-selected", "true");
                    display.textContent = defaultOption.textContent;
                }
            }
        }
        function addTimeRangeHighlighting(cell, cellDate) {
            if (!currentFilters.window || currentFilters.window === "all") {
                return;
            }
            const now = new Date();
            let filterStartDate, filterEndDate;
            if (currentFilters.window === "custom" &&
                currentFilters.customFrom &&
                currentFilters.customTo) {
                filterStartDate = new Date(currentFilters.customFrom);
                filterEndDate = new Date(currentFilters.customTo);
                filterStartDate.setHours(0, 0, 0, 0);
                filterEndDate.setHours(23, 59, 59, 999);
            }
            else {
                let cutoff;
                switch (currentFilters.window) {
                    case "1h":
                        cutoff = now.getTime() - 60 * 60 * 1000;
                        break;
                    case "24h":
                        cutoff = now.getTime() - 24 * 60 * 60 * 1000;
                        break;
                    case "7d":
                        cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
                        break;
                    case "30d":
                        cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
                        break;
                    case "90d":
                        cutoff = now.getTime() - 90 * 24 * 60 * 60 * 1000;
                        break;
                    case "1y":
                        cutoff = now.getTime() - 365 * 24 * 60 * 60 * 1000;
                        break;
                    default:
                        return;
                }
                filterStartDate = new Date(cutoff);
                filterEndDate = new Date(now);
                filterStartDate.setHours(0, 0, 0, 0);
                filterEndDate.setHours(23, 59, 59, 999);
            }
            const cellDateStart = new Date(cellDate);
            cellDateStart.setHours(0, 0, 0, 0);
            const isInFilterRange = cellDateStart >= filterStartDate && cellDateStart <= filterEndDate;
            if (isInFilterRange) {
                cell.classList.add("in-range");
            }
            else {
                cell.classList.add("out-of-range");
            }
        }
        function setupHeatmapYearNavigation() {
            const yearNav = document.getElementById("heatmapYearNav");
            const yearSelect = document.getElementById("heatmapYearSelect");
            const prevBtn = document.getElementById("heatmapPrevYear");
            const nextBtn = document.getElementById("heatmapNextYear");
            if (!yearNav || !yearSelect || !prevBtn || !nextBtn)
                return;
            updateYearDropdown();
            yearSelect.addEventListener("change", (e) => {
                const target = e.target;
                const newYear = parseInt(target.value);
                if (!isNaN(newYear) && newYear > 1900 && newYear < 3000) {
                    currentHeatmapYear = newYear;
                    if (lastData && lastData.runs) {
                        renderHeatmap(lastData.runs);
                    }
                }
            });
            prevBtn.addEventListener("click", () => {
                if (!prevBtn.disabled) {
                    currentHeatmapYear--;
                    yearSelect.value =
                        currentHeatmapYear.toString();
                    updateYearDropdown();
                    if (lastData && lastData.runs) {
                        renderHeatmap(lastData.runs);
                    }
                }
            });
            nextBtn.addEventListener("click", () => {
                if (!nextBtn.disabled) {
                    currentHeatmapYear++;
                    yearSelect.value =
                        currentHeatmapYear.toString();
                    updateYearDropdown();
                    if (lastData && lastData.runs) {
                        renderHeatmap(lastData.runs);
                    }
                }
            });
            updateYearNavigationVisibility();
        }
        function updateYearDropdown() {
            const yearSelect = document.getElementById("heatmapYearSelect");
            if (!yearSelect)
                return;
            const years = new Set();
            if (lastData && lastData.runs && lastData.runs.length > 0) {
                lastData.runs.forEach((run) => {
                    const year = new Date(run.tsEnd).getFullYear();
                    if (!isNaN(year)) {
                        years.add(year);
                    }
                });
            }
            const currentYear = new Date().getFullYear();
            years.add(currentYear);
            if (currentHeatmapYear && !isNaN(currentHeatmapYear)) {
                years.add(currentHeatmapYear);
            }
            const sortedYears = Array.from(years)
                .filter((year) => !isNaN(year))
                .sort((a, b) => b - a);
            yearSelect.innerHTML = "";
            sortedYears.forEach((year) => {
                const option = document.createElement("option");
                option.value = year.toString();
                option.textContent = year.toString();
                if (year === currentHeatmapYear) {
                    option.selected = true;
                }
                yearSelect.appendChild(option);
            });
            const prevBtn = document.getElementById("heatmapPrevYear");
            const nextBtn = document.getElementById("heatmapNextYear");
            if (prevBtn && sortedYears.length > 0) {
                const minYear = Math.min(...sortedYears);
                prevBtn.disabled = currentHeatmapYear <= minYear;
            }
            if (nextBtn) {
                nextBtn.disabled =
                    currentHeatmapYear >= currentYear + 1;
            }
        }
        function updateYearNavigationVisibility() {
            const yearNav = document.getElementById("heatmapYearNav");
            if (!yearNav)
                return;
            const shouldShow = shouldShowYearNavigation();
            if (shouldShow) {
                yearNav.classList.remove("element-hidden");
            }
            else {
                yearNav.classList.add("element-hidden");
            }
        }
        function shouldShowYearNavigation() {
            if (lastData && lastData.runs && lastData.runs.length > 0) {
                const years = new Set();
                lastData.runs.forEach((run) => {
                    years.add(new Date(run.tsEnd).getFullYear());
                });
                if (years.size > 1)
                    return true;
            }
            if (currentFilters.window === "custom" &&
                currentFilters.customFrom &&
                currentFilters.customTo) {
                const startYear = new Date(currentFilters.customFrom).getFullYear();
                const endYear = new Date(currentFilters.customTo).getFullYear();
                if (startYear !== endYear)
                    return true;
            }
            if (currentFilters.window === "1y" || currentFilters.window === "all") {
                return true;
            }
            return false;
        }
        function renderPerformanceMatrix(commands) {
            const matrix = document.getElementById("performanceMatrix");
            if (!matrix || !commands || commands.length === 0)
                return;
            matrix.innerHTML = "";
            const topCommands = commands.slice(0, 10);
            const header = document.createElement("div");
            header.className = "performance-matrix-header";
            header.innerHTML = `
       <h4>⚡ Performance Overview</h4>
       <p>Your most frequently used commands ranked by performance. Colors indicate relative speed: <span class="speed-fast">Fast</span> (fastest 33%), <span class="speed-medium">Medium</span> (middle 33%), <span class="speed-slow">Slow</span> (slowest 33%)</p>
     `;
            matrix.appendChild(header);
            const grid = document.createElement("div");
            grid.className = "performance-grid";
            matrix.appendChild(grid);
            const durations = topCommands
                .map((cmd) => cmd.avgMs)
                .sort((a, b) => a - b);
            let fastThreshold, slowThreshold;
            if (durations.length >= 3) {
                fastThreshold = durations[Math.floor(durations.length * 0.33)];
                slowThreshold = durations[Math.floor(durations.length * 0.67)];
            }
            else {
                const minDuration = Math.min(...durations);
                const maxDuration = Math.max(...durations);
                const range = maxDuration - minDuration;
                fastThreshold = minDuration + range * 0.33;
                slowThreshold = minDuration + range * 0.67;
            }
            topCommands.forEach((cmd) => {
                const card = document.createElement("div");
                card.className = "performance-card";
                const speedClass = cmd.avgMs <= fastThreshold
                    ? "fast"
                    : cmd.avgMs <= slowThreshold
                        ? "medium"
                        : "slow";
                card.classList.add(`speed-${speedClass}`);
                const maxLength = 30;
                let commandText = cmd.command;
                let isCommandTruncated = false;
                if (cmd.command.length > maxLength) {
                    const truncated = cmd.command.substring(0, maxLength);
                    const lastSpace = truncated.lastIndexOf(" ");
                    if (lastSpace > maxLength * 0.6) {
                        commandText = truncated.substring(0, lastSpace) + "...";
                    }
                    else {
                        commandText = truncated + "...";
                    }
                    isCommandTruncated = true;
                }
                const successRate = Math.round(cmd.successRate * 100);
                const successClass = successRate >= 80
                    ? "success-high"
                    : successRate >= 50
                        ? "success-medium"
                        : "success-low";
                card.innerHTML = `
         <div class="command-name" title="${cmd.command}">${commandText}</div>
         <div class="duration-display">${formatDuration(cmd.avgMs)}</div>
         <div class="stats-row">
           <span class="run-count">${cmd.runs} runs</span>
           <span class="success-rate ${successClass}">${successRate}% ✓</span>
         </div>
       `;
                grid.appendChild(card);
            });
        }
        const savedState = vscode.getState();
        if (savedState && savedState.settings) {
            restoreSettings(savedState.settings);
        }
        loadData();
        const columnMenu = document.querySelector(".column-menu");
        if (columnMenu) {
            columnMenu.classList.add("element-hidden");
        }
        document.querySelectorAll(".multi-select-dropdown").forEach((dd) => {
            dd.classList.add("element-hidden");
        });
    }
})();
//# sourceMappingURL=dashboard.js.map