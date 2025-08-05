import React from 'react';
import { WorkflowState } from '../../types/workflow';
import './RealTimeProgressView.css';

interface RealTimeProgressViewProps {
    workflowState: WorkflowState | null;
}

const getStatusIcon = (status: string) => {
    switch (status) {
        case 'running':
            return '⏳'; // Hourglass
        case 'completed':
            return '✅'; // Check mark
        case 'failed':
            return '❌'; // Cross mark
        case 'pending':
        default:
            return '⚪'; // White circle
    }
};

export const RealTimeProgressView: React.FC<RealTimeProgressViewProps> = ({ workflowState }) => {
    if (!workflowState) {
        return <div className="progress-view placeholder">等待工作流启动...</div>;
    }

    return (
        <div className="progress-view">
            <h3>工作流进度: {workflowState.workflow_id}</h3>
            <div className="progress-summary">
                <span><strong>实例 ID:</strong> {workflowState.instance_id}</span>
                <span><strong>状态:</strong> {getStatusIcon(workflowState.status)} {workflowState.status}</span>
            </div>
            <div className="progress-tree">
                {Object.entries(workflowState.progress).map(([stageId, stage]) => (
                    <div key={stageId} className="stage-node">
                        <h4>{getStatusIcon(stage.status)} Stage: {stageId}</h4>
                        <div className="step-container">
                            {Object.entries(stage.steps).map(([stepId, step]) => (
                                <div key={stepId} className="step-node">
                                    <h5>{getStatusIcon(step.status)} Step: {stepId}</h5>
                                    <div className="task-container">
                                        {Object.entries(step.tasks).map(([taskId, task]) => (
                                            <div key={taskId} className="task-node">
                                                <span>{getStatusIcon(task.status)} Task: {taskId}</span>
                                                {task.output && <pre className="task-output">{JSON.stringify(task.output, null, 2)}</pre>}
                                                {task.error && <pre className="task-error">{task.error}</pre>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};