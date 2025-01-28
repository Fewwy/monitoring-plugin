/* eslint-disable max-len */
import { useEffect, useState } from 'react';
import { setIncidentsActiveFilters } from '../../actions/observe';
import global_danger_color_100 from '@patternfly/react-tokens/dist/esm/global_danger_color_100';
import global_info_color_100 from '@patternfly/react-tokens/dist/esm/global_info_color_100';
import global_warning_color_100 from '@patternfly/react-tokens/dist/esm/global_warning_color_100';

function consolidateAndMergeIntervals(data, dateArray) {
  const severityRank = { 2: 2, 1: 1, 0: 0 };

  // Process and filter the input data
  const filteredValues = filterAndSortValues(data, severityRank);

  // Generate the intervals, including nodata gaps
  const intervals = generateIntervalsWithGaps(filteredValues, dateArray);

  return intervals;
}

function filterAndSortValues(data, severityRank) {
  // Eliminate overlapping timestamps with lower severities
  const highestSeverityValues = data.values.reduce((acc, [timestamp, severity]) => {
    if (!acc[timestamp] || severityRank[severity] > severityRank[acc[timestamp]]) {
      acc[timestamp] = severity;
    }
    return acc;
  }, {});

  // Create an array of timestamps with their severities (retain order)
  return Object.entries(highestSeverityValues)
    .map(([timestamp, severity]) => [timestamp, severity])
    .sort((a, b) => new Date(a[0]) - new Date(b[0])); // Ensure order by time
}

function generateIntervalsWithGaps(filteredValues, dateArray) {
  const intervals = [];
  const startBoundary = new Date(dateArray[0]);
  const endBoundary = new Date(dateArray[dateArray.length - 1]);

  let currentStart = filteredValues[0] ? filteredValues[0][0] : startBoundary.toISOString();
  let currentSeverity = filteredValues[0] ? filteredValues[0][1] : 'nodata';

  if (!filteredValues.length) {
    // If there are no values, fill the entire range with nodata
    intervals.push([startBoundary.toISOString(), endBoundary.toISOString(), 'nodata']);
    return intervals;
  }

  // Add nodata interval before the first timestamp if needed
  const firstTimestamp = new Date(filteredValues[0][0]);
  if (firstTimestamp > startBoundary) {
    intervals.push([
      startBoundary.toISOString(),
      new Date(firstTimestamp - 1).toISOString(),
      'nodata',
    ]);
  }

  for (let i = 0; i < filteredValues.length; i++) {
    const [timestamp, severity] = filteredValues[i];

    if (i > 0) {
      // Check for gaps between the current and previous timestamps
      if (hasGap(filteredValues, i)) {
        const gapInterval = createNodataInterval(filteredValues, i);
        intervals.push(gapInterval);
      }
    }

    // Handle transitions between severities
    if (currentSeverity !== severity || i === 0) {
      if (i > 0) {
        const endDate = new Date(timestamp);
        endDate.setMilliseconds(endDate.getMilliseconds() - 1);
        intervals.push([currentStart, endDate.toISOString(), currentSeverity]);
      }
      currentStart = timestamp;
      currentSeverity = severity;
    }
  }

  // Add the final interval
  const lastEndDate = new Date(filteredValues[filteredValues.length - 1][0]);
  intervals.push([currentStart, lastEndDate.toISOString(), currentSeverity]);

  // Add nodata interval after the last timestamp if needed
  if (lastEndDate < endBoundary) {
    intervals.push([
      new Date(lastEndDate.getTime() + 1).toISOString(),
      endBoundary.toISOString(),
      'nodata',
    ]);
  }

  return intervals;
}

function hasGap(filteredValues, index) {
  const previousTimestamp = new Date(filteredValues[index - 1][0]);
  const currentTimestamp = new Date(filteredValues[index][0]);
  const timeDifference = (currentTimestamp - previousTimestamp) / 1000 / 60; // Convert to minutes
  return timeDifference > 5;
}

