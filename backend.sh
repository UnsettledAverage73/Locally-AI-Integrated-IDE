# Ensure Ollama is running
./start_ollama.sh

cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --reload > uvicorn_output.log 2>&1
