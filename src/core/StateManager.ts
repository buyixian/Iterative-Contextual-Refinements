import { 
    Workflow, 
    WorkflowContext, 
    WorkflowState,
    Stage,
    Step,
    Task
} from '../types/workflow';
import { v4 as uuidv4 } from 'uuid';

/**
 * Manages the real-time state of a single workflow instance.
 * This class is responsible for creating, updating, and providing snapshots of the workflow's progress.
 */
export class StateManager {
    private state: WorkflowState;

    /**
     * Initializes the StateManager, creating a new state object for a workflow run.
     * @param workflow The workflow definition.
     * @param initialContext The initial context for the workflow.
     */
    constructor(workflow: Workflow, initialContext: WorkflowContext) {
        this.state = this.initializeState(workflow, initialContext);
    }

    /**
     * Creates the initial, deeply nested state object for the entire workflow.
     * All stages, steps, and tasks are initialized with a 'pending' status.
     * @param workflow The workflow definition.
     * @param initialContext The initial context.
     * @returns The fully initialized WorkflowState object.
     */
    private initializeState(workflow: Workflow, initialContext: WorkflowContext): WorkflowState {
        const progress: WorkflowState['progress'] = {};

        workflow.stages.forEach(stage => {
            progress[stage.stage_id] = {
                status: 'pending',
                steps: {}
            };
            stage.steps.forEach(step => {
                progress[stage.stage_id].steps[step.step_id] = {
                    status: 'pending',
                    tasks: {}
                };
                step.tasks.forEach(task => {
                    progress[stage.stage_id].steps[step.step_id].tasks[task.task_id] = {
                        status: 'pending'
                    };
                });
            });
        });

        return {
            instance_id: uuidv4(),
            workflow_id: workflow.workflow_id,
            status: 'pending',
            context: { ...initialContext },
            progress,
            start_time: Date.now()
        };
    }

    /**
     * Returns a deep copy of the current state.
     * @returns The current WorkflowState snapshot.
     */
    public getSnapshot(): WorkflowState {
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * Updates the status of the entire workflow.
     * @param status The new status of the workflow.
     */
    public setWorkflowStatus(status: WorkflowState['status']) {
        this.state.status = status;
        if (status === 'completed' || status === 'failed') {
            this.state.end_time = Date.now();
        }
    }

    /**
     * Updates the status of a specific stage.
     * @param stageId The ID of the stage to update.
     * @param status The new status.
     */
    public setStageStatus(stageId: string, status: WorkflowState['progress'][string]['status']) {
        if (this.state.progress[stageId]) {
            this.state.progress[stageId].status = status;
        }
    }

    /**
     * Updates the status of a specific step.
     * @param stageId The ID of the parent stage.
     * @param stepId The ID of the step to update.
     * @param status The new status.
     */
    public setStepStatus(stageId: string, stepId: string, status: WorkflowState['progress'][string]['steps'][string]['status']) {
        if (this.state.progress[stageId]?.steps[stepId]) {
            this.state.progress[stageId].steps[stepId].status = status;
        }
    }

    /**
     * Updates the state of a specific task.
     * @param stageId The ID of the parent stage.
     * @param stepId The ID of the parent step.
     * @param taskId The ID of the task to update.
     * @param status The new status.
     * @param output Optional output from the task.
     * @param error Optional error message if the task failed.
     * @param attempt Optional attempt number for retry logic.
     */
    public setTaskState(
        stageId: string,
        stepId: string,
        taskId: string,
        status: WorkflowState['progress'][string]['steps'][string]['tasks'][string]['status'],
        output?: any,
        error?: string,
        attempt?: number
    ) {
        const taskState = this.state.progress[stageId]?.steps[stepId]?.tasks[taskId];
        if (taskState) {
            taskState.status = status;
            if (output !== undefined) taskState.output = output;
            if (error !== undefined) taskState.error = error;
            if (attempt !== undefined) taskState.attempt = attempt;
        }
    }

    /**
     * Updates the global context with new data.
     * @param newContextData An object containing data to be merged into the context.
     */
    public updateContext(newContextData: Partial<WorkflowContext>) {
        this.state.context = { ...this.state.context, ...newContextData };
    }
}