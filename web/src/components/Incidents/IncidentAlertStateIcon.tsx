import React from 'react';
import { Tooltip } from '@patternfly/react-core';
import { BellIcon, CheckIcon, BellSlashIcon } from '@patternfly/react-icons';
import { Alert, GroupedAlert } from './model';

interface IncidentAlertStateIconProps {
  alertDetails: Alert;
  showTooltip?: boolean;
}

// Helper function to determine the correct state
const getAlertState = (alertDetails: Alert): 'firing' | 'resolved' | 'silenced' => {
  // Check if alert is resolved
  if (alertDetails.resolved) {
    return 'resolved';
  }

  // Check if alert is silenced (you might need to add silenced property to Alert model)
  // For now, we'll assume alertstate could be 'silenced'
  if (alertDetails.alertstate === 'silenced') {
    return 'silenced';
  }

  // Default to firing
  return 'firing';
};

export const IncidentAlertStateIcon: React.FC<IncidentAlertStateIconProps> = ({
  alertDetails,
  showTooltip = true,
}) => {
  const state = getAlertState(alertDetails);

  const getIconAndTooltip = () => {
    switch (state) {
      case 'firing':
        return {
          icon: <BellIcon />,
          tooltip: 'Firing',
        };
      case 'resolved':
        return {
          icon: <CheckIcon />,
          tooltip: 'Resolved',
        };
      case 'silenced':
        return {
          icon: <BellSlashIcon style={{ color: 'var(--pf-t--global--icon--color--disabled)' }} />,
          tooltip: 'Silenced',
        };
      default:
        return {
          icon: <BellIcon />,
          tooltip: 'Unknown',
        };
    }
  };

  const { icon, tooltip } = getIconAndTooltip();

  if (showTooltip) {
    return <Tooltip content={tooltip}>{icon}</Tooltip>;
  }

  return icon;
};

// Component for grouped alerts in the main table
interface GroupedAlertStateIconProps {
  groupedAlert: GroupedAlert;
  showTooltip?: boolean;
}

// Helper function to determine state for grouped alerts
const getGroupedAlertState = (groupedAlert: GroupedAlert): 'firing' | 'resolved' | 'silenced' => {
  // Check if the group state is resolved
  if (groupedAlert.alertstate === 'resolved') {
    return 'resolved';
  }

  // Check if the group state is silenced
  if (groupedAlert.alertstate === 'silenced') {
    return 'silenced';
  }

  // Default to firing
  return 'firing';
};

export const GroupedAlertStateIcon: React.FC<GroupedAlertStateIconProps> = ({
  groupedAlert,
  showTooltip = true,
}) => {
  const state = getGroupedAlertState(groupedAlert);

  const getIconAndTooltip = () => {
    switch (state) {
      case 'firing':
        return {
          icon: <BellIcon />,
          tooltip: 'Firing',
        };
      case 'resolved':
        return {
          icon: <CheckIcon />,
          tooltip: 'Resolved',
        };
      case 'silenced':
        return {
          icon: <BellSlashIcon style={{ color: 'var(--pf-t--global--icon--color--disabled)' }} />,
          tooltip: 'Silenced',
        };
      default:
        return {
          icon: <BellIcon />,
          tooltip: 'Unknown',
        };
    }
  };

  const { icon, tooltip } = getIconAndTooltip();

  if (showTooltip) {
    return <Tooltip content={tooltip}>{icon}</Tooltip>;
  }

  return icon;
};
