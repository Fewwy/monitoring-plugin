/* eslint-disable max-len */

import { PrometheusEndpoint, PrometheusResponse } from '@openshift-console/dynamic-plugin-sdk';
import { getPrometheusBasePath, buildPrometheusUrl } from '../utils';
/**
 * Creates a single Prometheus alert query string from a grouped alert value.
 * @param {Object} query - Single grouped alert object with src_ prefixed properties and layer/component.
 * @returns {string} - A string representing a single Prometheus alert query.
 */
const createSingleAlertQuery = (query) => {
  // Dynamically get all keys starting with "src_"
  const srcKeys = Object.keys(query).filter((key) => key.startsWith('src_'));

  // Create the alertParts array using the dynamically discovered src_ keys,
  // but remove the "src_" prefix from the keys in the final query string.
  const alertParts = srcKeys
    .filter((key) => query[key]) // Only include keys that are present in the query object
    .map((key) => `${key.replace('src_', '')}="${query[key]}"`) // Remove "src_" prefix from keys
    .join(', ');

  // Construct the query string for the grouped alert
  return `(ALERTS{${alertParts}} + on () group_left (component, layer) (absent(meta{layer="${query.layer}", component="${query.component}"})))`;
};

/**
 * Creates Prometheus alerts query strings from grouped alert values, splitting into multiple queries if needed to avoid URL length limits.
 * The function dynamically includes any properties in the input objects that have the "src_" prefix,
 * but the prefix is removed from the keys in the final query string.
 *
 * @param {Object[]} groupedAlertsValues - Array of grouped alert objects.
 * Each alert object should contain various properties, including "src_" prefixed properties,
 * as well as "layer" and "component" for constructing the meta fields in the query.
 *
 * @param {string} groupedAlertsValues[].layer - The layer of the alert, used in the absent condition.
 * @param {string} groupedAlertsValues[].component - The component of the alert, used in the absent condition.
 * @returns {string[]} - An array of strings representing the Prometheus alerts queries, split if necessary to avoid URL length limits.
 * Each alert query is formatted as `(ALERTS{key="value", ...} + on () group_left (component, layer) (absent(meta{layer="value", component="value"})))`
 * and multiple queries are joined by "or".
 *
 * @example
 * const alerts = [
 *   {
 *     src_alertname: "AlertmanagerReceiversNotConfigured",
 *     src_namespace: "openshift-monitoring",
 *     src_severity: "warning",
 *     layer: "core",
 *     component: "monitoring"
 *   },
 *   {
 *     src_alertname: "AnotherAlert",
 *     src_namespace: "default",
 *     src_severity: "critical",
 *     layer: "app",
 *     component: "frontend"
 *   }
 * ];
 *
 * const queries = createAlertsQuery(alerts);
 * // Returns array of query strings, split if any single query would exceed URL length limits
 */
export const createAlertsQuery = (groupedAlertsValues, maxUrlLength = 5000) => {
  if (!groupedAlertsValues || groupedAlertsValues.length === 0) {
    return [];
  }

  const queries = [];
  let currentQueryParts = [];
  let currentQueryLength = 0;

  for (const alertValue of groupedAlertsValues) {
    const singleQuery = createSingleAlertQuery(alertValue);
    const additionalLength =
      currentQueryParts.length > 0 ? singleQuery.length + 4 : singleQuery.length; // +4 for " or "

    // Check if adding this query would exceed the URL length limit
    if (currentQueryLength + additionalLength > maxUrlLength && currentQueryParts.length > 0) {
      // Finalize current query and start a new one
      queries.push(currentQueryParts.join(' or '));
      currentQueryParts = [singleQuery];
      currentQueryLength = singleQuery.length;
    } else {
      // Add to current query
      currentQueryParts.push(singleQuery);
      currentQueryLength += additionalLength;
    }
  }

  // Add the final query if there are remaining parts
  if (currentQueryParts.length > 0) {
    queries.push(currentQueryParts.join(' or '));
  }

  return queries;
};

export const fetchDataForIncidentsAndAlerts = (
  fetch: (url: string) => Promise<PrometheusResponse>,
  range: { endTime: number; duration: number },
  customQuery: string | string[],
) => {
  // Handle both single query (string) and multiple queries (string array)
  const queries = Array.isArray(customQuery) ? customQuery : [customQuery];

  // If no queries provided, return empty result
  if (queries.length === 0) {
    return Promise.resolve({ data: { result: [] } });
  }

  // Create promises for all queries
  const fetchPromises = queries.map((query) =>
    fetch(
      buildPrometheusUrl({
        prometheusUrlProps: {
          endpoint: PrometheusEndpoint.QUERY_RANGE,
          endTime: range.endTime,
          namespace: '',
          query,
          samples: 288,
          timespan: range.duration - 1,
        },
        basePath: getPrometheusBasePath({
          prometheus: 'cmo',
        }),
      }),
    ),
  );

  // Wait for all queries to complete and combine results
  return Promise.all(fetchPromises).then((responses) => {
    const combinedResults = responses.reduce((acc, response) => {
      if (response?.data?.result && Array.isArray(response.data.result)) {
        acc.push(...response.data.result);
      }
      return acc;
    }, []);

    // Return in the same format as the original single query response
    return {
      data: {
        result: combinedResults,
      },
    };
  });
};
