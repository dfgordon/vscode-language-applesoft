on waitForTyping(theMachine)
	tell application "Virtual ]["
		tell theMachine
			type line "VTAB 24: PRINT \"FINISHED\""
			repeat
				delay 0.5
				if the last word of line 22 of the screen text = "FINISHED" then
					exit repeat
				end if
			end repeat
		end tell
	end tell
end waitForTyping

on enterProgram(theMachine, t)
	tell application "Virtual ]["
		tell theMachine
			type line "TEXT"
			type line "HOME"
			type line "NEW"
			type line "POKE 35,15"
			type text t
			type line ""
			type line "POKE 35,24"
		end tell
	end tell
end enterProgram

on run argv
	
	if (count of argv) is not 5 then
		error "wrong number of arguments" number 9000
	end if
	
	set action to item 1 of argv
	set machineType to item 2 of argv
	set runSpeed to item 3 of argv
	set colorMonitor to item 4 of argv
	set programText to item 5 of argv
	set pause to 0.5
	
	if not {"run","enter","get"} contains action then
		error "action argument has unknown value " & action number 9001
	end if
	if not {"appleii","appleiiplus","appleiie","front"} contains machineType then
		error "unknown machine type " & machineType number 9002
	end if
	if not {"regular","high","maximum"} contains runSpeed then
		error "speed is not valid " & runSpeed number 9003
	end if
	if colorMonitor is not "0" and colorMonitor is not "1" then
		error "color is not valid " & colorMonitor number 9004
	end if
	
	tell application "Virtual ]["
		activate
		if machineType is "appleii" then
			set theMachine to (make new AppleII)
			delay pause
			reset theMachine
		end if
		if machineType is "appleiiplus" then
			set theMachine to (make new AppleIIPlus)
			delay pause
			reset theMachine
		end if
		if machineType is "appleiie" then
			set theMachine to (make new AppleIIe)
			delay pause
			reset theMachine
		end if
		if machineType is "front" then
			if (count of machine) is 0 then
				error "front machine requested, but there isn't one" number 9005
			end if
			set theMachine to front machine
		end if
		delay pause
		if action is not "get"
			tell theMachine
				set speed to maximum
				if machineType is not "front" and colorMonitor is "0" then
					set monochrome screen to true
				end if
				if machineType is not "front" and colorMonitor is "1" then
					set monochrome screen to false
				end if
			end tell
		end if
		delay pause
	end tell

	if action is not "get"
		enterProgram(theMachine, programText)
	else
		--- in this case programText is the path for the scratch file
		set scratchPath to POSIX path of programText
		tell application "Virtual ]["
			dump memory theMachine address 0 into scratchPath length 49152
		end tell
	end if
	
	if action is "run" then
		waitForTyping(theMachine)
		tell application "Virtual ]["
			tell theMachine
				delay pause
				if runSpeed is "regular" then
					set speed to regular
				else if runSpeed is "high" then
					set speed to high
				else
					set speed to maximum
				end if
				type line "RUN"
			end tell
		end tell
	end if
	
end run