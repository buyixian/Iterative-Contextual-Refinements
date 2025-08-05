import React from 'react';
import { WorkflowRole, ModelDefinition } from '../../types/workflow';
import './RoleAssignment.css';

interface RoleAssignmentProps {
  roles: WorkflowRole[];
  models: ModelDefinition[];
  assignments: Record<string, string>;
  onAssignmentChange: (roleId: string, modelId: string) => void;
}

export const RoleAssignment: React.FC<RoleAssignmentProps> = ({
  roles,
  models,
  assignments,
  onAssignmentChange,
}) => {
  if (roles.length === 0) {
    return null;
  }

  return (
    <div className="role-assignment-container">
      <h3 className="role-assignment-title">Assign Models to Roles</h3>
      <div className="role-assignment-grid">
        {roles.map((role) => (
          <div key={role.id} className="role-assignment-item">
            <label htmlFor={`role-${role.id}`} className="role-label" title={role.description}>
              {role.name}
            </label>
            <select
              id={`role-${role.id}`}
              value={assignments[role.id] || ''}
              onChange={(e) => onAssignmentChange(role.id, e.target.value)}
              className="role-select"
            >
              <option value="" disabled>
                Select a model...
              </option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
};