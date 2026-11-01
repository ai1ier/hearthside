#!/bin/bash
# Double-click to start the planner, then open http://localhost:5173
cd "$(dirname "$0")"
open "http://localhost:5173" &
python3 serve.py 5173
