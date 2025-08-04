import fs from 'fs';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 从环境变量获取API密钥和基础URL
const apiKeyEnv = process.env.OPENAI_API_KEY;
const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

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
  console.error('请在.env文件中设置您的OPENAI_API_KEY');
  console.error('您可以在OpenAI网站或支持OpenAI API的提供商处获取API密钥');
  process.exit(1);
}

// 列出模型的异步函数
async function listModels() {
  console.log('正在获取OpenAI兼容的模型列表...');
  console.log(`使用API端点: ${baseUrl}`);
  
  // 尝试每个API密钥
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    console.log(`\n尝试使用密钥 ${i + 1}/${apiKeys.length}...`);
    
    try {
      // 调用OpenAI API的models端点
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      console.log('\n可用的模型:');
      console.log('====================');
      
      // 按ID排序模型
      const sortedModels = data.data.sort((a, b) => a.id.localeCompare(b.id));
      
      // 遍历并显示模型信息
      for (const model of sortedModels) {
        console.log(`模型ID: ${model.id}`);
        console.log(`所有者: ${model.owned_by}`);
        console.log(`创建时间: ${new Date(model.created * 1000).toLocaleString()}`);
        
        // 如果有其他属性，也显示出来
        if (model.object) {
          console.log(`对象类型: ${model.object}`);
        }
        
        console.log('--------------------------');
      }
      
      console.log(`\n总共找到 ${sortedModels.length} 个模型`);
      return; // 成功获取模型列表，退出函数
      
    } catch (error) {
      console.error(`使用密钥 ${i + 1} 获取模型列表时出错:`, error.message);
      if (error.response) {
        console.error('响应详情:', error.response.data);
      }
      
      // 如果是最后一个密钥，重新抛出错误
      if (i === apiKeys.length - 1) {
        throw error;
      }
    }
  }
}

// 执行函数
listModels();