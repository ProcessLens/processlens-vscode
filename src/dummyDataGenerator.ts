import { EventRecord } from "./storage";
import { v4 as uuidv4 } from "uuid";

/**
 * Generates realistic dummy data for testing ProcessLens with large datasets
 */
export class DummyDataGenerator {
  private readonly commonCommands = [
    "npm run build",
    "npm run test",
    "npm run dev",
    "npm run lint",
    "npm run start",
    "yarn build",
    "yarn test",
    "yarn dev",
    "yarn lint",
    "yarn start",
    "pnpm build",
    "pnpm test",
    "pnpm dev",
    "git status",
    "git add .",
    'git commit -m "update"',
    "git push",
    "git pull",
    "docker build .",
    "docker-compose up",
    "make build",
    "make test",
    "make clean",
    "cargo build",
    "cargo test",
    "go build",
    "go test",
    "python -m pytest",
    "python setup.py build",
    "mvn compile",
    "mvn test",
    "gradle build",
    "gradle test",
    "tsc --build",
    "webpack --mode production",
    "rollup -c",
    "vite build",
    "next build",
    "nuxt build",
    "ng build",
    "vue-cli-service build",
  ];

  private readonly projectNames = [
    "my-awesome-app",
    "backend-api",
    "frontend-dashboard",
    "mobile-app",
    "data-processor",
    "auth-service",
    "payment-gateway",
    "notification-service",
    "analytics-engine",
    "user-management",
  ];

  private readonly devices = [
    {
      deviceId: uuidv4(),
      hardwareHash: "macos-arm64-apple-m1-8core-16gb",
      device: {
        os: "macOS 14.0.0",
        arch: "arm64",
        cpuModel: "Apple M1",
        cpus: 8,
        memGB: 16,
        node: "v18.17.0",
      },
      performance: 2.4, // For calculation purposes
    },
    {
      deviceId: uuidv4(),
      hardwareHash: "macos-arm64-apple-m2-10core-32gb",
      device: {
        os: "macOS 14.1.0",
        arch: "arm64",
        cpuModel: "Apple M2 Pro",
        cpus: 10,
        memGB: 32,
        node: "v20.9.0",
      },
      performance: 3.2,
    },
    {
      deviceId: uuidv4(),
      hardwareHash: "windows-x64-intel-i7-8core-32gb",
      device: {
        os: "Windows 11",
        arch: "x64",
        cpuModel: "Intel Core i7-12700K",
        cpus: 8,
        memGB: 32,
        node: "v18.18.2",
      },
      performance: 2.8,
    },
    {
      deviceId: uuidv4(),
      hardwareHash: "linux-x64-amd-ryzen-16core-64gb",
      device: {
        os: "Ubuntu 22.04",
        arch: "x64",
        cpuModel: "AMD Ryzen 9 5950X",
        cpus: 16,
        memGB: 64,
        node: "v20.10.0",
      },
      performance: 4.0,
    },
  ];

  /**
   * Generate realistic duration based on command type and device performance
   */
  private generateDuration(command: string, devicePerformance: number): number {
    let baseDuration: number;

    // Different commands have different typical durations
    if (
      command.includes("build") ||
      command.includes("webpack") ||
      command.includes("rollup")
    ) {
      baseDuration = 15000 + Math.random() * 45000; // 15-60 seconds
    } else if (command.includes("test")) {
      baseDuration = 5000 + Math.random() * 25000; // 5-30 seconds
    } else if (command.includes("lint")) {
      baseDuration = 2000 + Math.random() * 8000; // 2-10 seconds
    } else if (command.includes("git") || command.includes("status")) {
      baseDuration = 100 + Math.random() * 2000; // 0.1-2 seconds
    } else if (command.includes("docker")) {
      baseDuration = 10000 + Math.random() * 120000; // 10-120 seconds
    } else {
      baseDuration = 1000 + Math.random() * 10000; // 1-10 seconds
    }

    // Apply device performance multiplier (higher = faster)
    const duration = baseDuration / devicePerformance;

    // Add some random variation (±20%)
    const variation = 0.8 + Math.random() * 0.4;

    return Math.round(duration * variation);
  }

