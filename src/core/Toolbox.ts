/**
 * Defines the interface for a tool that can be used by an agent.
 */
export interface ITool {
    name: string;
    description: string;
    // A more robust implementation would have a structured schema for args
    execute(args: any): Promise<any>;
}

/**
 * A concrete implementation of a tool for reading files. (Mock for now)
 */
class ReadFileTool implements ITool {
    public name = "readFile";
    public description = "Reads the content of a specified file.";

    public async execute(args: { path: string }): Promise<string> {
        console.log(`TOOL: Reading file from ${args.path}`);
        // In a real implementation, we would use fs.readFile or an equivalent
        return `Mock content of ${args.path}`;
    }
}

/**
 * A concrete implementation of a tool for writing files. (Mock for now)
 */
class WriteFileTool implements ITool {
    public name = "writeFile";
    public description = "Writes content to a specified file.";

    public async execute(args: { path: string, content: string }): Promise<string> {
        console.log(`TOOL: Writing to file ${args.path} with content: ${args.content.substring(0, 50)}...`);
        // In a real implementation, we would use fs.writeFile or an equivalent
        return `Successfully wrote to ${args.path}`;
    }
}


/**
 * Manages a collection of available tools that agents can be authorized to use.
 */
export class Toolbox {
    private tools: Map<string, ITool> = new Map();

    constructor() {
        // Register default tools upon initialization
        this.registerTool(new ReadFileTool());
        this.registerTool(new WriteFileTool());
    }

    /**
     * Registers a tool, making it available for use.
     * @param tool An instance of a class that implements the ITool interface.
     */
    public registerTool(tool: ITool) {
        if (this.tools.has(tool.name)) {
            console.warn(`Tool with name "${tool.name}" is already registered. Overwriting.`);
        }
        console.log(`Registering tool: ${tool.name}`);
        this.tools.set(tool.name, tool);
    }

    /**
     * Executes a specified tool with the given arguments.
     * @param name The name of the tool to execute.
     * @param args The arguments to pass to the tool's execute method.
     * @returns A promise that resolves with the result of the tool's execution.
     * @throws If the tool is not found.
     */
    public async runTool(name: string, args: any): Promise<any> {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool "${name}" not found.`);
        }
        return tool.execute(args);
    }

    /**
     * Gets a list of all available tool names.
     * @returns An array of tool names.
     */
    public getAvailableTools(): string[] {
        return Array.from(this.tools.keys());
    }
}