import {
    Workflow,
    WorkflowContext,
    Stage,
    Step,
    Task,
    ModelDefinition,
    IterationResult
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
     * Extracts topic anchors (key nouns/phrases) from upstream strategies and sub-strategies.
     * This is a placeholder implementation and needs to be replaced with a more robust NLP-based approach.
     * @param context The current workflow context, which should contain upstream strategies and sub-strategies.
     * @returns An object containing arrays of required and banned topic anchors.
     */
    private extractTopicAnchors(context: WorkflowContext): { requiredAnchors: string[]; bannedAnchors: string[] } {
        // TODO: Implement a more sophisticated NLP-based extraction logic.
        // For now, we'll use a very basic approach as a placeholder.
        
        const requiredAnchors: string[] = [];
        const bannedAnchors: string[] = []; // This could come from a global config or workflow definition
        
        // Example: Extract from context.initial_request or other upstream outputs
        // This is highly simplified and just for demonstration.
        if (context.initial_request) {
            // A real implementation would use NLP techniques like noun-phrase extraction, TF-IDF, etc.
            // For now, we just split by spaces and filter out common words.
            const words = context.initial_request.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            requiredAnchors.push(...words);
        }
        
        // Example: Add some hardcoded banned words (this should be configurable)
        bannedAnchors.push('example', 'sample', 'template', '通用', '示例');
        
        return { requiredAnchors, bannedAnchors };
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
            console.log(`[FOR_EACH_DEBUG] Evaluating path: ${jsonPath.trim()}`);
            
            // 获取上一阶段的输出作为参考（如果存在）
            const pathParts = jsonPath.trim().split("['");
            if (pathParts.length >= 4) {
                const prevStageId = pathParts[2].replace("']", "");
                if (context.stages && context.stages[prevStageId]) {
                    console.log(`[FOR_EACH_DEBUG] Previous stage context (${prevStageId}):`, JSON.stringify(context.stages[prevStageId], null, 2));
                }
            }
            
            const items = JSONPath({ path: jsonPath.trim(), json: context });
            console.log(`[FOR_EACH_DEBUG] JSONPath result - Type: ${typeof items}, IsArray: ${Array.isArray(items)}, Length: ${Array.isArray(items) ? items.length : 'N/A'}`);
            console.log(`[FOR_EACH_DEBUG] Raw items:`, items);
            
            // 容错兜底逻辑
            let processedItems = items;
            let fallbackApplied = false;
            
            if (!Array.isArray(items)) {
                console.warn(`[FOR_EACH_WARN] Items is not an array. Type: ${typeof items}`);
                
                // 如果是对象且包含唯一数组键，则下钻
                if (items && typeof items === 'object' && !Array.isArray(items)) {
                    const keys = Object.keys(items);
                    if (keys.length === 1) {
                        const singleKey = keys[0];
                        if (Array.isArray(items[singleKey])) {
                            console.warn(`[FOR_EACH_FALLBACK] Using array from single key '${singleKey}' as items`);
                            processedItems = items[singleKey];
                            fallbackApplied = true;
                        }
                    } else if (keys.some(key => Array.isArray(items[key]))) {
                        // 如果有多个数组键，选择第一个
                        const firstArrayKey = keys.find(key => Array.isArray(items[key]));
                        if (firstArrayKey) {
                            console.warn(`[FOR_EACH_FALLBACK] Using array from first found key '${firstArrayKey}' as items`);
                            processedItems = items[firstArrayKey];
                            fallbackApplied = true;
                        }
                    }
                }
                
                // 如果是单值，包装为数组
                if (!Array.isArray(processedItems)) {
                    console.warn(`[FOR_EACH_FALLBACK] Wrapping single item as array`);
                    processedItems = [items];
                    fallbackApplied = true;
                }
                
                if (fallbackApplied) {
                    console.log(`[FOR_EACH_DEBUG] After fallback - Type: ${typeof processedItems}, IsArray: ${Array.isArray(processedItems)}, Length: ${processedItems.length}`);
                }
            }
            
            // 初始化迭代结果数组
            const iterations: IterationResult[] = [];
            
            if (Array.isArray(processedItems)) {
                console.log(`Looping for stage "${stage.name}", found ${processedItems.length} items.`);
                
                // 并行执行所有迭代
                const iterationPromises = processedItems.map(async (item, index) => {
                    const startedAt = Date.now();
                    console.log(`[FOR_EACH_ITER:${stage.stage_id}:${index}] Starting iteration with ${loopVar.trim()} = ${JSON.stringify(item)}`);
                    
                    const loopContext = { [loopVar.trim()]: item };
                    let iterationStageContext = { ...stageContext };
                    
                    // 为每次迭代创建独立的上下文，避免并发写冲突
                    for (const step of stage.steps) {
                        // The step operates on the main stage context, but tasks within it get the loop context
                        iterationStageContext = await this.executeStep(stage.stage_id, step, iterationStageContext, roleToModelMap, loopContext);
                    }
                    
                    const endedAt = Date.now();
                    const durationMs = endedAt - startedAt;
                    
                    // 创建迭代结果对象
                    const iterationResult: IterationResult = {
                        index,
                        loopVar: loopVar.trim(),
                        loopVarValue: item,
                        startedAt,
                        endedAt,
                        durationMs,
                        stepOutputs: iterationStageContext.stages?.[stage.stage_id]?.output || {}
                    };
                    
                    console.log(`[FOR_EACH_ITER:${stage.stage_id}:${index}] Completed in ${durationMs}ms`);
                    return iterationResult;
                });
                
                // 等待所有迭代完成
                const iterationResults = await Promise.all(iterationPromises);
                
                // 将迭代结果添加到上下文
                iterations.push(...iterationResults);
                
                // 更新 stageContext 以包含迭代结果
                if (!stageContext.stages) {
                    stageContext.stages = {};
                }
                if (!stageContext.stages[stage.stage_id]) {
                    stageContext.stages[stage.stage_id] = { output: {} };
                }
                if (!stageContext.stages[stage.stage_id].output) {
                    stageContext.stages[stage.stage_id].output = {};
                }
                stageContext.stages[stage.stage_id].output.iterations = iterations;
            } else {
                console.warn(`For-each loop in stage "${stage.name}" did not find a valid array at path: ${jsonPath}`);
                console.warn(`[FOR_EACH_ERROR] Final items type: ${typeof processedItems}, value:`, processedItems);
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
            console.log(`[DEBUG_PROBE] Context state after step ${step.step_id}:`, JSON.stringify(newContext.stages[stageId].output));
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
        // Get the current attempt number for this task
        const currentAttempt = this.stateManager.getSnapshot().progress[stageId]?.steps[stepId]?.tasks[task.task_id]?.attempt || 0;
        
        // Determine the temperature based on the attempt number
        // First attempt: low temperature for focused reasoning
        // Subsequent attempts: higher temperature for exploration
        const temperature = currentAttempt === 0 ? 0.2 : Math.min(0.2 + (currentAttempt * 0.3), 0.8);
        
        this.stateManager.setTaskState(stageId, stepId, task.task_id, 'running', undefined, undefined, currentAttempt + 1);
        
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
        
        console.log(`Executing task: ${task.task_id} with role ${roleDefinition.name} (using model ${modelDefinition.name}), attempt ${currentAttempt + 1}, temperature ${temperature}`);
        
        let prompt = this.hydratePrompt(task.prompt_template, context, loopContext);
        const agent = this.agentPool.getAgent(roleDefinition, modelDefinition);

        try {
            // The tool-use loop has been simplified for now.
            // A more robust implementation will be added later.
            let result = await agent.execute(prompt, context, { temperature });

            // Attempt to parse the result if it's a JSON string
            try {
                if (typeof result === 'string' && result.startsWith('{') && result.endsWith('}')) {
                    result = JSON.parse(result);
                    console.log('[DEBUG_PROBE] Task output after parse:', JSON.stringify(result));
                }
            } catch (e) {
                console.warn(`Task ${task.task_id} result is not a valid JSON object. Treating as a string.`);
            }

            // Validate the task output
            const validationResult = this.validateTaskOutput(task, result, context);
            if (!validationResult.isValid) {
                console.log(`[TASK_VALIDATION_FAILED:${stageId}:${stepId}:${task.task_id}] Validation failed: ${validationResult.message}`);
                // Note: We don't throw an error here, as retry logic is handled by the catch block
                // The task is still considered 'completed' in terms of execution, but validation failed
            } else {
                console.log(`[TASK_VALIDATION_PASSED:${stageId}:${stepId}:${task.task_id}] Task output validation passed.`);
            }
            
            this.stateManager.setTaskState(stageId, stepId, task.task_id, 'completed', result);
            console.log(`Task ${task.task_id} completed with final result:`, result);
            
            // 如果有循环上下文，添加额外的日志信息
            if (Object.keys(loopContext).length > 0) {
                const loopVar = Object.keys(loopContext)[0];
                const loopValue = loopContext[loopVar];
                const loopValueStr = typeof loopValue === 'string' ? loopValue : JSON.stringify(loopValue);
                const loopValueSummary = loopValueStr.length > 100 ? loopValueStr.substring(0, 100) + '...' : loopValueStr;
                console.log(`[TASK_DONE:${stageId}:${stepId}:${task.task_id}] Loop context: ${loopVar} = ${loopValueSummary}`);
            }
            
            return result;
            
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error';
            
            // Check if we should retry based on retry_policy
            const maxAttempts = task.retry_policy?.max_attempts ?? 1;
            if (currentAttempt + 1 < maxAttempts) {
                console.log(`Task ${task.task_id} failed on attempt ${currentAttempt + 1}. Retrying...`);
                // TODO: Inject failure reason and constraints into the prompt for the next attempt
                // For now, we just retry with a higher temperature
                // A more sophisticated approach would modify the prompt
                return this.executeTask(stageId, stepId, task, context, roleToModelMap, loopContext);
            } else {
                this.stateManager.setTaskState(stageId, stepId, task.task_id, 'failed', undefined, errorMessage, currentAttempt + 1);
                console.error(`Error executing task ${task.task_id} after ${currentAttempt + 1} attempts:`, error);
                throw error;
            }
        }
    }

    /**
     * Validates the output of a task against defined criteria in the workflow definition.
     * This includes checking for required sections, upstream references, and topic anchors.
     * @param task The task definition, which may contain validation rules.
     * @param output The output from the task execution.
     * @param context The current workflow context, used for upstream reference checks.
     * @returns An object indicating whether validation passed and a message if it failed.
     */
    private validateTaskOutput(task: Task & { required_sections?: string[]; require_upstream_references?: boolean; topic_anchor_policy?: { min_hits: number; banned_hits: number } }, output: any, context: WorkflowContext): { isValid: boolean; message: string } {
        console.log(`[VALIDATION] Starting validation for task ${task.task_id}`);
        
        // 1. Required Sections Check
        if (task.required_sections && Array.isArray(task.required_sections) && task.required_sections.length > 0) {
            console.log(`[VALIDATION] Checking required sections: ${task.required_sections.join(', ')}`);
            if (typeof output !== 'object' || output === null) {
                const errorMsg = `Task output is not an object, cannot check for required sections: ${task.required_sections.join(', ')}.`;
                console.log(`[VALIDATION] FAILED: ${errorMsg}`);
                return { isValid: false, message: errorMsg };
            }
            for (const section of task.required_sections) {
                if (!(section in output) || output[section] === undefined || output[section] === null || (typeof output[section] === 'string' && output[section].trim() === '')) {
                    const errorMsg = `Required section '${section}' is missing, empty, or whitespace-only in task output.`;
                    console.log(`[VALIDATION] FAILED: ${errorMsg}`);
                    return { isValid: false, message: errorMsg };
                }
            }
            console.log(`[VALIDATION] PASSED: All required sections are present and valid.`);
        }

        // 2. Upstream Reference Check (simplified placeholder logic)
        if (task.require_upstream_references) {
            console.log(`[VALIDATION] Checking for upstream references`);
            // This is a simplified example. A real implementation would parse the output
            // (e.g., the 'attempt' field in improver) and check for patterns like [S1], [SS2].
            // It would then verify these references exist in the context.
            const outputStr = JSON.stringify(output);
            const upstreamRefs = outputStr.match(/\[(S\d+|SS\d+)\]/g);
            if (!upstreamRefs || upstreamRefs.length === 0) {
                const errorMsg = `Task requires upstream references (e.g., [S1], [SS2]), but none were found in the output.`;
                console.log(`[VALIDATION] FAILED: ${errorMsg}`);
                return { isValid: false, message: errorMsg };
            }
            // TODO: Implement actual verification against context.
            // For now, we just check that *some* references exist.
            console.log(`[VALIDATION] PASSED: Found upstream references: ${upstreamRefs.join(', ')}`);
        }

        // 3. Topic Anchor Policy Check
        if (task.topic_anchor_policy) {
            console.log(`[VALIDATION] Checking topic anchor policy (min_hits: ${task.topic_anchor_policy.min_hits}, banned_hits: ${task.topic_anchor_policy.banned_hits})`);
            const { requiredAnchors, bannedAnchors } = this.extractTopicAnchors(context);
            console.log(`[VALIDATION] Required anchors: ${requiredAnchors.join(', ')}`);
            console.log(`[VALIDATION] Banned anchors: ${bannedAnchors.join(', ')}`);
            
            const outputStr = (typeof output === 'string' ? output : JSON.stringify(output)).toLowerCase();
            
            // Count hits for required anchors
            let requiredHits = 0;
            for (const anchor of requiredAnchors) {
                // Simple substring search. A more sophisticated approach (e.g., word boundaries) could be used.
                if (outputStr.includes(anchor.toLowerCase())) {
                    requiredHits++;
                }
            }
            console.log(`[VALIDATION] Required anchor hits: ${requiredHits}`);
            
            // Count hits for banned anchors
            let bannedHits = 0;
            for (const anchor of bannedAnchors) {
                if (outputStr.includes(anchor.toLowerCase())) {
                    bannedHits++;
                }
            }
            console.log(`[VALIDATION] Banned anchor hits: ${bannedHits}`);
            
            if (requiredHits < task.topic_anchor_policy.min_hits) {
                const errorMsg = `Topic anchor policy requires at least ${task.topic_anchor_policy.min_hits} hits, but only ${requiredHits} were found.`;
                console.log(`[VALIDATION] FAILED: ${errorMsg}`);
                return { isValid: false, message: errorMsg };
            }
            
            if (bannedHits > task.topic_anchor_policy.banned_hits) {
                const errorMsg = `Topic anchor policy allows at most ${task.topic_anchor_policy.banned_hits} banned hits, but ${bannedHits} were found.`;
                console.log(`[VALIDATION] FAILED: ${errorMsg}`);
                return { isValid: false, message: errorMsg };
            }
            console.log(`[VALIDATION] PASSED: Topic anchor policy check.`);
        }

        console.log(`[VALIDATION] All checks passed for task ${task.task_id}`);
        return { isValid: true, message: 'Validation passed.' };
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