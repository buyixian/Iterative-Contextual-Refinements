import React, { useState, useRef, useEffect } from 'react';
import { Workflow, WorkflowState, ModelDefinition } from '../../types/workflow';
import { WorkflowEngine } from '../../core/WorkflowEngine';
import { AgentPool } from '../../core/AgentPool';
import { Toolbox } from '../../core/Toolbox';
import { StateManager } from '../../core/StateManager';
import { RealTimeProgressView } from './RealTimeProgressView';
import { useApiKeyContext } from '../../context/ApiKeyContext';
import { RoleAssignment } from './RoleAssignment';

import './WorkflowManager.css';

export const WorkflowManager: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [initialRequest, setInitialRequest] = useState('');
    const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
    const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
    const [models, setModels] = useState<ModelDefinition[]>([]);
    const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({});
    
    const intervalRef = useRef<number | null>(null);
    const { apiKeys } = useApiKeyContext();

    useEffect(() => {
        const loadInitialData = async () => {
            const workflowModule = await import('../../workflows/adversarial-math.workflow.json');
            const workflow: Workflow = workflowModule.default;
            setSelectedWorkflow(workflow);

            const modelsModule = await import('../../config/models.json');
            const availableModels: ModelDefinition[] = modelsModule.default as ModelDefinition[];
            setModels(availableModels);

            // Set default assignments once both workflow and models are loaded
            if (workflow.roles && workflow.roles.length > 0 && availableModels.length > 0) {
                const defaultAssignments: Record<string, string> = {};
                workflow.roles.forEach(role => {
                    defaultAssignments[role.id] = availableModels[0].id;
                });
                setRoleAssignments(defaultAssignments);
            }
        };
        loadInitialData();
    }, []);

    const handleAssignmentChange = (roleId: string, modelId: string) => {
        setRoleAssignments(prev => ({ ...prev, [roleId]: modelId }));
    };

    const handleRunWorkflow = async () => {
        if (!selectedWorkflow || models.length === 0) {
            alert("Workflow or models not loaded yet.");
            return;
        }
        if (!apiKeys.google || !apiKeys.deepseek) {
            alert("Please set both Google Gemini and DeepSeek API keys in the settings.");
            return;
        }
        
        const unassignedRoles = selectedWorkflow.roles.filter(role => !roleAssignments[role.id]);
        if (unassignedRoles.length > 0) {
            alert(`Please assign a model to the following roles: ${unassignedRoles.map(r => r.name).join(', ')}`);
            return;
        }

        setIsLoading(true);
        setWorkflowState(null);
        console.log("Attempting to run workflow with request:", initialRequest);

        let stateManager: StateManager | null = null;

        intervalRef.current = window.setInterval(() => {
            if (stateManager) {
                setWorkflowState(stateManager.getSnapshot());
            }
        }, 500);

        try {
            const agentPool = new AgentPool(apiKeys);
            const toolbox = new Toolbox();
            
            stateManager = new StateManager(selectedWorkflow, { initial_request: initialRequest });
            setWorkflowState(stateManager.getSnapshot());

            const engine = new WorkflowEngine(selectedWorkflow, models, agentPool, toolbox, stateManager);
            const finalContext = await engine.run(roleAssignments);

            console.log("Workflow finished. Final Context:", finalContext);
            alert("工作流完成！");

        } catch (error) {
            console.error("Failed to run workflow:", error);
            alert(`工作流运行失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (stateManager) {
                setWorkflowState(stateManager.getSnapshot());
            }
            setIsLoading(false);
        }
    };

    return (
        <div className="workflow-manager">
            <h2>工作流管理器</h2>
            <p>此面板用于启动和监控基于新架构的工作流。</p>
            
            {selectedWorkflow && models.length > 0 && (
                <RoleAssignment
                    roles={selectedWorkflow.roles}
                    models={models}
                    assignments={roleAssignments}
                    onAssignmentChange={handleAssignmentChange}
                />
            )}

            <div className="workflow-controls">
                <textarea
                    value={initialRequest}
                    onChange={(e) => setInitialRequest(e.target.value)}
                    placeholder="请输入您的数学问题..."
                    rows={4}
                    disabled={isLoading}
                />
                <button onClick={handleRunWorkflow} disabled={isLoading || !selectedWorkflow}>
                    {isLoading ? '正在运行...' : `运行 ${selectedWorkflow?.name || '工作流'}`}
                </button>
            </div>
            <RealTimeProgressView workflowState={workflowState} />
        </div>
    );
};