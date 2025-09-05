/* eslint-disable max-len */
import {
  t_global_color_status_danger_default,
  t_global_color_status_info_default,
  t_global_color_status_warning_default,
} from '@patternfly/react-tokens';
import { Dispatch } from 'redux';
import { setIncidentsActiveFilters } from '../../actions/observe';
import {
  Alert,
  AlertsIntervalsArray,
  DaysFilters,
  Incident,
  IncidentFilters,
  IncidentFiltersCombined,
  SpanDates,
  Timestamps,
} from './model';

function consolidateAndMergeIntervals(data: Incident, dateArray: SpanDates) {
  const severityRank = { 2: 2, 1: 1, 0: 0 };
  const filteredValues = filterAndSortValues(data, severityRank);
  return generateIntervalsWithGaps(filteredValues, dateArray);
}

/**
 * Filters and sorts values by severity, keeping only the highest severity for each timestamp.
 * @param {Object} data - The input data containing timestamps and severities.
 * @param {Object} severityRank - An object mapping severity levels to their ranking values.
 * @returns {Array} - An array of sorted timestamps with their severities.
 */
function filterAndSortValues(
  data: Incident,
  severityRank: Record<string, number>,
): Array<[number, string]> {
  const highestSeverityValues: Record<string, string> = data.values.reduce(
    (acc: Record<string, string>, [timestamp, severity]) => {
      const timestampStr = new Date(timestamp * 1000).toISOString();

      if (!acc[timestampStr] || severityRank[severity] > severityRank[acc[timestampStr]]) {
        acc[timestampStr] = severity;
      }
      return acc;
    },
    {},
  );

  return Object.entries(highestSeverityValues)
    .map(
      ([timestamp, severity]) =>
        [new Date(timestamp).getTime() / 1000, severity] as [number, string],
    )
    .sort((a, b) => a[0] - b[0]);
}

/**
 * Generates intervals while handling gaps with "nodata".
 * @param {Array} filteredValues - The sorted array of timestamps with severities.
 * @param {string[]} dateArray - The array defining the start and end boundaries.
 * @returns {Array} - The list of consolidated intervals.
 */
function generateIntervalsWithGaps(filteredValues: Array<Timestamps>, dateArray: SpanDates) {
  const intervals = [];
  const startBoundary = dateArray[0];
  const endBoundary = dateArray[dateArray.length - 1];

  let currentStart = filteredValues[0] ? filteredValues[0][0] : startBoundary;
  let currentSeverity = filteredValues[0] ? filteredValues[0][1] : 'nodata';

  if (filteredValues.length === 0) {
    intervals.push([startBoundary, endBoundary, 'nodata']);
    return intervals;
  }

  const firstTimestamp = filteredValues[0][0];
  if (firstTimestamp > startBoundary) {
    intervals.push([startBoundary, firstTimestamp - 1, 'nodata']);
  }

  for (let i = 0; i < filteredValues.length; i++) {
    const [timestamp, severity] = filteredValues[i];

    if (i > 0 && hasGap(filteredValues, i)) {
      intervals.push(createNodataInterval(filteredValues, i));
    }

    if (currentSeverity !== severity || i === 0) {
      if (i > 0) {
        const endDate = timestamp - 1;
        intervals.push([currentStart, endDate, currentSeverity]);
      }
      currentStart = timestamp;
      currentSeverity = severity;
    }
  }

  const lastEndDate = filteredValues[filteredValues.length - 1][0];
  intervals.push([currentStart, lastEndDate, currentSeverity]);

  if (lastEndDate < endBoundary) {
    intervals.push([lastEndDate + 1, endBoundary, 'nodata']);
  }

  return intervals;
}

/**
 * Checks if there is a gap larger than 5 minutes between consecutive timestamps.
 * @param {Array} filteredValues - The array of filtered timestamps and severities.
 * @param {number} index - The current index in the array.
 * @returns {boolean} - Whether a gap exists.
 */
function hasGap(filteredValues: Array<Timestamps>, index: number) {
  const previousTimestamp = filteredValues[index - 1][0];
  const currentTimestamp = filteredValues[index][0];
  return (currentTimestamp - previousTimestamp) / 60 > 5;
}

/**
 * Creates a "nodata" interval to fill gaps between timestamps.
 * @param {Array} filteredValues - The array of filtered timestamps and severities.
 * @param {number} index - The current index in the array.
 * @returns {Array} - The "nodata" interval.
 */
function createNodataInterval(filteredValues: Array<Timestamps>, index: number) {
  const previousTimestamp = filteredValues[index - 1][0];
  const currentTimestamp = filteredValues[index][0];

  return [previousTimestamp + 1, currentTimestamp - 1, 'nodata'];
}

