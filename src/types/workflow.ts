/**
 * =================================================================
 * Core Data Structures for the Multi-Agent Workflow Engine
 * 
 * Based on the design in ARCHITECTURE.md
 * =================================================================
 */

/**
 * Represents a model available for use, as defined in models.json.
 */
export interface ModelDefinition {
  id: string;
  name: string;
  provider: 'google' | 'openai_compatible';
  api_base_url?: string; // Optional, for self-hosted or compatible endpoints
}

/**
 * Defines a single, atomic unit of work to be performed by an agent.
 */
export interface Task {
  task_id: string;
  role: string; // The role this task fulfills, e.g., "proposer", "critiquer"
  prompt_template: string; // Uses {{...}} for variable substitution from context
  // Optional validation and retry configuration for the task's output
  required_sections?: string[];
  require_upstream_references?: boolean;
  topic_anchor_policy?: {
    min_hits: number;
    banned_hits: number;
  };
  reproducibility_requirements?: string[];
  retry_policy?: {
    max_attempts: number;
    backoff: 'linear' | 'exponential';
  };
}

/**
 * A collection of tasks that are executed in parallel.
 */
export interface Step {
  step_id: string;
  tasks: Task[];
}

/**
 * A collection of steps that are executed sequentially.
 */
export interface Stage {
  stage_id: string;
  name: string;
  steps: Step[];
  loop_count?: number; // For iterative stages
  for_each?: string; // For dynamic looping over context data
}

/**
 * The complete definition of a workflow.
 */
/**
 * Defines a role within a workflow that can be assigned to an agent.
 */
export interface WorkflowRole {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
}

export interface Workflow {
  workflow_id: string;
  name: string;
  description?: string;
  roles: WorkflowRole[];
  stages: Stage[];
}

/**
 * The global context object that persists throughout a workflow execution.
 * It holds all state, including initial inputs and outputs from all stages.
 */
export interface WorkflowContext {
  initial_request: string;
  [key: string]: any; // Allows for dynamic storage of stage/step outputs
}

/**
 * Represents the result of a single iteration in a for_each loop
 */
export interface IterationResult {
  index: number;
  loopVar: string;
  loopVarValue: any;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  stepOutputs: Record<string, any>;
}

/**
 * Represents the live, running state of a workflow instance.
 */
export interface WorkflowState {
  instance_id: string;
  workflow_id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  context: WorkflowContext;
  progress: {
    [stage_id: string]: {
      status: 'pending' | 'running' | 'completed' | 'failed';
      steps: {
        [step_id: string]: {
          status: 'pending' | 'running' | 'completed' | 'failed';
          tasks: {
            [task_id: string]: {
              status: 'pending' | 'running' | 'completed' | 'failed';
              output?: any;
              error?: string;
              attempt?: number; // Track the number of attempts for retry logic
            };
          };
        };
      };
    };
  };
  error?: string;
  start_time?: number;
  end_time?: number;
}

/**
 * The interface that all AI agents must implement.
 */
export interface IAgent {
  /**
   * The configuration of the agent.
   */
  model: ModelDefinition;
  system_prompt: string;

  /**
   * Executes a task based on a given prompt and context.
   * @param prompt The final, rendered prompt to be sent to the model.
   * @param context The current state of the workflow for additional context.
   * @param options Optional parameters for the execution, such as sampling settings.
   * @returns A promise that resolves to the string output from the model.
   */
  execute(prompt: string, context: WorkflowContext, options?: { temperature?: number }): Promise<string>;
}