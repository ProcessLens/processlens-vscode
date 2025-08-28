// Filter management for ProcessLens Dashboard
import { Filters } from "./types.js";
import { dashboardState } from "./state.js";

export class FilterManager {
  public static setupMultiSelectDropdown(
    filterType: string,
    placeholder: string
  ): void {
    const display = document.getElementById(`${filterType}FilterDisplay`);
    const dropdown = document.getElementById(`${filterType}FilterDropdown`);

    if (!display || !dropdown) return;

    // Toggle dropdown on display click
    display.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = dropdown.classList.contains("element-hidden");

      // Close all other dropdowns
      document.querySelectorAll(".multi-select-dropdown").forEach((dd) => {
        dd.classList.add("element-hidden");
      });

      // Toggle this dropdown
      dropdown.classList.toggle("element-hidden", !isHidden);
    });

    // Add change event listener like original
    dropdown.addEventListener("change", (event) => {
      const target = event.target as HTMLInputElement;
      if (target && target.type === "checkbox") {
        console.log(
          `Checkbox change detected for ${filterType}:`,
          target.id,
          target.checked
        );
        // Store the target for the handler to access
        (window as any).currentChangeTarget = target;
        FilterManager.handleMultiSelectChange(
          filterType,
          FilterManager.getPlaceholderText(filterType)
        );
        (window as any).currentChangeTarget = null;
      }
    });

    // Consolidated click handler for better reliability (like original)
    dropdown.addEventListener("click", (e) => {
      e.stopPropagation();

      const target = e.target as HTMLElement;
      let checkbox: HTMLInputElement | null = null;

      // Find the checkbox based on what was clicked (like original)
      if (
        target.tagName === "INPUT" &&
        (target as HTMLInputElement).type === "checkbox"
      ) {
        // Direct checkbox click - let the change event handle it
        return;
      } else if (target.tagName === "LABEL") {
        // For label clicks, let the browser handle the natural label-checkbox association
        // The change event will be triggered automatically
        return;
      } else if (target.classList.contains("multi-select-option")) {
        // Only handle container clicks (not label or checkbox)
        checkbox = target.querySelector(
          'input[type="checkbox"]'
        ) as HTMLInputElement;

        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          // Trigger change event manually to ensure it's processed
          const changeEvent = new Event("change", { bubbles: true });
          checkbox.dispatchEvent(changeEvent);
        }
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", () => {
      dropdown.classList.add("element-hidden");
    });
  }

  public static handleMultiSelectChange(
    filterType: string,
    allText: string
  ): void {
    const dropdown = document.getElementById(`${filterType}FilterDropdown`);
    const display = document.getElementById(`${filterType}FilterDisplay`);

    if (!dropdown || !display) return;

    const allCheckbox = dropdown.querySelector(
      'input[id$="-all"]'
    ) as HTMLInputElement;
    const otherCheckboxes = dropdown.querySelectorAll(
      'input[type="checkbox"]:not([id$="-all"])'
    ) as NodeListOf<HTMLInputElement>;

    // Get the target from our stored reference (more reliable than global event context)
    const target = (window as any).currentChangeTarget as HTMLInputElement;

    if (!target) return;

    console.log(`Multi-select change for ${filterType}:`, {
      target: target.id,
      checked: target.checked,
      isAll: target === allCheckbox,
      allCheckboxState: allCheckbox?.checked,
      otherCheckboxCount: Array.from(otherCheckboxes).filter((cb) => cb.checked)
        .length,
    });

    // Prevent updateFilters from being called during this function to avoid race conditions
    let shouldUpdateFilters = true;

    // If "All" was clicked (like original logic)
    if (target === allCheckbox) {
      if (allCheckbox.checked) {
        // Uncheck all others
        otherCheckboxes.forEach((cb) => (cb.checked = false));
        display.textContent = allText;
      } else {
        // If "All" was unchecked, don't allow it (always need something selected)
        allCheckbox.checked = true;
        shouldUpdateFilters = false; // Don't update filters if we're reverting
        return;
      }
    } else {
      // If any other checkbox was clicked (like original logic)
      if (target.checked) {
        // Uncheck "All" when selecting specific items
        console.log(
          `Before unchecking All: otherCheckboxes checked count = ${
            Array.from(otherCheckboxes).filter((cb) => cb.checked).length
          }`
        );
        if (allCheckbox) {
          console.log(`Unchecking "All" checkbox`);
          allCheckbox.checked = false;
        }
        console.log(
          `After unchecking All: otherCheckboxes checked count = ${
            Array.from(otherCheckboxes).filter((cb) => cb.checked).length
          }`
        );
      }

      // Update display text based on current selections
      const checkedOthers = Array.from(otherCheckboxes).filter(
        (cb) => cb.checked
      );

      console.log(`Checked boxes count after change: ${checkedOthers.length}`);
      console.log(
        `Checked box IDs:`,
        checkedOthers.map((cb) => cb.id)
      );

      if (checkedOthers.length === 0) {
        // If nothing is selected, revert to "All"
        if (allCheckbox) {
          allCheckbox.checked = true;
          display.textContent = allText;
        }
      } else if (checkedOthers.length === 1) {
        // Show single selection
        const label = checkedOthers[0].nextElementSibling as HTMLLabelElement;
        const labelText = label?.textContent || checkedOthers[0].value;
        display.textContent =
          labelText && labelText.length > 25
            ? labelText.substring(0, 25) + "..."
            : labelText || "";
      } else {
        // Show count
        display.textContent = `${checkedOthers.length} selected`;
      }
    }

    // Only update filters if we should
    if (shouldUpdateFilters) {
      console.log(`Updating filters for ${filterType}`);
      FilterManager.updateFilters();
    }
  }

  public static getMultiSelectValues(filterType: string): string[] | undefined {
    const dropdown = document.getElementById(`${filterType}FilterDropdown`);
    if (!dropdown) return undefined;

    const checkboxes = dropdown.querySelectorAll(
      'input[type="checkbox"]:checked'
    );

    // Get all checked values using data-value from parent element (like original)
    const allValues = Array.from(checkboxes)
      .map((cb) => cb.parentElement?.getAttribute("data-value"))
      .filter((value): value is string => value !== null);

    // Handle success filter specially (uses "all" instead of "")
    const isSuccessFilter = filterType === "success";
    const allValue = isSuccessFilter ? "all" : "";

    // Filter out the "All" option to get only specific selections
    const specificValues = allValues.filter((v) => v !== allValue);

    console.log(`getMultiSelectValues for ${filterType}:`, {
      allValues,
      specificValues,
      hasAll: allValues.includes(allValue),
      hasSpecific: specificValues.length > 0,
      isSuccessFilter,
      allValue,
    });

    // If "All" is checked OR no checkboxes are checked, return undefined (no filter)
    // Exception: success filter returns "all" when All is selected
    if (allValues.includes(allValue) || allValues.length === 0) {
      return isSuccessFilter && allValues.includes(allValue)
        ? ["all"]
        : undefined;
    }

    // Return specific values only
    return specificValues.length > 0 ? specificValues : undefined;
  }

  public static getPlaceholderText(filterType: string): string {
    switch (filterType) {
      case "project":
        return "All Projects";
      case "command":
        return "All Commands";
      case "success":
        return "All";
      case "device":
        return "All Devices";
      default:
        return "All";
    }
  }

  public static updateFilters(): void {
    // Get filter values and convert empty arrays to undefined
    const projectValues = FilterManager.getMultiSelectValues("project");
    const commandValues = FilterManager.getMultiSelectValues("command");
    const successValues = FilterManager.getMultiSelectValues("success");
    const deviceValues = FilterManager.getMultiSelectDeviceInstances();

    dashboardState.currentFilters = {
      projectId:
        projectValues && projectValues.length > 0 ? projectValues : undefined,
      command:
        commandValues && commandValues.length > 0 ? commandValues : undefined,
      success:
        successValues && successValues.length > 0 ? successValues : "all",
      window: FilterManager.getTimeRangeValue(),
      customFrom: FilterManager.getCustomFromDate(),
      customTo: FilterManager.getCustomToDate(),
      deviceInstance:
        deviceValues && deviceValues.length > 0 ? deviceValues : undefined,
    };

    dashboardState.saveCurrentSettings();
    FilterManager.loadData();
  }

  public static getTimeRangeValue(): string {
    const selected = document.querySelector(
      '.time-range-option[data-selected="true"]'
    );
    return selected ? selected.getAttribute("data-value") || "all" : "all";
  }

  public static getCustomFromDate(): string | undefined {
    const input = document.getElementById("customFromDate") as HTMLInputElement;
    return input?.value || undefined;
  }

  public static getCustomToDate(): string | undefined {
    const input = document.getElementById("customToDate") as HTMLInputElement;
    return input?.value || undefined;
  }

  public static getMultiSelectDeviceInstances(): any {
    const values = FilterManager.getMultiSelectValues("device");
    console.log(`getMultiSelectDeviceInstances: raw values =`, values);
    if (!values || values.length === 0) return undefined;

    // Parse device instances from specific values (like original)
    const parsed = values
      .map((value) => FilterManager.parseDeviceInstance(value))
      .filter(Boolean);
    console.log(`getMultiSelectDeviceInstances: parsed =`, parsed);
    return parsed;
  }

  private static parseDeviceInstance(
    value: string
  ): { deviceId: any; hardwareHash: any } | null {
    if (!value) return null;
    const [deviceId, hardwareHash] = value.split("|");
    return deviceId && hardwareHash ? { deviceId, hardwareHash } : null;
  }

  public static setupTimeRangeDropdown(): void {
    const display = document.getElementById("timeRangeDisplay");
    const dropdown = document.getElementById("timeRangeDropdown");

    if (!display || !dropdown) return;

    // Toggle dropdown
    display.addEventListener("click", (e) => {
      e.stopPropagation();

      // Close other dropdowns first
      document.querySelectorAll(".multi-select-dropdown").forEach((dd) => {
        dd.classList.add("element-hidden");
      });

      dropdown.classList.toggle("element-hidden");
    });

    // Handle relative time range option clicks
    dropdown.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      if (
        target.classList.contains("time-range-option") &&
        target.getAttribute("data-type") === "relative"
      ) {
        FilterManager.selectRelativeTimeRange(target, display, dropdown);
      }
    });

    // Handle custom range application
    const applyBtn = document.getElementById("applyCustomRange");
    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        FilterManager.applyCustomTimeRange(display, dropdown);
      });
    }

    // Handle custom date input changes (clear relative selection when user types)
    const fromInput = document.getElementById(
      "customFromDate"
    ) as HTMLInputElement;
    const toInput = document.getElementById("customToDate") as HTMLInputElement;

    if (fromInput && toInput) {
      [fromInput, toInput].forEach((input) => {
        input.addEventListener("input", () => {
          if (input.value) {
            // Clear relative selections when user starts typing custom dates
            dropdown
              .querySelectorAll(".time-range-option[data-type='relative']")
              .forEach((opt) => {
                opt.removeAttribute("data-selected");
              });
          }
        });
      });
    }

    // Close on outside click
    document.addEventListener("click", () => {
      dropdown.classList.add("element-hidden");
    });
  }

  private static selectRelativeTimeRange(
    target: HTMLElement,
    display: HTMLElement,
    dropdown: HTMLElement
  ): void {
    // Clear all relative selections
    dropdown
      .querySelectorAll(".time-range-option[data-type='relative']")
      .forEach((opt) => {
        opt.removeAttribute("data-selected");
      });

    // Clear custom date inputs when selecting relative range
    const fromInput = document.getElementById(
      "customFromDate"
    ) as HTMLInputElement;
    const toInput = document.getElementById("customToDate") as HTMLInputElement;
    if (fromInput) fromInput.value = "";
    if (toInput) toInput.value = "";

    // Set new relative selection
    target.setAttribute("data-selected", "true");
    display.textContent = target.textContent || "All Time";

    console.log(
      `Selected relative time range: ${target.getAttribute("data-value")}`
    );

    // Close dropdown and update filters
    dropdown.classList.add("element-hidden");
    FilterManager.updateFilters();
  }

  private static applyCustomTimeRange(
    display: HTMLElement,
    dropdown: HTMLElement
  ): void {
    const fromInput = document.getElementById(
      "customFromDate"
    ) as HTMLInputElement;
    const toInput = document.getElementById("customToDate") as HTMLInputElement;

    if (!fromInput?.value || !toInput?.value) {
      // Show error if dates are missing
      console.warn("Both from and to dates are required for custom range");
      return;
    }

    // Validate date range
    const fromDate = new Date(fromInput.value);
    const toDate = new Date(toInput.value);

    if (fromDate > toDate) {
      console.warn("From date cannot be after to date");
      return;
    }

    // Clear all relative selections when applying custom range
    dropdown
      .querySelectorAll(".time-range-option[data-type='relative']")
      .forEach((opt) => {
        opt.removeAttribute("data-selected");
      });

    // Format display text
    const fromFormatted = fromDate.toLocaleDateString();
    const toFormatted = toDate.toLocaleDateString();
    display.textContent = `${fromFormatted} to ${toFormatted}`;

    console.log(
      `Applied custom time range: ${fromInput.value} to ${toInput.value}`
    );

    // Close dropdown and update filters
    dropdown.classList.add("element-hidden");
    FilterManager.updateFilters();
  }

  public static clearAllFilters(): void {
    // Reset all multi-select dropdowns
    document
      .querySelectorAll('.multi-select-dropdown input[type="checkbox"]')
      .forEach((cb) => {
        const checkbox = cb as HTMLInputElement;
        checkbox.checked = checkbox.id.endsWith("-all");
      });

    // Reset time range to default (7 days)
    document
      .querySelectorAll(".time-range-option[data-type='relative']")
      .forEach((opt) => {
        opt.removeAttribute("data-selected");
      });
    const defaultTimeRange = document.querySelector(
      '.time-range-option[data-value="7d"]'
    );
    if (defaultTimeRange) {
      defaultTimeRange.setAttribute("data-selected", "true");
    }

    // Clear custom dates
    const fromInput = document.getElementById(
      "customFromDate"
    ) as HTMLInputElement;
    const toInput = document.getElementById("customToDate") as HTMLInputElement;
    if (fromInput) fromInput.value = "";
    if (toInput) toInput.value = "";

    // Update displays
    document.getElementById("projectFilterDisplay")!.textContent =
      "All Projects";
    document.getElementById("commandFilterDisplay")!.textContent =
      "All Commands";
    document.getElementById("successFilterDisplay")!.textContent = "All";
    document.getElementById("deviceFilterDisplay")!.textContent = "All Devices";
    document.getElementById("timeRangeDisplay")!.textContent = "Last 7 Days";

    // Reset state and reload
    dashboardState.reset();
    FilterManager.loadData();
  }

  public static loadData(): void {
    if (dashboardState.isLoadingData) return;

    dashboardState.isLoadingData = true;

    // Debug logging
    console.log("Loading data with filters:", dashboardState.currentFilters);

    // Show loading state
    document.querySelector(".loading")?.classList.remove("element-hidden");
    document.querySelector(".cards")?.classList.add("element-hidden");

    // Send message to extension
    const vscode = (window as any).vscode;
    vscode.postMessage({
      type: "LOAD",
      filters: dashboardState.currentFilters,
    });
  }

  public static populateFilterOptions(data: any): void {
    FilterManager.populateProjectFilter(data.projects || []);
    FilterManager.populateCommandFilter(data.commands || []);
    FilterManager.populateDeviceFilter(data.devices || []);
  }

  private static populateProjectFilter(projects: any[]): void {
    const dropdown = document.getElementById("projectFilterDropdown");
    if (!dropdown) return;

    // Preserve existing checkbox states before removing options
    const existingStates = new Map<string, boolean>();
    const existingOptions = dropdown.querySelectorAll(
      '.multi-select-option:not([data-value=""])'
    );
    existingOptions.forEach((opt) => {
      const checkbox = opt.querySelector(
        'input[type="checkbox"]'
      ) as HTMLInputElement;
      if (checkbox) {
        existingStates.set(checkbox.value, checkbox.checked);
      }
      opt.remove();
    });

    projects.forEach((project) => {
      // Handle both string and object formats
      let projectValue: string;
      let projectLabel: string;

      if (typeof project === "string") {
        projectValue = project;
        projectLabel = project;
      } else if (project && typeof project === "object") {
        projectValue = project.value || project.projectId || String(project);
        projectLabel =
          project.label ||
          project.projectName ||
          project.value ||
          String(project);
      } else {
        projectValue = String(project);
        projectLabel = String(project);
      }

      const option = document.createElement("div");
      option.className = "multi-select-option";
      option.setAttribute("data-value", projectValue);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `project-${projectValue.replace(/[^a-zA-Z0-9]/g, "_")}`;
      checkbox.value = projectValue;
      // Restore previous checkbox state if it existed
      checkbox.checked = existingStates.get(projectValue) || false;

      const label = document.createElement("label");
      label.setAttribute("for", checkbox.id);
      label.textContent = projectLabel;

      option.appendChild(checkbox);
      option.appendChild(label);
      dropdown.appendChild(option);
    });
  }

  private static populateCommandFilter(commands: any[]): void {
    const dropdown = document.getElementById("commandFilterDropdown");
    if (!dropdown) return;

    // Preserve existing checkbox states before removing options
    const existingStates = new Map<string, boolean>();
    const existingOptions = dropdown.querySelectorAll(
      '.multi-select-option:not([data-value=""])'
    );
    existingOptions.forEach((opt) => {
      const checkbox = opt.querySelector(
        'input[type="checkbox"]'
      ) as HTMLInputElement;
      if (checkbox) {
        existingStates.set(checkbox.value, checkbox.checked);
      }
      opt.remove();
    });

    commands.forEach((command) => {
      // Handle both string and object formats
      let commandValue: string;
      let commandLabel: string;

      if (typeof command === "string") {
        commandValue = command;
        commandLabel = command;
      } else if (command && typeof command === "object") {
        commandValue = command.value || command.command || String(command);
        commandLabel =
          command.label || command.command || command.value || String(command);
      } else {
        commandValue = String(command);
        commandLabel = String(command);
      }

      const option = document.createElement("div");
      option.className = "multi-select-option";
      option.setAttribute("data-value", commandValue);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `command-${commandValue.replace(/[^a-zA-Z0-9]/g, "_")}`;
      checkbox.value = commandValue;
      // Restore previous checkbox state if it existed
      checkbox.checked = existingStates.get(commandValue) || false;

      const label = document.createElement("label");
      label.setAttribute("for", checkbox.id);
      label.textContent =
        commandLabel.length > 40
          ? commandLabel.substring(0, 37) + "..."
          : commandLabel;
      label.title = commandLabel;

      option.appendChild(checkbox);
      option.appendChild(label);
      dropdown.appendChild(option);
    });
  }

  private static populateDeviceFilter(devices: any[]): void {
    const dropdown = document.getElementById("deviceFilterDropdown");
    if (!dropdown) return;

    // Preserve existing checkbox states before removing options
    const existingStates = new Map<string, boolean>();
    const existingOptions = dropdown.querySelectorAll(
      '.multi-select-option:not([data-value=""])'
    );
    existingOptions.forEach((opt) => {
      const checkbox = opt.querySelector(
        'input[type="checkbox"]'
      ) as HTMLInputElement;
      if (checkbox) {
        existingStates.set(checkbox.value, checkbox.checked);
      }
      opt.remove();
    });

    devices.forEach((device, index) => {
      // Handle device format: { value: "deviceId|hardwareHash", label: "Device Name" }
      let deviceValue: string;
      let deviceLabel: string;

      if (typeof device === "string") {
        deviceValue = device;
        deviceLabel = device;
      } else if (device && typeof device === "object") {
        deviceValue = device.value || String(device);
        deviceLabel = device.label || device.value || String(device);
      } else {
        deviceValue = String(device);
        deviceLabel = String(device);
      }

      const option = document.createElement("div");
      option.className = "multi-select-option";
      option.setAttribute("data-value", deviceValue);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `device-${index}`;
      checkbox.value = deviceValue;
      // Restore previous checkbox state if it existed
      checkbox.checked = existingStates.get(deviceValue) || false;

      const label = document.createElement("label");
      label.setAttribute("for", checkbox.id);
      label.textContent = deviceLabel;

      option.appendChild(checkbox);
      option.appendChild(label);
      dropdown.appendChild(option);
    });
  }
}
