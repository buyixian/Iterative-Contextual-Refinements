# Iterative Studio

Iterative Studio is an advanced web application that enables iterative refinement of various content types through multiple AI-powered pipelines. It supports HTML generation, creative writing, mathematical problem solving, agent-based processing, and React application development.

## Features

- **Multiple Modes**: HTML, Creative Writing, Math, Agent, and React development
- **AI Provider Support**: Google Gemini and OpenAI-compatible APIs
- **Iterative Refinement**: Multiple rounds of generation, critique, and improvement
- **Variant Testing**: Run multiple pipelines with different temperatures
- **Customizable Prompts**: Fine-tune the AI behavior with custom prompts
- **Export/Import**: Save and load configurations

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. Clone or download this repository
2. Run the start script:
   ```bash
   start.bat
   ```
   or on Unix systems:
   ```bash
   ./start.sh
   ```

### API Key Setup

1. **Google Gemini**:
   - Get an API key from [Google AI Studio](https://aistudio.google.com/)
   - Enter it in the web interface when prompted

2. **OpenAI Compatible**:
   - Get an API key from OpenAI, Azure OpenAI, or another compatible provider
   - Enter it in the web interface when prompted
   - Optionally set a custom base URL and model name

### Environment Variables

You can also set API keys using environment variables:

- `API_KEY`: For Google Gemini API key
- `OPENAI_API_KEY`: For OpenAI compatible API key
- `OPENAI_BASE_URL`: Custom base URL for OpenAI compatible API (optional)
- `OPENAI_MODEL_NAME`: Default model name for OpenAI compatible API (optional)

Create a `.env` file in the project root with these variables:

```env
API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL_NAME=gpt-4-turbo
```

## Usage

1. Select your desired mode (HTML, Writing, Math, Agent, or React)
2. Enter your initial idea, problem, or request
3. Select model variants (temperatures) to test
4. Click "Generate" to start the iterative process
5. View and compare results from different variants
6. Export configurations for later use

## Scripts

- `start.bat`: Main startup script with menu options
- `list-models.js`: List available Google GenAI models
- `list-openai-models.js`: List available OpenAI compatible models

## Development

To run the development server directly:

```bash
npm run dev
```

To build for production:

```bash
npm run build
```

To preview the production build:

```bash
npm run preview
```

## Modes

### HTML Mode
Generate and refine HTML pages based on your ideas.

### Creative Writing Mode
Create and improve creative texts through multiple refinement cycles.

### Math Mode
Solve mathematical problems using strategic approaches and hypothesis exploration.

### Agent Mode
Process complex requests through an agent-based approach with multiple refinement loops.

### React Mode
Generate complete React applications based on your requirements.

## Customization

You can customize prompts for each mode through the "Customize Prompts" section in the sidebar. This allows you to fine-tune the AI behavior for your specific needs.

## Export/Import

Configurations can be exported to JSON files and imported later, allowing you to save and share your workflows.

## Troubleshooting

### CORS Issues with OpenAI Compatible APIs

If you encounter CORS errors when using OpenAI compatible APIs, try these solutions:

1. **Use a CORS Proxy**: 
   - Services like https://corsproxy.io/ or https://allorigins.win/ can help bypass CORS restrictions
   - Example: Instead of `https://api.openai.com/v1`, use `https://corsproxy.io/?https://api.openai.com/v1`

2. **Local Proxy Server**:
   - Set up a simple local proxy using Node.js or Python to forward requests
   - This avoids browser CORS restrictions entirely

3. **Browser Extensions**:
   - Install CORS-unblocking extensions for development (not recommended for production)

4. **Server-side Proxy**:
   - Configure your backend to proxy API requests, which avoids CORS issues completely

### API Key Errors

- Ensure your API key is correct and has proper permissions
- Check that your account has sufficient credits/balance
- Verify the base URL is correct for your provider

### Model Not Found

- Check that the model name is correct and supported by your provider
- Some providers may require specific model identifiers
