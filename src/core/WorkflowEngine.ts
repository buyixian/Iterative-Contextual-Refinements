import {
    Workflow,
    WorkflowContext,
    Stage,
    Step,
    Task,
    ModelDefinition
} from '../types/workflow';
import { AgentPool } from './AgentPool';
import { Toolbox } from './Toolbox';
import { StateManager } from './StateManager';
import Mustache from 'mustache';
import { JSONPath } from 'jsonpath-plus';

/**
 * The core engine responsible for parsing and executing a workflow definition.
 */
export class WorkflowEngine {
    private workflow: Workflow;
    private agentPool: AgentPool;
    private toolbox: Toolbox;
    private stateManager: StateManager;
    private models: Map<string, ModelDefinition>;

    /**
     * Initializes the engine with a workflow, agent pool, toolbox, and state manager.
     * @param workflow The workflow definition object.
     * @param models A list of available model definitions.
     * @param agentPool An instance of AgentPool with registered agents.
     * @param toolbox An instance of Toolbox with registered tools.
     * @param stateManager An instance of StateManager to track the workflow's state.
     */
    constructor(workflow: Workflow, models: ModelDefinition[], agentPool: AgentPool, toolbox: Toolbox, stateManager: StateManager) {
        this.workflow = workflow;
        this.agentPool = agentPool;
        this.toolbox = toolbox;
        this.stateManager = stateManager;
        this.models = new Map(models.map(m => [m.id, m]));
    }

    /**
     * Runs the entire workflow from start to finish.
     * @returns A promise that resolves with the final context after the workflow is complete.
     */
    public async run(roleToModelMap: Record<string, string>): Promise<WorkflowContext> {
        if (!roleToModelMap || Object.keys(roleToModelMap).length === 0) {
            throw new Error("Role-to-model mappings are required to run the workflow.");
        }

        this.stateManager.setWorkflowStatus('running');
        console.log(`Starting workflow: ${this.workflow.name}`);
        
        try {
            let currentContext = this.stateManager.getSnapshot().context;

            for (const stage of this.workflow.stages) {
                currentContext = await this.executeStage(stage, currentContext, roleToModelMap);
                this.stateManager.updateContext(currentContext);
            }

            this.stateManager.setWorkflowStatus('completed');
            console.log(`Workflow ${this.workflow.name} completed.`);
            return this.stateManager.getSnapshot().context;
        } catch (error) {
            this.stateManager.setWorkflowStatus('failed');
            console.error(`Workflow ${this.workflow.name} failed.`, error);
            throw error;
        }
    }

    /**
     * Executes a single stage of the workflow.
     * @param stage The stage to execute.
     * @param context The current workflow context.
     * @returns A promise that resolves with the updated context after the stage is complete.
     */
    private async executeStage(stage: Stage, context: WorkflowContext, roleToModelMap: Record<string, string>): Promise<WorkflowContext> {
        this.stateManager.setStageStatus(stage.stage_id, 'running');
        console.log(`Executing stage: ${stage.name}`);
        let stageContext = { ...context };

        if (stage.for_each) {
            const [loopVar, jsonPath] = stage.for_each.split(' in ');
            const items = JSONPath({ path: jsonPath.trim(), json: context });

            if (Array.isArray(items)) {
                console.log(`Looping for stage "${stage.name}", found ${items.length} items.`);
                for (const item of items) {
                    const loopContext = { [loopVar.trim()]: item };
                    for (const step of stage.steps) {
                        // The step operates on the main stage context, but tasks within it get the loop context
                        stageContext = await this.executeStep(stage.stage_id, step, stageContext, roleToModelMap, loopContext);
                    }
                }
            } else {
                console.warn(`For-each loop in stage "${stage.name}" did not find a valid array at path: ${jsonPath}`);
            }
        } else {
            for (const step of stage.steps) {
                stageContext = await this.executeStep(stage.stage_id, step, stageContext, roleToModelMap);
            }
        }

        this.stateManager.setStageStatus(stage.stage_id, 'completed');
        return stageContext;
    }

