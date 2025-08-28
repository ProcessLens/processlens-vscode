import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JsonlEventStore } from '../../src/storage';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('JsonlEventStore', () => {
  let tempDir: string;
  let store: JsonlEventStore;
  let mockContext: any;

  beforeEach(() => {
    // Create temporary directory for test storage
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'processlens-test-'));
    
    // Mock VS Code context
    mockContext = {
      globalStorageUri: {
        fsPath: tempDir
      }
    };
    
    store = new JsonlEventStore(mockContext);
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Event Storage', () => {
    it('should save and retrieve events', async () => {
      const testEvent = {
        tsStart: Date.now() - 1000,
        tsEnd: Date.now(),
        durationMs: 1000,
        exitCode: 0,
        command: 'npm test',
        cwd: '/test/project',
        projectId: 'test-project',
        projectName: 'Test Project',
        deviceId: 'test-device',
        hardwareHash: 'test-hash'
      };

      // Save event
      await store.saveEvent(testEvent);

      // Retrieve events
      const events = await store.getEvents();
      
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject(testEvent);
    });

    it('should handle multiple events', async () => {
      const events = [
        {
          tsStart: Date.now() - 2000,
          tsEnd: Date.now() - 1000,
          durationMs: 1000,
          exitCode: 0,
          command: 'npm test',
          cwd: '/test/project',
          projectId: 'test-project',
          projectName: 'Test Project',
          deviceId: 'test-device',
          hardwareHash: 'test-hash'
        },
        {
          tsStart: Date.now() - 1000,
          tsEnd: Date.now(),
          durationMs: 1000,
          exitCode: 1,
          command: 'npm build',
          cwd: '/test/project',
          projectId: 'test-project',
          projectName: 'Test Project',
          deviceId: 'test-device',
          hardwareHash: 'test-hash'
        }
      ];

      // Save multiple events
      for (const event of events) {
        await store.saveEvent(event);
      }

      // Retrieve and verify
      const retrievedEvents = await store.getEvents();
      expect(retrievedEvents).toHaveLength(2);
    });

    it('should filter events correctly', async () => {
      const events = [
        {
          tsStart: Date.now() - 2000,
          tsEnd: Date.now() - 1000,
          durationMs: 1000,
          exitCode: 0,
          command: 'npm test',
          cwd: '/test/project1',
          projectId: 'project1',
          projectName: 'Project 1',
          deviceId: 'device1',
          hardwareHash: 'hash1'
        },
        {
          tsStart: Date.now() - 1000,
          tsEnd: Date.now(),
          durationMs: 500,
          exitCode: 0,
          command: 'npm build',
          cwd: '/test/project2',
          projectId: 'project2',
          projectName: 'Project 2',
          deviceId: 'device1',
          hardwareHash: 'hash1'
        }
      ];

      for (const event of events) {
        await store.saveEvent(event);
      }

      // Test project filtering
      const project1Events = await store.getEvents({
        projectId: 'project1'
      });
      expect(project1Events).toHaveLength(1);
      expect(project1Events[0].projectId).toBe('project1');

      // Test command filtering
      const testEvents = await store.getEvents({
        command: 'npm test'
      });
      expect(testEvents).toHaveLength(1);
      expect(testEvents[0].command).toBe('npm test');
    });
  });

  describe('Data Integrity', () => {
    it('should handle malformed JSONL gracefully', async () => {
      // Write malformed JSONL to file
      const filePath = path.join(tempDir, 'events.jsonl');
      const malformedContent = `{"valid": "json"}
invalid json line
{"another": "valid", "line": true}`;
      
      fs.writeFileSync(filePath, malformedContent);

      // Should only return valid JSON lines
      const events = await store.getEvents();
      expect(events).toHaveLength(2);
    });

    it('should preserve data types correctly', async () => {
      const testEvent = {
        tsStart: 1640995200000, // Specific timestamp
        tsEnd: 1640995201000,
        durationMs: 1000,
        exitCode: 0,
        command: 'test command',
        cwd: '/test/path',
        projectId: 'test-id',
        projectName: 'Test Name',
        deviceId: 'device-123',
        hardwareHash: 'hash-456'
      };

      await store.saveEvent(testEvent);
      const events = await store.getEvents();
      
      expect(typeof events[0].tsStart).toBe('number');
      expect(typeof events[0].durationMs).toBe('number');
      expect(typeof events[0].exitCode).toBe('number');
      expect(events[0].tsStart).toBe(testEvent.tsStart);
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const startTime = Date.now();
      
      // Generate 1000 test events
      const events = Array.from({ length: 1000 }, (_, i) => ({
        tsStart: Date.now() - (1000 - i) * 1000,
        tsEnd: Date.now() - (1000 - i - 1) * 1000,
        durationMs: Math.random() * 5000,
        exitCode: Math.random() > 0.1 ? 0 : 1,
        command: `test-command-${i % 10}`,
        cwd: `/test/project${i % 3}`,
        projectId: `project${i % 3}`,
        projectName: `Project ${i % 3}`,
        deviceId: 'test-device',
        hardwareHash: 'test-hash'
      }));

      // Save all events
      for (const event of events) {
        await store.saveEvent(event);
      }

      // Retrieve and measure time
      const retrieveStart = Date.now();
      const retrievedEvents = await store.getEvents();
      const retrieveTime = Date.now() - retrieveStart;

      expect(retrievedEvents).toHaveLength(1000);
      expect(retrieveTime).toBeLessThan(1000); // Should be fast
    });
  });
});