/**
 * Creates an array of incident data for chart bars, ensuring that when two severities have the same time range, the lower severity is removed.
 *
 * @param {Object} incident - The incident data containing values with timestamps and severity levels.
 * @returns {Array} - An array of incident objects with `y0`, `y`, `x`, and `name` fields representing the bars for the chart.
 */
export const createIncidentsChartBars = (incident: Incident, dateArray: SpanDates) => {
  const groupedData = consolidateAndMergeIntervals(incident, dateArray);
  const data = [];
  const getSeverityName = (value) => {
    return value === '2' ? 'Critical' : value === '1' ? 'Warning' : 'Info';
  };
  const barChartColorScheme = {
    critical: t_global_color_status_danger_default.var,
    info: t_global_color_status_info_default.var,
    warning: t_global_color_status_warning_default.var,
  };

  for (let i = 0; i < groupedData.length; i++) {
    const severity = getSeverityName(groupedData[i][2]);

    data.push({
      y0: new Date(groupedData[i][0] * 1000),
      y: new Date(groupedData[i][1] * 1000),
      x: incident.x,
      name: severity,
      firing: incident.firing,
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

function consolidateAndMergeAlertIntervals(data: Alert, dateArray: SpanDates) {
  if (!data.values || data.values.length === 0) {
    return [];
  }
  const sortedValues = data.values.sort((a, b) => a[0] - b[0]);

  const intervals: Array<AlertsIntervalsArray> = [];
  let currentStart = sortedValues[0][0];
  let previousTimestamp = currentStart;

  for (let i = 1; i < sortedValues.length; i++) {
    const currentTimestamp = sortedValues[i][0];
    const timeDifference = (currentTimestamp - previousTimestamp) / 60; // Convert to minutes

    if (timeDifference > 5) {
      intervals.push([currentStart, sortedValues[i - 1][0], 'data']);
      intervals.push([previousTimestamp + 1, currentTimestamp - 1, 'nodata']);
      currentStart = sortedValues[i][0];
    }
    previousTimestamp = currentTimestamp;
  }

  intervals.push([currentStart, sortedValues[sortedValues.length - 1][0], 'data']);

  // Handle gaps before and after the detected intervals
  const startBoundary = dateArray[0],
    endBoundary = dateArray[dateArray.length - 1];
  const firstIntervalStart = intervals[0][0],
    lastIntervalEnd = intervals[intervals.length - 1][1];

  if (firstIntervalStart > startBoundary) {
    intervals.unshift([startBoundary, firstIntervalStart - 1, 'nodata']);
  }
  if (lastIntervalEnd < endBoundary) {
    intervals.push([lastIntervalEnd + 1, endBoundary, 'nodata']);
  }

  return intervals;
}

export const createAlertsChartBars = (alert: Alert, dateValues: SpanDates) => {
  const groupedData = consolidateAndMergeAlertIntervals(alert, dateValues);
  const barChartColorScheme = {
    critical: t_global_color_status_danger_default.var,
    info: t_global_color_status_info_default.var,
    warning: t_global_color_status_warning_default.var,
  };

  const data = [];

  for (let i = 0; i < groupedData.length; i++) {
    data.push({
      y0: new Date(groupedData[i][0] * 1000),
      y: new Date(groupedData[i][1] * 1000),
      x: alert.x,
      severity: alert.severity[0].toUpperCase() + alert.severity.slice(1),
      name: alert.alertname,
      namespace: alert.namespace,
      layer: alert.layer,
      component: alert.component,
      nodata: groupedData[i][2] === 'nodata' ? true : false,
      alertstate: alert.alertstate,
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

export const formatDate = (date: Date, isTime: boolean) => {
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
 * @returns {Array<number>} An array of timestamps (in seconds) representing midnight (00:00:00) in UTC, for the past `days` number of days.
 *
 * @description
 * This function creates an array of timestamps, starting from `days` ago up to the current day. Each timestamp in the array is set to midnight (00:00:00) to represent the start of the day.
 *
 * The function works by subtracting days from the current date and setting the time to 00:00:00 for each day.
 *
 * @example
 * // Generate an array of 7 days (last 7 days including today)
 * const dateArray = generateDateArray(7);
 * // Output example:
 * // [
 * //   1754381643,
 * //   1754468043,
 * //   1754554443,
 * //   1754640843,
 * //   1754727243,
 * //   1754813643,
 * //   1754900043
 * // ]
 */
export function generateDateArray(days: number): Array<number> {
  const currentDate = new Date();

  const dateArray: Array<number> = [];
  for (let i = 0; i < days; i++) {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - (days - 1 - i));
    newDate.setHours(0, 0, 0, 0);
    dateArray.push(newDate.getTime() / 1000);
  }

  return dateArray;
}

/**
 * Filters an array of incidents based on severity, state, and group ID filters.
 *
 * This function returns incidents that match all provided filters. For severity, it performs a "drill down"
 * by modifying the incident's `values` array to only include timestamps that match the specified severities.
 * If an incident contains no values matching the severity filters, the incident is not returned.
 *
 * @param {IncidentFiltersCombined} filters An object containing arrays of filter criteria.
 * @param {Array<Incident>} incidents The array of incident objects to be filtered.
 * @returns {Array<Incident>} A new array containing the filtered incident objects.
 */
export function filterIncident(
  filters: IncidentFiltersCombined,
  incidents: Array<Incident>,
): Incident[] {
  // Severity dictionary mapping severity string to a numeric string value.
  const severityDictionary: { [key: string]: '0' | '1' | '2' } = {
    informative: '0',
    warning: '1',
    critical: '2',
  };

  const stateConditions: { [key: string]: 'firing' | 'resolved' } = {
    Firing: 'firing',
    Resolved: 'resolved',
  };

  if (!filters?.severity?.length && !filters?.state?.length && !filters?.groupId?.length) {
    return incidents;
  }

  const allowedSeverityValues: Set<string> | null =
    filters.severity?.length > 0
      ? new Set(filters.severity.map((filter: string) => severityDictionary[filter.toLowerCase()]))
      : null;

  const filteredIncidents: Incident[] = incidents
    .filter((incident: Incident) => {
      const isStateMatch: boolean =
        filters.state?.length > 0
          ? filters.state.some((filter: string) => incident[stateConditions[filter]] === true)
          : true;

      const isIncidentIdMatch: boolean =
        filters.groupId?.length > 0 ? filters.groupId.includes(incident.group_id) : true;

      let hasAllRequiredSeverities: boolean = true;
      if (allowedSeverityValues) {
        hasAllRequiredSeverities = Array.from(allowedSeverityValues).every(
          (requiredValue: string) => {
            return incident.values.some((value: [number, string]) => value[1] === requiredValue);
          },
        );
      }

      return isStateMatch && isIncidentIdMatch && hasAllRequiredSeverities;
    })
    .map((incident: Incident) => {
      const newIncident: Incident = { ...incident };

      if (allowedSeverityValues) {
        newIncident.values = incident.values.filter((valueTuple: [number, string]) =>
          allowedSeverityValues.has(valueTuple[1]),
        );
      }

      return newIncident;
    });

  return filteredIncidents;
}

export const onDeleteIncidentFilterChip = (
  type: string,
  id: IncidentFilters | string,
  filters: IncidentFiltersCombined,
  setFilters,
) => {
  if (type === 'State') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          severity: filters.severity,
          days: filters.days,
          state: filters.state.filter((fil) => fil !== id),
          groupId: filters.groupId,
        },
      }),
    );
  }
  if (type === 'Severity') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          severity: filters.severity.filter((fil) => fil !== id),
          days: filters.days,
          state: filters.state,
          groupId: filters.groupId,
        },
      }),
    );
  }
  if (type === 'Incident ID') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          severity: filters.severity,
          days: filters.days,
          state: filters.state,
          groupId: filters.groupId.filter((fil) => fil !== id),
        },
      }),
    );
  }
};