function createNodataInterval(filteredValues, index) {
  const previousTimestamp = new Date(filteredValues[index - 1][0]);
  const currentTimestamp = new Date(filteredValues[index][0]);

  const gapStart = new Date(previousTimestamp);
  gapStart.setMilliseconds(gapStart.getMilliseconds() + 1); // Start after the last interval

  const gapEnd = new Date(currentTimestamp);
  gapEnd.setMilliseconds(gapEnd.getMilliseconds() - 1); // End just before the next interval

  return [gapStart.toISOString(), gapEnd.toISOString(), 'nodata'];
}

/**
 * Creates an array of incident data for chart bars, ensuring that when two severities have the same time range, the lower severity is removed.
 *
 * @param {Object} incident - The incident data containing values with timestamps and severity levels.
 * @returns {Array} - An array of incident objects with `y0`, `y`, `x`, and `name` fields representing the bars for the chart.
 */
export const createIncidentsChartBars = (incident, theme, dateArray) => {
  const groupedData = consolidateAndMergeIntervals(incident, dateArray);
  const data = [];
  const getSeverityName = (value) => {
    return value === '2' ? 'Critical' : value === '1' ? 'Warning' : 'Info';
  };
  const barChartColorScheme = {
    critical: theme === 'light' ? global_danger_color_100.var : '#C9190B',
    info: theme === 'light' ? global_info_color_100.var : '#06C',
    warning: theme === 'light' ? global_warning_color_100.var : '#F0AB00',
  };
  for (let i = 0; i < groupedData.length; i++) {
    const severity = getSeverityName(groupedData[i][2]);

    data.push({
      y0: new Date(groupedData[i][0]),
      y: new Date(groupedData[i][1]),
      x: incident.x,
      name: severity,
      componentList: incident.componentList || [],
      group_id: incident.group_id,
      nodata: groupedData[i][2] === 'nodata' ? true : false,
      fill:
        severity === 'Critical'
          ? barChartColorScheme.critical
          : severity === 'Warning'
          ? barChartColorScheme.warning
          : barChartColorScheme.info,
    });
  }

  return data;
};

function consolidateAndMergeAlertIntervals(data) {
  const intervals = [];
  const sortedValues = data.values.sort((a, b) => new Date(a[0]) - new Date(b[0]));

  let currentStart = sortedValues[0][0];

  for (let i = 1; i < sortedValues.length; i++) {
    const previousTimestamp = new Date(sortedValues[i - 1][0]);
    const currentTimestamp = new Date(sortedValues[i][0]);
    const timeDifference = (currentTimestamp - previousTimestamp) / 1000 / 60;

    // If the gap is larger than 5 minutes, close the current interval
    if (timeDifference > 5) {
      intervals.push([currentStart, sortedValues[i - 1][0]]);
      currentStart = sortedValues[i][0]; // Start a new interval
    }
  }
  intervals.push([currentStart, sortedValues[sortedValues.length - 1][0]]);

  return intervals;
}

export const createAlertsChartBars = (alert, theme) => {
  // Consolidate intervals
  const groupedData = consolidateAndMergeAlertIntervals(alert);
  const barChartColorScheme = {
    critical: theme === 'light' ? global_danger_color_100.var : '#C9190B',
    info: theme === 'light' ? global_info_color_100.var : '#06C',
    warning: theme === 'light' ? global_warning_color_100.var : '#F0AB00',
  };

  const data = [];

  for (let i = 0; i < groupedData.length; i++) {
    data.push({
      y0: new Date(groupedData[i][0]),
      y: new Date(groupedData[i][1]),
      x: alert.x,
      severity: alert.severity[0].toUpperCase() + alert.severity.slice(1),
      name: alert.alertname,
      namespace: alert.namespace,
      layer: alert.layer,
      component: alert.component,
      fill:
        alert.severity === 'critical'
          ? barChartColorScheme.critical
          : alert.severity === 'warning'
          ? barChartColorScheme.warning
          : barChartColorScheme.info,
    });
  }

  return data;
};

