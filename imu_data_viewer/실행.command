#!/bin/zsh
set -e
cd "${0:A:h}"
port=8088
python3 -m http.server "$port" &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT INT TERM
sleep 1
open "http://127.0.0.1:$port"
wait "$server_pid"
