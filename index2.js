import mongoose from 'mongoose';
import { GoogleGenerativeAI } from "@google/generative-ai";
import readlineSync from "readline-sync";

// Database Connection
mongoose.connect("mongodb+srv://saugatg189:uR8twLE2inDfvZPH@cluster0.cwznv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0");

// Todo Model
const Todo = mongoose.model('Todo', new mongoose.Schema({
  title: String
}, { timestamps: true }));

const genAI = new GoogleGenerativeAI("AIzaSyC5sXXWXJcIzOncdN4zSDcw5oCxfxQA5JQ");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

function extractJSON(text) {
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
  return jsonMatch ? jsonMatch[1] : text;
}

const todoOperations = {
  createTodo: async (title) => {
    const todo = new Todo({ title });
    return await todo.save();
  },
  getTodos: async () => await Todo.find().lean(),
  deleteTodo: async (id) => await Todo.findByIdAndDelete(id)
};

const prompt = `
You are an AI To-Do List Assistant. Follow these rules:
1. Use ONLY JSON format for responses
2. Response structure must be one of:
   - { "type": "action", "function": "getTodos" }
   - { "type": "action", "function": "createTodo", "input": "string" }
   - { "type": "action", "function": "deleteTodo", "input": "string" }
   - { "type": "output", "output": "final response" }
   - { "type": "exit", "reason": "exit reason" }

3. If user says "exit", "quit", or "goodbye", respond with:
   { "type": "exit", "reason": "User requested to exit" }

Examples:
{"type": "exit", "reason": "User requested to exit"}
`;

async function handleUserInput() {

  let chatHistory = [];
  
  while (true) {
    console.log(`Hello, User how are you doing?`)
    const userInput = readlineSync.question('\nUser: ');
    
    // Exit condition check
    if (userInput.toLowerCase() === 'exit') {
      console.log("Exiting...");
      await mongoose.disconnect();
      process.exit(0);
    }

    chatHistory.push({ type: "user", content: userInput });

    const fullPrompt = `${prompt}\nConversation History:\n${
      chatHistory.map(msg => JSON.stringify(msg)).join("\n")
    }\nAssistant: `;



    try {
      const result = await model.generateContent(fullPrompt);
      console.log(result)
      const responseText = extractJSON(result.response.text().trim());
      console.log(responseText)
      const response = JSON.parse(responseText);
      console.log(response)


      // Handle exit command from AI
      if (response.type === "exit") {
        console.log(`\n${response.reason}`);
        await mongoose.disconnect();
        process.exit(0);
      }

      // Handle actions
      if (response.type === "action") {
        const operation = todoOperations[response.function];
        if (!operation) throw new Error('Invalid operation');
        

        const result = await operation(response.input);
        console.log(`Operation ${response.function} successful:`, result);
      }
      
      // Handle final output
      if (response.type === "output") {
        console.log(`\nAI Response: ${response.output}`);
      }

    } catch (error) {
      console.error("Error:", error.message);
    }
  }
}

// Start the application
mongoose.connection.once('open', async () => {
  console.log("Connected to MongoDB");
  await handleUserInput();
});