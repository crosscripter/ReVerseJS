@echo off
echo Are you sure you want to RESET ALL YOUR PROGRESS?
echo Press CTRL+C to cancel, otherwise press any other key to PERMANENTLY DELETE ALL PROGRESS.
pause
del verses.txt buckets.json /Q
echo Progress has been reset