export const formatDate = (date, isTime) => {
  const userLocale = navigator.language || 'en-US';
  const dateString = date?.toLocaleDateString(userLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeString = date?.toLocaleTimeString(userLocale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return isTime ? `${dateString}, ${timeString}` : dateString;
};

/**
 * Generates an array of dates, each representing midnight (00:00:00) of the past `days` number of days, starting from today.
 *
 * @param {number} days - The number of days for which to generate the date array. The array will contain dates starting from `days` ago up to today.
 * @returns {Array<Date>} An array of `Date` objects, each set to midnight (00:00:00) in UTC, for the past `days` number of days.
 *
 * @description
 * This function creates an array of `Date` objects, starting from `days` ago up to the current day. Each date in the array is set to midnight (00:00:00) to represent the start of the day.
 *
 * The function works by subtracting days from the current date and setting the time to 00:00:00 for each day.
 *
 * @example
 * // Generate an array of 7 days (last 7 days including today)
 * const dateArray = generateDateArray(7);
 * // Output example:
 * // [
 * //   2024-09-06T00:00:00.000Z,
 * //   2024-09-07T00:00:00.000Z,
 * //   2024-09-08T00:00:00.000Z,
 * //   2024-09-09T00:00:00.000Z,
 * //   2024-09-10T00:00:00.000Z,
 * //   2024-09-11T00:00:00.000Z,
 * //   2024-09-12T00:00:00.000Z
 * // ]
 */
export function generateDateArray(days) {
  const currentDate = new Date();

  const dateArray = [];
  for (let i = 0; i < days; i++) {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - (days - 1 - i));
    newDate.setHours(0, 0, 0, 0);
    dateArray.push(newDate);
  }

  return dateArray;
}

/**
 * Filters incidents based on the specified filters.
 *
 * @param {Object} filters - An object containing filter criteria.
 * @param {string[]} filters.incidentFilters - An array of strings representing filter conditions such as "Long standing", "Critical", etc.
 * @param {Array<Object>} incidents - An array of incidents to be filtered.
 * @returns {Array<Object>} A filtered array of incidents that match at least one of the specified filters.
 *
 * The `conditions` object maps filter keys to incident properties. If no filters are applied, all incidents are returned.
 * Filters are case-sensitive and must match the keys defined in the `conditions` object.
 *
 * Example usage:
 * ```javascript
 * const filters = { incidentFilters: ["Critical", "Firing"] };
 * const filteredIncidents = filterIncident(filters, incidents);
 * ```
 */
export function filterIncident(filters, incidents) {
  const conditions = {
    'Long standing': 'Long standing',
    Critical: 'critical',
    Warning: 'warning',
    Informative: 'informative',
    Firing: 'firing',
    Resolved: 'resolved',
  };

  return incidents.filter((incident) => {
    // If no filters are applied, return all incidents except those marked 'Long standing'
    if (!filters.incidentFilters.length) {
      return incident[conditions['Long standing']] !== true;
    }

    // Normalize user-provided filters to match keys in conditions
    const normalizedFilters = filters.incidentFilters.map((filter) => filter.trim());

    // Separate filters into categories
    const longStandingFilter = normalizedFilters.includes('Long standing');
    const severityFilters = ['Critical', 'Warning', 'Informative'].filter((key) =>
      normalizedFilters.includes(key),
    );
    const statusFilters = ['Firing', 'Resolved'].filter((key) => normalizedFilters.includes(key));

    // Match long-standing filter (OR behavior within the category)
    const isLongStandingMatch = longStandingFilter
      ? incident[conditions['Long standing']] === true
      : true; // True if no 'Long standing' filter

    // Match severity filters (OR behavior within the category)
    const isSeverityMatch =
      severityFilters.length > 0
        ? severityFilters.some((filter) => incident[conditions[filter]] === true)
        : true; // True if no severity filters

    // Match status filters (OR behavior within the category)
    const isStatusMatch =
      statusFilters.length > 0
        ? statusFilters.some((filter) => incident[conditions[filter]] === true)
        : true; // True if no status filters

    // Combine conditions with AND behavior between categories
    return isLongStandingMatch && isSeverityMatch && isStatusMatch;
  });
}

export const onDeleteIncidentFilterChip = (type, id, filters, setFilters) => {
  if (type === 'Filters') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          incidentFilters: filters.incidentFilters.filter((fil) => fil !== id),
          days: filters.days,
        },
      }),
    );
  } else if (type === 'Days') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          incidentFilters: filters.incidentFilters,
          days: filters.days.filter((fil) => fil !== id),
        },
      }),
    );
  } else {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          incidentFilters: [],
          days: ['7 days'],
        },
      }),
    );
  }
};