export const onDeleteGroupIncidentFilterChip = (
  filters: IncidentFiltersCombined,
  setFilters,
  category,
) => {
  if (category === 'State') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          severity: filters.severity,
          days: filters.days,
          state: [],
          groupId: filters.groupId,
        },
      }),
    );
  } else if (category === 'Severity') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          severity: [],
          days: filters.days,
          state: filters.state,
          groupId: filters.groupId,
        },
      }),
    );
  } else if (category === 'Incident ID') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          severity: filters.severity,
          days: filters.days,
          state: filters.state,
          groupId: [],
        },
      }),
    );
  } else {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          severity: [],
          days: filters.days,
          state: [],
          groupId: [],
        },
      }),
    );
  }
};

export const makeIncidentUrlParams = (
  params: IncidentFiltersCombined,
  incidentGroupId?: string,
) => {
  const processedParams = Object.entries(params).reduce((acc, [key, value]) => {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        acc[key] = value.join(',');
      }
    } else {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, string>);

  if (incidentGroupId) {
    processedParams['groupId'] = incidentGroupId;
  }

  return new URLSearchParams(processedParams).toString();
};

export const updateBrowserUrl = (params: IncidentFiltersCombined, incidentGroupId?: string) => {
  const queryString = makeIncidentUrlParams(params, incidentGroupId);

  const newUrl = `${window.location.origin}${window.location.pathname}?${queryString}`;

  window.history.replaceState(null, '', newUrl);
};

