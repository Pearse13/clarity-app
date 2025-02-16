# Roadmap for “Clarity” Web App Backend

**Overview of the “Clarity” Web App (3–5 lines)**  
Clarity is a simple web application that uses a language model (such as ChatGPT) to transform text into two forms: one simplified and one sophisticated. Users can input up to 250 characters and choose from scales (1–5) for both simplification and sophistication. When they submit their text, the app provides two rewritten versions that match the requested complexity levels.

---

## 1. Initialize and Configure the Project
1. Create a new backend application using your preferred framework (e.g., Node.js with Express, Python with Flask/FastAPI).  
2. Set up version control (e.g., Git) to track all changes and maintain a clean project history.  
3. Follow any recommended file structure conventions of your chosen framework.

## 2. Install Required Dependencies
1. Install the official OpenAI SDK (e.g., `openai` for Node.js or Python) or any library necessary for calling the ChatGPT API.  
2. Include libraries for handling HTTP requests/responses (e.g., `express` or `flask`).  
3. Install packages for JSON parsing if needed.

## 3. Set Up Environment Variables
1. Define an environment variable (e.g., `OPENAI_API_KEY`) for your ChatGPT API key.  
2. Store credentials securely so they are not exposed in the public repository.  
3. Access this key in your server code (e.g., `process.env.OPENAI_API_KEY` for Node.js).

## 4. Define the `/transformText` Endpoint
1. Create a **POST** route at `"/transformText"`.  
2. The request body should include:
   - `text` (a string, up to 250 characters)  
   - `simplifyLevel` (integer 1–5)  
   - `sophisticateLevel` (integer 1–5)

## 5. Validate Incoming Data
1. Confirm that `text` is provided and does not exceed 250 characters.  
2. Ensure `simplifyLevel` and `sophisticateLevel` are integers within 1–5.  
3. If validation fails, respond with an HTTP 400 (Bad Request) and a descriptive message.

## 6. Prepare and Send Requests to the Language Model
1. Construct two separate prompts:
   - One prompt for the **simplified** version, incorporating `simplifyLevel`.  
   - Another prompt for the **sophisticated** version, incorporating `sophisticateLevel`.  
2. Use the OpenAI SDK (e.g., `openai.createChatCompletion`) to submit these prompts.

## 7. Handle the API Responses
1. Capture responses from the language model.  
2. Extract the rewritten text for both the simplified and sophisticated versions.  
3. If the API call fails, respond with an appropriate HTTP status (e.g., 500) and an error message.

## 8. Return the Final Output
1. Send a JSON response containing the transformed text, for example:
   ```json
   {
     "simplifiedText": "...",
     "sophisticatedText": "..."
   }
