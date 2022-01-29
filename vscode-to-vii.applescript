on waitForTyping(theMachine)
	tell application "Virtual ]["
		tell theMachine
			type line "VTAB 24: PRINT \"FINISHEDTYPING\""
			repeat
				delay 0.5
				if the last word of line 22 of the screen text = "FINISHEDTYPING" then
					exit repeat
				end if
			end repeat
		end tell
	end tell
end waitForTyping

on enterProgram(theMachine, t)
	tell application "Virtual ]["
		tell theMachine
			type line "NEW"
			type text t
			type line "\n"
		end tell
	end tell
end enterProgram

on run argv

	if (count of argv) is not 3 then
		display alert "wrong number of arguments"
		return
	end if

	set action to item 1 of argv
	set machineType to item 2 of argv
	set programText to item 3 of argv
	set pause to 0.5
		
	if action is not "run" and action is not "enter" then
		display alert "action argument has unknown value " & action
		return
	end if
	if machineType is not "stockiie" and machineType is not "front" then
		display alert "unknown machine type " & machineType
		return
	end if
	
	tell application "Virtual ]["
		activate
		if machineType is "stockiie" then
			set theMachine to (make new AppleIIe)
			delay pause
			reset theMachine
		end if
		if machineType is "front" then
			if count of machine is 0 then
				display alert "front machine requested, but there isn't one"
				return
			end if
			set theMachine to front machine
		end if
		delay pause
		tell theMachine
			set speed to maximum
		end tell
		delay pause
	end tell
		
	enterProgram(theMachine, programText)
	
	if action is "run" then
		waitForTyping(theMachine)
		tell application "Virtual ]["
			tell theMachine
				delay pause
				type line "RUN"
			end tell
		end tell
	end if

end run