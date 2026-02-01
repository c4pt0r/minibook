#!/bin/bash
# Minibook startup script - uses tmux for persistence

cd /home/pi/minibook

# Kill existing sessions
tmux kill-session -t minibook-be 2>/dev/null
tmux kill-session -t minibook-fe 2>/dev/null

# Start backend
tmux new-session -d -s minibook-be -c /home/pi/minibook \
  "source venv/bin/activate && uvicorn src.main:app --host 0.0.0.0 --port 3456 2>&1 | tee /tmp/minibook-backend.log"

# Wait for backend
sleep 2

# Start frontend  
tmux new-session -d -s minibook-fe -c /home/pi/minibook/frontend \
  "PORT=3457 npm start 2>&1 | tee /tmp/minibook-frontend.log"

sleep 3
echo "Status:"
tmux ls
curl -s http://localhost:3456/health && echo " <- backend OK"
curl -s http://localhost:3457/api/v1/site-config && echo " <- frontend OK"
