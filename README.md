# Applesoft BASIC

![unit tests](https://github.com/dfgordon/vscode-language-applesoft/actions/workflows/node.js.yml/badge.svg)

Language support for Applesoft BASIC in Visual Studio Code.

If you are viewing this on github, you can install the extension from VS Code by searching the Marketplace for `applesoft`.

* Semantic highlights true to Apple //e ROM parsing
* Completions and hovers for all statements
* Completions and hovers for soft switches, ROM routines, etc.
* Diagnostics to identify errors and gotchas
* Renumber lines in a selection or full document
* Transfer programs to and from Apple ][ emulators (see below)
* View tokenized program as hex dump and unicode text
* Options : see `Ctrl+Comma` -> `Extensions` -> `Applesoft BASIC`
* Commands: see `Ctrl+P` -> `applesoft`
* Activates for file extensions `.bas`, `.abas`, `.A`

<img src="demo.gif" alt="session capture"/>

## Apple ][ Special Addresses

The extension knows over 180 special address locations relevant to Applesoft, DOS 3.3, ProDOS, and the Apple ][ ROM.  Hovering over a literal address argument of `CALL`, `PEEK`, or `POKE` will display information about any address in the database.  Completions for special addresses are triggered when the `space` key is pressed following `CALL`, `PEEK`, or `POKE`.  A convenient way to do this is to select the snippet with the `special` annotation, and then immediately press `space`.

## Using with AppleWin

The extension can transfer programs to and from the [AppleWin](https://github.com/AppleWin/AppleWin) emulator.

* To transfer a program to [AppleWin](https://github.com/AppleWin/AppleWin), first use [AppleWin](https://github.com/AppleWin/AppleWin) to create a state file (press `F11`).  Then in the editor use `Ctrl-P` to select `applesoft: Store program in AppleWin save state`, and select the state file.  Then go to [AppleWin](https://github.com/AppleWin/AppleWin) and press `F12` to load the modified state file.  Type `LIST` to verify success.
	- Any program or variables already in the state file are lost.
	- The state file used for this should be a "safe state," e.g., machine awaiting line entry.
	- Start of program space (103,104) and `HIMEM` are retained, `LOMEM` is reset.  If the program would break `HIMEM` the operation is aborted.
* To transfer a program from [AppleWin](https://github.com/AppleWin/AppleWin), make sure the program is in the emulated machine's memory, and create a state file by pressing `F11`.  Once you have the state file, return to the editor, position the cursor at the insertion point, and use `Ctrl-P` to select `applesoft: Insert program from AppleWin save state`.  Select the state file and the program should be inserted.

Operations with the state file are the same on any platform, but [AppleWin](https://github.com/AppleWin/AppleWin) itself is native to Windows.  Note that [AppleWin](https://github.com/AppleWin/AppleWin) is not part of the extension, and must be installed separately.

## Using with Virtual ][

The extension can transfer programs to and from the [Virtual \]\[](https://virtualii.com) emulator.  To do this, use one of the `Cmd+P` commands:

* `applesoft: Enter in Virtual ][ new machine`: creates a new virtual machine, resets it, and enters the program.  Since this resets the machine while it is waiting for a disk to be inserted, there are no operating system commands available.  This is suitable for self-contained programs.
* `applesoft: Run in Virtual ][ new machine`: same as above, except the program is also run in the same step.
* `applesoft: Enter in Virtual ][ front machine`: attempts to enter program into the machine in the front window.  This allows you to configure the machine any way you like, but is more dangerous, since we cannot know what the machine is doing at the moment you give the command.  Existing program and variables are erased.
* `applesoft: Run in Virtual ][ front machine`: same as above, except the program is also run in the same step.
* `applesoft: Insert program from Virtual ][ front machine`: extracts the Applesoft program currently in the memory of the virtual machine, and inserts it at the position of the cursor or selection.

This capability only applies to MacOS. Note that [Virtual \]\[](https://virtualii.com) is not part of the extension, and must be installed separately.