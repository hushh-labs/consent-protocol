# 🚀 Sprint 1 Report

## ✅ What we have done till now
- We have successfully created an **AI Agent** that:
  - Takes input from an **Excel file** containing a list of recipients.
  - Automatically **writes the content of the email** with proper placeholders (like names, designations, etc.).
  - Has a **human-in-the-loop** verification:
    - The draft email content is first shown to the user.
    - The user can **review and suggest changes**.
    - The email is sent **only when the user approves** the final content.
  - Finally, the agent **sends the email** to all people listed in the Excel sheet.

**In short:**  
➡️ Upload Excel → Agent drafts email → Human verifies → Mass email is sent. ✅

---

## 📌 What we are planning to do in the future
- 🔹 **Create a Frontend and Backend** for a smoother user experience.
- 🔹 Add features to **prioritize incoming emails** based on importance.
- 🔹 **Categorize emails** into sections (like Work, Personal, High Priority, etc.) according to user preferences.
- 🔹 Integrate these features seamlessly into the AI agent workflow.

---

## 📥 How to use this Git repository

Follow these steps to set up and run the project on your machine:

### 1️⃣ Clone the repository
Open your terminal and run:
```bash
git clone https://github.com/AAK121/Hushh_Hackathon_Team_Mailer.git
```
### 2️⃣ Go into the project folder
```
cd Hushh_Hackathon_Team_Mailer

```
### 3️⃣ Install all dependencies
```
pip install -r requirements.txt
```
### 4️⃣ Navigate to the Agent folder
```
cd Hushh_Hackathon_Team_Mailer/hushh_mcp/agents/Mailer/
```
### 5️⃣ Run the AI Agent
Currently, we run the agent through the Jupyter Notebook:
Open the file excel.ipynb in Jupyter Notebook or Jupyter Lab.
Run the cells step by step.
```