#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * Bundle all compiled dashboard modules into a single file for the webview
 */
function bundleDashboard() {
  const compiledDir = path.join(__dirname, "../media/compiled");
  const outputFile = path.join(__dirname, "../media/dashboard.js");

  console.log("Bundling dashboard modules...");

  // Read all compiled modules in dependency order
  const moduleOrder = [
    "types.js",
    "formatters.js",
    "state.js",
    "charts.js",
    "tables.js",
    "filters.js",
    "events.js",
    "dashboard-main.js",
  ];

  let bundledContent = "";

  // Add header comment
  bundledContent +=
    "// ProcessLens Dashboard - Bundled from modular TypeScript sources\n";
  bundledContent += "// Generated automatically - do not edit directly\n\n";

  // Process each module
  for (const moduleName of moduleOrder) {
    const modulePath = path.join(compiledDir, moduleName);

    if (!fs.existsSync(modulePath)) {
      console.warn(`Warning: Module ${moduleName} not found, skipping...`);
      continue;
    }

    console.log(`  Adding ${moduleName}...`);

    let moduleContent = fs.readFileSync(modulePath, "utf8");

    // Remove ES module imports/exports and convert to IIFE-compatible code
    moduleContent = processModuleContent(moduleContent, moduleName);

    bundledContent += `\n// === ${moduleName.replace(".js", "")} module ===\n`;
    bundledContent += moduleContent;
    bundledContent += "\n";
  }

  // Write the bundled file
  fs.writeFileSync(outputFile, bundledContent);
  console.log(`Dashboard bundled successfully: ${outputFile}`);

  // Also create a source map reference (simplified)
  const mapFile = outputFile + ".map";
  const simpleMap = {
    version: 3,
    sources: moduleOrder.map((m) => `compiled/${m}`),
    names: [],
    mappings: "",
    file: "dashboard.js",
  };
  fs.writeFileSync(mapFile, JSON.stringify(simpleMap, null, 2));
}

/**
 * Process module content to make it compatible with browser environment
 */
function processModuleContent(content, moduleName) {
  // Remove import statements and convert to global references
  content = content.replace(/^import\s+.*?from\s+['"](.*?)['"];?\s*$/gm, "");

  // Remove export statements and make everything globally available
  content = content.replace(/^export\s+/gm, "");

  // Convert class declarations to global assignments
  content = content.replace(/^class\s+(\w+)/gm, "window.$1 = class $1");

  // Convert const declarations to global assignments for main exports
  if (moduleName === "state.js") {
    content = content.replace(
      /^const\s+dashboardState\s*=/gm,
      "window.dashboardState ="
    );
  }

  // Wrap in IIFE to avoid variable conflicts
  content = `(function() {\n${content}\n})();`;

  return content;
}

// Run the bundler
if (require.main === module) {
  try {
    bundleDashboard();
  } catch (error) {
    console.error("Bundling failed:", error);
    process.exit(1);
  }
}

module.exports = { bundleDashboard };
