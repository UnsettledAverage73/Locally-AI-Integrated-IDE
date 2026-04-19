#!/bin/bash
RESULT=$(python3 fibonacci.py 10)
if [ "$RESULT" == "55" ]; then
  echo "SUCCESS: Calculated 55"
  exit 0
else
  echo "FAILURE: Expected 55 but got $RESULT"
  exit 1
fi
