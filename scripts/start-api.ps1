Set-Location "$PSScriptRoot\..\apps\api"
python -m uvicorn app.main:app --reload --port 8000
