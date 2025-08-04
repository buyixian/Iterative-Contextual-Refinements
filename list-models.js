import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 从环境变量获取API密钥
const apiKeyEnv = process.env.GOOGLE_GENAI_API_KEY;

// 处理多个API密钥（逗号分隔）
let apiKeys = [];
if (apiKeyEnv) {
  if (apiKeyEnv.includes(',')) {
    // 将逗号分隔的密钥字符串转换为数组，并去除每个密钥的前后空格
    apiKeys = apiKeyEnv.split(',').map(key => key.trim()).filter(key => key.length > 0);
  } else {
    // 单个密钥
    apiKeys = [apiKeyEnv];
  }
}

if (!apiKeyEnv || apiKeyEnv === 'your_api_key_here') {
  console.error('请在.env文件中设置您的GOOGLE_GENAI_API_KEY');
  console.error('您可以从 https://aistudio.google.com/app/apikey 获取API密钥');
  process.exit(1);
}

// 初始化Google GenAI客户端数组
let aiClients = apiKeys.map(key => new GoogleGenAI({ apiKey: key }));

// 列出模型的异步函数
async function listModels() {
  console.log('正在获取模型列表...');
  
  // 尝试每个API密钥
  for (let i = 0; i < aiClients.length; i++) {
    const ai = aiClients[i];
    console.log(`\n尝试使用密钥 ${i + 1}/${aiClients.length}...`);
    
    try {
      // 调用list方法获取模型列表
      const pager = await ai.models.list({
        config: {
          pageSize: 20,  // 每页显示20个模型
          queryBase: true  // 只列出基础模型
        }
      });
      
      // 获取第一页结果
      const page = await pager.next();
      const models = page.value;
      
      console.log('\n可用的模型:');
      console.log('====================');
      
      // 遍历并显示模型信息
      for (const model of models) {
        console.log(`模型名称: ${model.name || 'N/A'}`);
        console.log(`显示名称: ${model.displayName || 'N/A'}`);
        console.log(`描述: ${model.description || 'N/A'}`);
        console.log(`输入token限制: ${model.inputTokenLimit || 'N/A'}`);
        console.log(`输出token限制: ${model.outputTokenLimit || 'N/A'}`);
        console.log('--------------------------');
      }
      
      console.log(`\n总共找到 ${models.length} 个模型`);
      return; // 成功获取模型列表，退出函数
      
    } catch (error) {
      console.error(`使用密钥 ${i + 1} 获取模型列表时出错:`, error.message);
      if (error.response) {
        console.error('响应详情:', error.response.data);
      }
      
      // 如果是最后一个密钥，重新抛出错误
      if (i === aiClients.length - 1) {
        throw error;
      }
    }
  }
}

// 执行函数
listModels();