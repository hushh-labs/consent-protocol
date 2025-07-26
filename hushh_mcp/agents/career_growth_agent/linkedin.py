import pandas as pd
import zipfile
import io
from fastapi import HTTPException

def parse_linkedin_zip(file_bytes: bytes):
    try:
        z = zipfile.ZipFile(io.BytesIO(file_bytes))
        file_list = z.namelist()

        # Auto-find files by name match
        skills_file = next((f for f in file_list if "skills.csv" in f.lower()), None)
        profile_file = next((f for f in file_list if "profile.csv" in f.lower()), None)

        if not skills_file:
            raise HTTPException(status_code=400, detail="Missing file in zip: Skills.csv")
        if not profile_file:
            raise HTTPException(status_code=400, detail="Missing file in zip: Profile.csv")

        # Read CSVs
        skills_df = pd.read_csv(z.open(skills_file))
        profile_df = pd.read_csv(z.open(profile_file))

        # Extract relevant info
        skills = skills_df['Name'].dropna().tolist()
        experience = profile_df['Headline'].dropna().tolist()

        return skills, experience

    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing expected file in zip: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing LinkedIn zip: {str(e)}")