    /**
     * Executes a single step within a stage.
     * All tasks within a step are executed in parallel.
     * @param stageId The ID of the parent stage.
     * @param step The step to execute.
     * @param context The current workflow context.
     * @returns A promise that resolves with the updated context after the step is complete.
     */
    private async executeStep(stageId: string, step: Step, context: WorkflowContext, roleToModelMap: Record<string, string>, loopContext: Record<string, any> = {}): Promise<WorkflowContext> {
        this.stateManager.setStepStatus(stageId, step.step_id, 'running');
        console.log(`Executing step: ${step.step_id}`);
        
        const taskPromises = step.tasks.map(task => this.executeTask(stageId, step.step_id, task, context, roleToModelMap, loopContext));
        const taskResults = await Promise.all(taskPromises);

        // Deeply merge results into the context under a structured path
        const newContext = JSON.parse(JSON.stringify(context)); // Deep copy
        if (!newContext.stages) {
            newContext.stages = {};
        }
        if (!newContext.stages[stageId]) {
            newContext.stages[stageId] = { output: {} };
        }
        if (!newContext.stages[stageId].output) {
            newContext.stages[stageId].output = {};
        }

        taskResults.forEach((result, index) => {
            const taskId = step.tasks[index].task_id;
            newContext.stages[stageId].output[taskId] = result;
        });

        this.stateManager.setStepStatus(stageId, step.step_id, 'completed');
        return newContext;
    }

    /**
     * Executes a single task.
     * This is a placeholder and will be expanded to call the AgentPool.
     * @param task The task to execute.
     * @param context The current workflow context.
     * @returns A promise that resolves with the task's output.
     */
    private async executeTask(stageId: string, stepId: string, task: Task, context: WorkflowContext, roleToModelMap: Record<string, string>, loopContext: Record<string, any>): Promise<any> {
        this.stateManager.setTaskState(stageId, stepId, task.task_id, 'running');
        
        const modelId = roleToModelMap[task.role];
        if (!modelId) {
            throw new Error(`No model assigned to role "${task.role}" for task "${task.task_id}".`);
        }

        const roleDefinition = this.workflow.roles.find(r => r.id === task.role);
        if (!roleDefinition) {
            throw new Error(`Role definition for "${task.role}" not found in workflow.`);
        }

        const modelDefinition = this.models.get(modelId);
        if (!modelDefinition) {
            throw new Error(`Model definition for "${modelId}" not found.`);
        }
        
        console.log(`Executing task: ${task.task_id} with role ${roleDefinition.name} (using model ${modelDefinition.name})`);
        
        let prompt = this.hydratePrompt(task.prompt_template, context, loopContext);
        const agent = this.agentPool.getAgent(roleDefinition, modelDefinition);

        try {
            // The tool-use loop has been simplified for now.
            // A more robust implementation will be added later.
            let result = await agent.execute(prompt, context);

            // Attempt to parse the result if it's a JSON string
            try {
                if (typeof result === 'string' && result.startsWith('{') && result.endsWith('}')) {
                    result = JSON.parse(result);
                }
            } catch (e) {
                console.warn(`Task ${task.task_id} result is not a valid JSON object. Treating as a string.`);
            }

            this.stateManager.setTaskState(stageId, stepId, task.task_id, 'completed', result);
            console.log(`Task ${task.task_id} completed with final result:`, result);
            return result;
            
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error';
            this.stateManager.setTaskState(stageId, stepId, task.task_id, 'failed', undefined, errorMessage);
            console.error(`Error executing task ${task.task_id}:`, error);
            throw error;
        }
    }

    /**
     * Replaces placeholders in a prompt template with values from the context.
     * @param template The prompt template string (e.g., "Analyze {{context.initial_request}}").
     * @param context The current workflow context.
     * @returns The hydrated prompt string with values filled in.
     */
    private hydratePrompt(template: string, context: WorkflowContext, loopContext: Record<string, any>): string {
        // Create a combined view for Mustache, prioritizing loop variables
        const view = {
            ...loopContext,
            context: context
        };
        return Mustache.render(template, view);
    }
}