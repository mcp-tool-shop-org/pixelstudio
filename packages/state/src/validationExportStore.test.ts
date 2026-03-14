import { describe, it, expect, beforeEach } from 'vitest';
import { useValidationStore } from './validationStore';
import { useExportStore } from './exportStore';

describe('validationStore', () => {
  beforeEach(() => {
    useValidationStore.setState({ currentReport: null, activeIssueId: null, running: false });
  });

  it('starts with no report', () => {
    const s = useValidationStore.getState();
    expect(s.currentReport).toBeNull();
    expect(s.running).toBe(false);
    expect(s.activeIssueId).toBeNull();
  });

  it('setRunning marks running', () => {
    useValidationStore.getState().setRunning(true);
    expect(useValidationStore.getState().running).toBe(true);
  });

  it('setReport stores report and clears running', () => {
    useValidationStore.getState().setRunning(true);
    useValidationStore.getState().setReport({
      id: 'r1',
      timestamp: '2026-01-01',
      issues: [],
      summary: { total: 0, errors: 0, warnings: 0 },
    } as any);
    const s = useValidationStore.getState();
    expect(s.currentReport).toBeDefined();
    expect(s.running).toBe(false);
  });

  it('setActiveIssue selects and clears', () => {
    useValidationStore.getState().setActiveIssue('i1');
    expect(useValidationStore.getState().activeIssueId).toBe('i1');
    useValidationStore.getState().setActiveIssue(null);
    expect(useValidationStore.getState().activeIssueId).toBeNull();
  });
});

describe('exportStore', () => {
  beforeEach(() => {
    useExportStore.setState({ activePresetId: null, exportRunning: false, exportReadiness: 'unknown' });
  });

  it('starts in unknown readiness', () => {
    const s = useExportStore.getState();
    expect(s.exportReadiness).toBe('unknown');
    expect(s.exportRunning).toBe(false);
    expect(s.activePresetId).toBeNull();
  });

  it('setPreset selects and clears', () => {
    useExportStore.getState().setPreset('preset-1');
    expect(useExportStore.getState().activePresetId).toBe('preset-1');
    useExportStore.getState().setPreset(null);
    expect(useExportStore.getState().activePresetId).toBeNull();
  });

  it('setRunning tracks export state', () => {
    useExportStore.getState().setRunning(true);
    expect(useExportStore.getState().exportRunning).toBe(true);
    useExportStore.getState().setRunning(false);
    expect(useExportStore.getState().exportRunning).toBe(false);
  });

  it('setReadiness transitions through states', () => {
    useExportStore.getState().setReadiness('ready');
    expect(useExportStore.getState().exportReadiness).toBe('ready');
    useExportStore.getState().setReadiness('warning');
    expect(useExportStore.getState().exportReadiness).toBe('warning');
    useExportStore.getState().setReadiness('blocked');
    expect(useExportStore.getState().exportReadiness).toBe('blocked');
  });
});