export const onDeleteGroupIncidentFilterChip = (type, filters, setFilters) => {
  if (type === 'Filters') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          incidentFilters: [],
          days: filters.days,
        },
      }),
    );
  } else if (type === 'Days') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          incidentFilters: filters.incidentFilters,
          days: [],
        },
      }),
    );
  }
};

export const makeIncidentUrlParams = (params) => {
  const processedParams = Object.entries(params).reduce((acc, [key, value]) => {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        acc[key] = value.join(',');
      }
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});

  return new URLSearchParams(processedParams).toString();
};

export const updateBrowserUrl = (params) => {
  const queryString = makeIncidentUrlParams(params);

  // Construct the new URL with the query string
  const newUrl = `${window.location.origin}${window.location.pathname}?${queryString}`;

  window.history.replaceState(null, '', newUrl);
};

export const changeDaysFilter = (days, dispatch, filters, setIncidentsAreLoading) => {
  dispatch(
    setIncidentsActiveFilters({
      incidentsActiveFilters: { days: [days], incidentFilters: filters.incidentFilters },
    }),
  );
  setIncidentsAreLoading(true);
};

export const onIncidentFiltersSelect = (event, selection, dispatch, incidentsActiveFilters) => {
  onSelect('incidentFilters', event, selection, dispatch, incidentsActiveFilters);
};

const onSelect = (type, event, selection, dispatch, incidentsActiveFilters) => {
  const checked = event.target.checked;

  dispatch((dispatch) => {
    const prevSelections = incidentsActiveFilters[type] || [];

    const updatedSelections = checked
      ? [...prevSelections, selection]
      : prevSelections.filter((value) => value !== selection);

    dispatch(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          ...incidentsActiveFilters,
          [type]: updatedSelections,
        },
      }),
    );
  });
};

export const parseUrlParams = (search) => {
  const params = new URLSearchParams(search);
  const result = {};
  const arrayKeys = ['days', 'incidentFilters'];

  params.forEach((value, key) => {
    if (arrayKeys.includes(key)) {
      result[key] = value.includes(',') ? value.split(',') : [value];
    } else {
      result[key] = value;
    }
  });

  return result;
};

const PF_THEME_DARK_CLASS = 'pf-v5-theme-dark';
const PF_THEME_DARK_CLASS_LEGACY = 'pf-theme-dark'; // legacy class name needed to support PF4
/**
 * The @openshift-console/dynamic-plugin-sdk package does not expose the theme setting of the user preferences,
 * therefore check if the root <html> element has the PatternFly css class set for the dark theme.
 */
function getTheme() {
  const classList = document.documentElement.classList;
  if (classList.contains(PF_THEME_DARK_CLASS) || classList.contains(PF_THEME_DARK_CLASS_LEGACY)) {
    return 'dark';
  }
  return 'light';
}
/**
 * In case the user sets "system default" theme in the user preferences, update the theme if the system theme changes.
 */
export function usePatternFlyTheme() {
  const [theme, setTheme] = useState(getTheme());
  useEffect(() => {
    const reloadTheme = () => setTheme(getTheme());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', reloadTheme);
    return () => mq.removeEventListener('change', reloadTheme);
  }, [setTheme]);
  return { theme };
}
