# Applesoft BASIC

Language support for Applesoft BASIC in Visual Studio Code.

If you are viewing this on github, you can install the extension from VS Code by searching the Marketplace for `applesoft`.

* Semantic highlights true to Apple //e ROM parsing
* Completions and hovers for all statements
* Hovers for soft switches, ROM routines, etc.
* Diagnostics to identify errors and gotchas
* Renumber lines in a selection or full document
* Handoff code to [Virtual \]\[](https://virtualii.com) (see below)
* Options : see `Ctrl+Comma` -> `Extensions` -> `Applesoft BASIC`
* Commands: see `Ctrl+P` -> `applesoft`
* Activates for file extensions `.bas`, `.abas`, `.A`

<img src="demo.gif" alt="session capture"/>

## Using with Virtual ][

You can use this extension to send an Applesoft code to the [Virtual \]\[](https://virtualii.com) emulator.  To do this, use one of the `Ctrl+P` command variants to enter and optionally run the code:

* `applesoft: Enter in Virtual ][ new machine`: creates a new virtual machine, resets it, and enters the code.  Since this resets the machine while it is waiting for a disk to be inserted, there are no operating system commands available.  This is suitable for self-contained programs.
* `applesoft: Run in Virtual ][ new machine`: same as above, except the code is also run in the same step.
* `applesoft: Enter in Virtual ][ front machine`: attempts to enter code into the machine in the front window.  This allows you to configure the machine any way you like, but is more dangerous, since we cannot know what the machine is doing at the moment you give the command.
* `applesoft: Run in Virtual ][ front machine`: same as above, except the code is also run in the same step.

This capability only applies to MacOS. Note that [Virtual \]\[](https://virtualii.com) is a commercial product, and must be installed separately.