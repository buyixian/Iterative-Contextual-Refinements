import React from 'react';
import { WorkflowState, IterationResult } from '../../types/workflow';
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

    // 检查阶段是否有迭代结果
    const renderStageContent = (stageId: string) => {
        // 检查是否有迭代结果
        const iterations = workflowState.context.stages?.[stageId]?.output?.iterations;
        if (iterations && Array.isArray(iterations)) {
            return (
                <div className="iteration-container">
                    <h5>迭代结果 ({iterations.length} 个迭代):</h5>
                    {iterations.map((iteration: IterationResult, index: number) => (
                        <div key={index} className="iteration-node">
                            <div className="iteration-header">
                                <span><strong>迭代 #{iteration.index}</strong></span>
                                <span>变量: {iteration.loopVar} = {typeof iteration.loopVarValue === 'string' ? iteration.loopVarValue : JSON.stringify(iteration.loopVarValue)}</span>
                                <span>耗时: {iteration.durationMs}ms</span>
                            </div>
                            <div className="iteration-details">
                                {Object.entries(iteration.stepOutputs).map(([taskId, output]) => (
                                    <div key={taskId} className="task-node">
                                        <span>Task: {taskId}</span>
                                        {output && <pre className="task-output">{JSON.stringify(output, null, 2)}</pre>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }
        
        // 如果没有迭代结果，显示常规任务
        const stage = workflowState.progress[stageId];
        if (!stage) return null;
        
        return (
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
                                   {/* 显示校验状态和失败原因 (Placeholder for future implementation) */}
                                   {/* {task.validationStatus && <pre className="task-validation-status">Validation: {task.validationStatus}</pre>} */}
                                   {/* {task.validationMessage && <pre className="task-validation-message">Message: {task.validationMessage}</pre>} */}
                               </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

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
                        {renderStageContent(stageId)}
                    </div>
                ))}
            </div>
        </div>
    );
};