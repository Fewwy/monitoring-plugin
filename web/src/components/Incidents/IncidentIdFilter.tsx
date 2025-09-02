import React from 'react';
import {
  ToolbarItem,
  ToolbarFilter,
  Select,
  SelectList,
  SelectOption,
  MenuToggle,
  Badge,
} from '@patternfly/react-core';
import FilterIcon from '@patternfly/react-icons/dist/js/icons/filter-icon';
import { IncidentFiltersCombined } from './model';

interface IncidentIdFilterProps {
  incidentIdOptions: {
    value: string;
    description: string;
  }[];
  incidentsActiveFilters: IncidentFiltersCombined;
  incidentIdFilterExpanded: boolean;
  onIncidentIdFilterToggle: React.MouseEventHandler<HTMLButtonElement | HTMLDivElement>;
  setIncidentIdFilterExpanded: (isOpen: boolean) => void;
  onIncidentIdSelect: (selectedId: string | null) => void;
  showToolbarItem?: boolean;
}

const IncidentIdFilter: React.FC<IncidentIdFilterProps> = ({
  incidentIdOptions,
  incidentsActiveFilters,
  incidentIdFilterExpanded,
  onIncidentIdFilterToggle,
  setIncidentIdFilterExpanded,
  onIncidentIdSelect,
  showToolbarItem,
}) => {
  const selectedIncidentId = incidentsActiveFilters.groupId?.[0] || '';

  return (
    <ToolbarItem>
      <ToolbarFilter
        showToolbarItem={showToolbarItem}
        labels={selectedIncidentId ? [selectedIncidentId] : []}
        deleteLabel={() => onIncidentIdSelect(null)}
        deleteLabelGroup={() => onIncidentIdSelect(null)}
        categoryName="Incident ID"
      >
        <Select
          id="incident-id-select"
          role="menu"
          aria-label="Incident ID Filter"
          isOpen={incidentIdFilterExpanded}
          selected={selectedIncidentId}
          onSelect={(event, selection) => {
            const selectedId = selection as string;
            onIncidentIdSelect(selectedId === selectedIncidentId ? null : selectedId);
          }}
          onOpenChange={(isOpen) => setIncidentIdFilterExpanded(isOpen)}
          toggle={(toggleRef) => (
            <MenuToggle
              ref={toggleRef}
              onClick={onIncidentIdFilterToggle}
              isExpanded={incidentIdFilterExpanded}
              icon={<FilterIcon />}
              badge={selectedIncidentId ? <Badge isRead>1</Badge> : undefined}
            >
              Incident ID
            </MenuToggle>
          )}
          shouldFocusToggleOnSelect
        >
          <SelectList>
            <SelectOption key="clear" value="" isSelected={!selectedIncidentId}>
              All Incidents
            </SelectOption>
            {incidentIdOptions.map((option) => (
              <SelectOption
                key={option.value}
                value={option.value}
                isSelected={selectedIncidentId === option.value}
                description={option.description}
              >
                {option.value}
              </SelectOption>
            ))}
          </SelectList>
        </Select>
      </ToolbarFilter>
    </ToolbarItem>
  );
};

export default IncidentIdFilter;
