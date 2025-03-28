# Applesoft BASIC

![unit tests](https://github.com/dfgordon/vscode-language-applesoft/actions/workflows/node.js.yml/badge.svg)

Language support for Applesoft BASIC in Visual Studio Code.

* Semantic highlights true to Apple //e ROM parsing
* Comprehensive diagnostics, completions, and hovers
* Management of variables, functions, and line numbers
* Interact with [emulators](#using-with-emulators) and [disk images](#using-with-disk-images)
* Generate hex dump of tokenized program

Activates for file extensions `.bas`, `.abas`, `.A`

<img src="sample/demo.gif" alt="session capture"/>

## Other BASIC extensions

If you use the file extension `.bas`, you may want to disable all other BASIC language extensions, since they will likely use that extension also.  You can use `.abas` to encourage Applesoft to analyze the file while discouraging other BASIC.

## Language Server

The language server is usually bundled with the extension.  If your platform isn't supported directly, you may still be able to use the extension by running `cargo install a2kit` from the terminal.

## Line Numbers

The extension will treat line numbers as document symbols if they are branch destinations.  You can treat these line numbers just as if they were, say, function names in a modern language.  For example, if `GOSUB 100` is found in the document, right-clicking on any reference to line 100 allows you to apply symbol manipulations such as `goto references` and `goto definition`.  The text of any comment on or before the line will be used in the document outline and in line reference hovers.

There are two commands for renumbering.  `Renumber Lines` is used to change the line numbers without changing the ordering.  `Move Lines` is used if a block of lines is being moved to a different location relative to other lines.

## Managing Variables

Applesoft variables and function names have the property that only the first two characters are significant, e.g., `CUTE` and `CUBE` are the same variable.  By default, the extension will underline colliding variable names with a warning squiggle.  In every other respect, the extension will treat colliding variable names as distinct, e.g., using `goto references` on `CUTE` will not find references to `CUBE`.  The assumption here is that colliding variable names are bugs or potential bugs.

You can use `rename symbol` to quickly change the names of variables or functions.  You must include any desired suffix (`$` or `%`) in the replacement text, even though VS Code may offer a default without this.

Variables and functions only appear in the symbol outline where they are assigned, defined, or dimensioned.

## Declarations and Definitions

The `DIM` statement is the only item we recognize as a declaration.  Using `goto declaration` on an array reference will find all the places in the file where it is dimensioned.

Using `goto definition` on a non-array variable will find all the places in the file where it is assigned or read from an input source.

Using `goto definition` on a function will find the function definition.

Using `goto definition` on a line number reference will find the line.

## Multi-File Programs and Program Flow

As of this writing, the extension analyzes each file in isolation.  For a multi-file project it may be desirable to suppress warnings related to undeclared or unassigned variables (see extension settings).  Also as of this writing, analysis of program flow is very limited.  As a result, errors such as `NEXT WITHOUT FOR`, `REDIM'D ARRAY`, etc., are not detected.

## Minify and Tokenize

The extension provides a `minify` command to reduce the memory used by your Applesoft program.  It creates a new document with the following transformations:

* Level 1
	- Strip all comments
	- Reduce variable and function names to the first two characters
	- Strip unnecessary separators and unquotes
* Level 2
	- Delete unnecessary lines (those starting with `REM`)
* Level 3
	- Combine lines where possible
	- Apply level 1 transformations to ampersand commands

The minifier should never break valid, self-contained code.  Levels 2 and 3 could break external code that references line numbers.  The minifier does not renumber.  Renumbering can be done using the `renumber lines` command.

Make sure you review and repair all variable name collisions before minifying.

If you want to see how much space you have saved, you can use the `show tokenized program` command on the transformed and untransformed code. Note the ending addresses in the two cases.

## Apple ][ Special Addresses

The extension knows hundreds of special address locations relevant to Applesoft, DOS 3.3, ProDOS, and the Apple ][ ROM.  Hovering over a literal address argument of `CALL`, `PEEK`, or `POKE` will display information about any address in the database.  Completions for special addresses are triggered when the `space` key is pressed following `CALL`, `PEEK`, or `POKE`.  A convenient way to do this is to select the snippet with the `special` annotation, and then immediately press `space`.

## Hex Escapes

Some Applesoft programs, especially those written in the early days, have `CR`, `LF`, or other control characters embedded in strings, comments, or data.  Hex escapes are used to allow such files to be parsed as normal line entry.  For example, `REM first line\x0anext line` uses `\x0a` to represent a line feed in the comment.

The extension evaluates *only* hex escapes.  Sequences like `\n`, `\\`, etc. are always treated literally.  If you need to escape the escape, hex-escape it, e.g. `\xff` can be escaped as `\x5cxff`.

*Only insert escapes by hand if there is no alternative*.

In particular, use `CHR$`, or insert control codes directly using, e.g., the `Insert Unicode` extension.  If escapes cannot be avoided be aware of the following compatibility table:

Action | External Software | Escapes OK
-------|---------------------|-----------
Disk Image Transfer | a2kit | Yes
Save State Interaction | AppleWin | Yes
Enter/Run Program | Virtual II | No
Copy & Paste | any | No

## Ampersand Commands

Although the syntax for ampersand commands is technically arbitrary, the extension imposes limits in order to provide an interpretation.  The minifier will pass over ampersand commands in order to avoid breaking any assumptions made by the user's ampersand parser.  See the upstream parser's [wiki](https://github.com/dfgordon/tree-sitter-applesoft/wiki) for more.

## Using with Emulators

### AppleWin

You can transfer programs to and from [AppleWin](https://github.com/AppleWin/AppleWin).  Provided there are no escapes, you can use the emulator's own clipboard functions.  The extension also provides the following save state interactions:

* To transfer a program to [AppleWin](https://github.com/AppleWin/AppleWin), first use [AppleWin](https://github.com/AppleWin/AppleWin) to create a state file (press `F11`).  Then in the editor use `Ctrl+P` to select `applesoft: Store program in AppleWin save state`, and select the state file.  Then go to [AppleWin](https://github.com/AppleWin/AppleWin) and press `F12` to load the modified state file.  Type `LIST` to verify success.
	- Any program or variables already in the state file are lost.
	- The state file used for this should be a "safe state," e.g., machine awaiting line entry.
	- Start of program space (103,104) and `HIMEM` are retained, `LOMEM` is reset.  If the program would break `HIMEM` the operation is aborted.
* To transfer a program from [AppleWin](https://github.com/AppleWin/AppleWin), make sure the program is in the emulated machine's memory, and create a state file by pressing `F11`.  Once you have the state file, return to the editor, position the cursor at the insertion point, and use `Ctrl+P` to select `applesoft: Insert program from AppleWin save state`.  Select the state file and the program should be inserted.

Operations with the state file are the same on any platform, but [AppleWin](https://github.com/AppleWin/AppleWin) itself is native to Windows.  Note that [AppleWin](https://github.com/AppleWin/AppleWin) is not part of the extension, and must be installed separately.

### Virtual ][

You can transfer programs to and from the [Virtual \]\[](https://virtualii.com) emulator.  Provided there are no escapes, you can use the emulator's own clipboard functions.  The extension also provides the following commands (`Cmd+P`):

* `applesoft: Enter in Virtual ][ new machine`: creates a new virtual machine, resets it, and enters the program.  Since this resets the machine while it is waiting for a disk to be inserted, there are no operating system commands available.  This is suitable for self-contained programs with no escapes.
* `applesoft: Run in Virtual ][ new machine`: same as above, except the program is also run in the same step.
* `applesoft: Enter in Virtual ][ front machine`: attempts to enter program into the machine in the front window.  This allows you to configure the machine any way you like, just make sure the machine is in a safe state when the command is given.  Existing program and variables are erased.  No escapes.
* `applesoft: Run in Virtual ][ front machine`: same as above, except the program is also run in the same step.
* `applesoft: Insert program from Virtual ][ front machine`: extracts the Applesoft program currently in the memory of the virtual machine, and inserts it at the position of the cursor or selection.

This capability only applies to MacOS. Note that [Virtual \]\[](https://virtualii.com) is not part of the extension, and must be installed separately.

## Using with Disk Images

You can transfer programs to and from disk images.  As of this writing, the supported disk image types are `2mg`, `d13`, `do`, `dsk`, `nib`, `po`, `woz`.  Use `Ctrl+P` or `Cmd+P` to initiate one of the following:

* `applesoft: Insert program from disk image`: brings up a file selector allowing you to choose an image file.  Once done, use the mini-menu to traverse the image's directory tree (if applicable) and select an Applesoft file.  Only directories and Applesoft files are shown.

* `applesoft: Save program to disk image`: first you are prompted for the program's load address, after which the file selector is brought up.  After choosing the image file, use the mini-menu to traverse the image's directory tree (if applicable) and select a directory (`.` selects the current level).  Finally enter the name that the saved file will be given on the disk image.  If the file already exists you must respond to a warning.

Another way to access disk images directly from VS Code is with the `Disk Image Notebook` extension.

Recommendations

* do not write to a disk image that is mounted in an emulator
* backup disk image before writing to it
