from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from hushh_mcp.agents.career_growth_agent.career import CareerGrowthAgent
from hushh_mcp.consent.token import issue_token
from hushh_mcp.types import ConsentScope
from .linkedin import parse_linkedin_zip
import os
import tempfile

app = FastAPI()

@app.post("/upload_linkedin/")
async def upload_linkedin(
    user_id: str = Form(...),
    file: UploadFile = File(...)
):
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are supported.")
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File is empty or not readable.")   
    # Issue consent token
    token = issue_token(user_id=user_id, agent_id="Career Growth Agent", scope=ConsentScope.CUSTOM_LINKEDIN_UPLOAD)

    # Save uploaded zip file temporarily
    temp_dir = tempfile.mkdtemp()
    file_path = os.path.join(temp_dir, file.filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())

    try:
        # Parse the LinkedIn .zip archive
        parsed_data = CareerGrowthAgent().extract_career_data(user_id,token.token, file_bytes)
        return {
            "message": "LinkedIn archive parsed successfully.",
            "parsed_data": parsed_data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error while parsing: {str(e)}")
