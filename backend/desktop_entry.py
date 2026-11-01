"""Frozen desktop service entry point; no model weights are bundled."""
import os
import multiprocessing
import uvicorn
from app.main import app

if __name__ == '__main__':
    multiprocessing.freeze_support()
    uvicorn.run(app, host='127.0.0.1', port=int(os.environ.get('BA_MATE_PORT', '8000')), loop='asyncio', http='h11', ws='none', access_log=False)
