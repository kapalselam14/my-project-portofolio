import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Keep external dependencies mocked so these tests focus only on page behavior.
const {
  useAnalyticsMock,
  downloadCsvMock,
  setRangeMock,
  reloadMock,
} = vi.hoisted(() => ({
  useAnalyticsMock: vi.fn(),
  downloadCsvMock: vi.fn(),
  setRangeMock: vi.fn(),
  reloadMock: vi.fn(),
}));

vi.mock('../../hooks/useAnalytics', () => ({
  useAnalytics: useAnalyticsMock,
}));

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    toggle: vi.fn(),
  }),
}));

vi.mock('../../utils/csvExport', () => ({
  downloadCsv: downloadCsvMock,
}));

import { AnalyticsPage } from './AnalyticsPage';

// Provides valid analytics data while allowing individual sections to be
// overridden for empty-state and edge-case tests.
function makeData(overrides: Record<string, unknown> = {}) {
  return {
    kpis: [{ label: 'Users', value: '10', change: '+1' }],
    weekly: [
      { day: 'Mon', signups: 10, activities: 100, reports: 5 },
      { day: 'Tue', signups: 20, activities: 200, reports: 10 },
    ],
    topSports: [{ sport: 'Futsal', activities: 5, pct: 100 }],
    retention: [{ label: 'D1', value: 50 }],
    health: [{ label: 'Uptime', value: 99, color: '#0b1f8a' }],
    ...overrides,
  };
}

// Configures the hook as though the analytics request completed successfully.
function mockLoaded(data = makeData(), range = '7d') {
  useAnalyticsMock.mockReturnValue({
    loading: false,
    error: null,
    data,
    range,
    setRange: setRangeMock,
    reload: reloadMock,
  });
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    // Reset mock call history and implementations between tests.
    vi.clearAllMocks();
  });

  it('renders the loading state', () => {
    useAnalyticsMock.mockReturnValue({
      loading: true,
      error: null,
      data: null,
      range: '7d',
      setRange: setRangeMock,
      reload: reloadMock,
    });

    const { container } = render(<AnalyticsPage />);

    // The page should display its skeleton instead of analytics content.
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
  });

  it('renders the API error and retries successfully', async () => {
    useAnalyticsMock.mockReturnValue({
      loading: false,
      error: 'Analytics unavailable',
      data: null,
      range: '7d',
      setRange: setRangeMock,
      reload: reloadMock,
    });

    const user = userEvent.setup();
    render(<AnalyticsPage />);

    expect(
      screen.getByText('Failed to load: Analytics unavailable'),
    ).toBeInTheDocument();

    // Retry delegates to the hook rather than issuing a request directly.
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('renders empty states for retention and health series', () => {
    mockLoaded(makeData({ retention: [], health: [] }));

    render(<AnalyticsPage />);

    // Both series are intentionally empty until the analytics event pipeline
    // is implemented, so each section must show its own empty state.
    expect(
      screen.getAllByText('No data yet — events not collected'),
    ).toHaveLength(2);
  });

  it('changes the analytics range', async () => {
    mockLoaded(makeData(), '7d');

    const user = userEvent.setup();
    render(<AnalyticsPage />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Analytics date range' }),
      '30d',
    );

    expect(setRangeMock).toHaveBeenCalledWith('30d');
  });

  it('exports the weekly analytics as CSV', async () => {
    const data = makeData();
    mockLoaded(data, '7d');

    const user = userEvent.setup();
    render(<AnalyticsPage />);

    await user.click(screen.getByRole('button', { name: 'Export' }));

    // Verify both the transformed rows and the range-specific filename.
    expect(downloadCsvMock).toHaveBeenCalledTimes(1);
    expect(downloadCsvMock).toHaveBeenCalledWith(
      [
        {
          Day: 'Mon',
          Signups: 10,
          Activities: 100,
          Reports: 5,
          Range: '7d',
        },
        {
          Day: 'Tue',
          Signups: 20,
          Activities: 200,
          Reports: 10,
          Range: '7d',
        },
      ],
      'matchup-analytics-7d.csv',
    );
  });

  it('renders the shared-scale line chart with all series', () => {
    mockLoaded();

    const { container } = render(<AnalyticsPage />);

    expect(
      screen.getByRole('img', { name: 'Analytics chart' }),
    ).toBeInTheDocument();

    // The chart should render one polyline for signups, activities, and reports.
    const polylines = container.querySelectorAll('polyline');
    expect(polylines).toHaveLength(3);

    // All series use the largest value across every series as their maximum.
    // Here, 200 is the maximum, so the activities line reaches y=10.
    const points = Array.from(polylines).map((line) =>
      line.getAttribute('points'),
    );

    expect(points).toContain('4,83 596,10');
  });
});
