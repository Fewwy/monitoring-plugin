import * as React from 'react';
import IncidentGanttChart from '../IncidentsChart/IncidentsChart';
import AlertsChart from '../AlertsChart/AlertsChart';

export const IncidentsHeader = ({ alertsData }) => {
  return (
    <div className="incidents-chart-card-container">
      <IncidentGanttChart />
      <AlertsChart alertsData={alertsData} />
    </div>
  );
};
