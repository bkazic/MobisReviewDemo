:Loop

#Start the service in the new window
START "Demo" cmd.exe /c "call init.bat & run.bat"

#Run the Imputor and loop it
cd Imputor
call init.bat
call run.bat
cd..

#Kill the service
TaskKill /FI "WindowTitle eq Demo" 1>Nul

GOTO :Loop