export const changeDaysFilter = (
  days: DaysFilters,
  dispatch: Dispatch<any>,
  filters: IncidentFiltersCombined,
) => {
  dispatch(
    setIncidentsActiveFilters({
      incidentsActiveFilters: {
        days: [days],
        severity: filters.severity,
        state: filters.state,
        groupId: filters.groupId,
      },
    }),
  );
};

/**
 * A wrapper function that handles a user's selection on an incident filter.
 *
 * This function acts as the public entry point for filter selection,
 * passing the event details and filter state to the internal `onSelect`
 * helper function to perform the state update.
 *
 * @param {Event} event - The DOM event from the checkbox or filter selection.
 * @param {string} selection - The value of the filter being selected or deselected.
 * @param {Function} dispatch - The Redux dispatch function to trigger state changes.
 * @param {object} incidentsActiveFilters - The current state of active filters.
 * @param {string} filterCategoryType - The category of the filter (e.g., 'Incident ID', 'severity').
 * @returns {void}
 */
export const onIncidentFiltersSelect = (
  event,
  selection: IncidentFilters,
  dispatch,
  incidentsActiveFilters: IncidentFiltersCombined,
  filterCategoryType: string,
) => {
  onSelect(event, selection, dispatch, incidentsActiveFilters, filterCategoryType);
};

/**
 * An internal helper function that manages the logic for selecting or deselecting a filter.
 *
 * It updates the Redux state based on the filter type. For 'groupId', it replaces the
 * existing selection (single-select behavior). For all other filters, it adds or
 * removes the selection from the array (multi-select behavior).
 *
 * @param {Event} event - The DOM event from the checkbox or filter selection.
 * @param {string} selection - The value of the filter being selected or deselected.
 * @param {Function} dispatch - The Redux dispatch function to trigger state changes.
 * @param {object} incidentsActiveFilters - The current state of active filters.
 * @param {string} filterCategoryType - The category of the filter.
 * @returns {void}
 */
const onSelect = (event, selection, dispatch, incidentsActiveFilters, filterCategoryType) => {
  let effectiveFilterType = filterCategoryType;

  if (effectiveFilterType === 'incident id') {
    effectiveFilterType = 'groupId';
  }

  dispatch(() => {
    const targetArray = incidentsActiveFilters[effectiveFilterType] || [];
    const newFilters = { ...incidentsActiveFilters };

    // Determine if the item is already selected by checking the current state.
    // This replaces the need for event.target.checked.
    const isSelected = targetArray.includes(selection);

    if (effectiveFilterType === 'groupId') {
      // Single-select logic: If already selected, unselect it. Otherwise, select it.
      newFilters[effectiveFilterType] = isSelected ? [] : [selection];
    } else {
      // Multi-select logic: If already selected, remove it. Otherwise, add it.
      if (isSelected) {
        newFilters[effectiveFilterType] = targetArray.filter((value) => value !== selection);
      } else {
        newFilters[effectiveFilterType] = [...targetArray, selection];
      }
    }

    dispatch(
      setIncidentsActiveFilters({
        incidentsActiveFilters: newFilters,
      }),
    );
  });
};

export const parseUrlParams = (search) => {
  const params = new URLSearchParams(search);
  const result: { [key: string]: any } = {};
  const arrayKeys = ['days', 'groupId', 'severity', 'state'];

  params.forEach((value, key) => {
    if (arrayKeys.includes(key)) {
      result[key] = value.includes(',') ? value.split(',') : [value];
    } else {
      result[key] = value;
    }
  });

  return result;
};

/**
 * Generates an array of unique incident ID options for a filter.
 *
 * This function iterates through a list of incident objects,
 * extracts their unique `group_id`s, and returns them in a format
 * suitable for a dropdown or filter component.
 *
 * @param {Array<Incident>} incidents - An array of incident objects.
 * @returns {{value: string}[]} An array of objects, where each object has a `value` key with a unique incident ID.
 */
export const getIncidentIdOptions = (incidents: Array<Incident>) => {
  const uniqueIds = new Set<string>();
  incidents.forEach((incident) => {
    if (incident.group_id) {
      uniqueIds.add(incident.group_id);
    }
  });
  return Array.from(uniqueIds).map((id) => ({
    value: id,
    description: `Incident ID: ${id}`,
  }));
};

/**
 * Maps a human-readable filter category name to its corresponding data key.
 *
 * This function is used to convert a display name (e.g., "Incident ID")
 * into the internal key used to access filter data (e.g., "groupId").
 * It handles a specific case for "Incident ID" and converts all other
 * category names to lowercase.
 *
 * @param {string} categoryName - The human-readable name of the filter category.
 * @returns {string} The corresponding data key for the filter.
 */
export const getFilterKey = (categoryName: string): string => {
  if (categoryName === 'Incident ID') {
    return 'groupId';
  }
  return categoryName.toLowerCase();
};