  /**
   * Generate success rate based on command type
   */
  private generateSuccess(command: string): boolean {
    let successRate: number;

    if (command.includes("git status") || command.includes("git pull")) {
      successRate = 0.98; // Very reliable
    } else if (command.includes("test")) {
      successRate = 0.85; // Tests can fail
    } else if (command.includes("build")) {
      successRate = 0.92; // Builds occasionally fail
    } else if (command.includes("lint")) {
      successRate = 0.88; // Linting can find issues
    } else if (command.includes("docker")) {
      successRate = 0.9; // Docker can have issues
    } else {
      successRate = 0.95; // Most commands succeed
    }

    return Math.random() < successRate;
  }

  /**
   * Generate dummy data for testing
   */
  public generateDummyData(
    numRecords: number = 1000,
    daysBack: number = 30
  ): EventRecord[] {
    const records: EventRecord[] = [];
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;

    for (let i = 0; i < numRecords; i++) {
      // Generate random timestamp within the specified range
      const daysAgo = Math.random() * daysBack;
      const tsStart = now - daysAgo * msPerDay;

      // Pick random command, project, and device
      const command =
        this.commonCommands[
          Math.floor(Math.random() * this.commonCommands.length)
        ];
      const projectName =
        this.projectNames[Math.floor(Math.random() * this.projectNames.length)];
      const device =
        this.devices[Math.floor(Math.random() * this.devices.length)];

      // Use pre-calculated device performance score
      const devicePerformance = device.performance;

      const durationMs = this.generateDuration(command, devicePerformance);
      const success = this.generateSuccess(command);
      const tsEnd = tsStart + durationMs;

      // Generate project ID (deterministic based on project name)
      const projectId = `proj-${projectName.replace(/[^a-z0-9]/g, "-")}`;

      const record: EventRecord = {
        tsStart,
        tsEnd,
        durationMs,
        exitCode: success ? 0 : Math.floor(Math.random() * 3) + 1,
        command,
        cwd: `/workspace/${projectName}`,
        projectId,
        projectName,
        deviceId: device.deviceId,
        hardwareHash: device.hardwareHash,
        device: device.device,
      };

      records.push(record);
    }

    // Sort by timestamp (oldest first)
    records.sort((a, b) => a.tsStart - b.tsStart);

    return records;
  }

  /**
   * Generate performance trend data (simulates performance degradation/improvement over time)
   */
  public generateTrendData(
    command: string,
    projectName: string,
    device: any,
    startDate: Date,
    endDate: Date,
    numRuns: number = 50,
    trendType: "improving" | "degrading" | "stable" = "stable"
  ): EventRecord[] {
    const records: EventRecord[] = [];
    const timeSpan = endDate.getTime() - startDate.getTime();
    const baseDevicePerformance = device.performance;

    for (let i = 0; i < numRuns; i++) {
      const progress = i / (numRuns - 1); // 0 to 1
      const tsStart = startDate.getTime() + progress * timeSpan;

      // Apply trend
      let performanceMultiplier = 1.0;
      if (trendType === "improving") {
        performanceMultiplier = 0.7 + progress * 0.6; // 70% to 130% performance
      } else if (trendType === "degrading") {
        performanceMultiplier = 1.3 - progress * 0.6; // 130% to 70% performance
      } else {
        performanceMultiplier = 0.9 + Math.random() * 0.2; // 90% to 110% (stable with noise)
      }

      const adjustedPerformance = baseDevicePerformance * performanceMultiplier;
      const durationMs = this.generateDuration(command, adjustedPerformance);
      const success = this.generateSuccess(command);
      const tsEnd = tsStart + durationMs;

      const projectId = `proj-${projectName.replace(/[^a-z0-9]/g, "-")}`;

      const record: EventRecord = {
        tsStart,
        tsEnd,
        durationMs,
        exitCode: success ? 0 : Math.floor(Math.random() * 3) + 1,
        command,
        cwd: `/workspace/${projectName}`,
        projectId,
        projectName,
        deviceId: device.deviceId,
        hardwareHash: device.hardwareHash,
        device: device.device,
      };

      records.push(record);
    }

    return records;
  }
}
