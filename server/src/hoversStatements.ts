import * as vsserv from 'vscode-languageserver/node';

function MarkdownString(s: string): vsserv.MarkupContent
{
	return { kind: 'markdown', value: s };
}

function exampleString(examples: string[]) : vsserv.MarkupContent
{
	return MarkdownString('#### examples\n\n    ' + examples.join('\n    '));
}

export class StatementHovers
{
	hmap: Map<string,Array<vsserv.MarkupContent>>;

	constructor()
	{
		this.hmap = new Map<string,Array<vsserv.MarkupContent>>();
			
		this.hmap.set("tok_abs",[
			MarkdownString('absolute value'),
			MarkdownString('`ABS (aexpr)`')
		]);
		this.hmap.set("tok_asc",[
			MarkdownString('ASCII code of first character'),
			MarkdownString('`ASC (sexpr)`')
		]);
		this.hmap.set("tok_amp",[
			MarkdownString('Execute JMP at $03F5.  The syntax is arbitrary, but in order to be useful, the language server has to impose some limits.'),
			MarkdownString('`& [{character}]`'),
			exampleString([
				'& "hello from ampersand"',
				'& (X/5,A$,"hello from ampersand")',
				'& print "overloaded print" at x,y'])
		]);
		this.hmap.set("tok_atn",[
			MarkdownString('arc tangent in radians'),
			MarkdownString('`ATN (aexpr)`')
		]);
		this.hmap.set("tok_call",[
			MarkdownString('Call machine language subroutine at decimal address.  The optional string argument is only for specialized object code like `CHAIN`.'),
			MarkdownString('`CALL aexpr [string]`'),
			exampleString([
				'CALL 768',
				'CALL 520"NEXT PROGRAM"'])
		]);
		this.hmap.set("tok_chr",[
			MarkdownString('character corresponding to ASCII code'),
			MarkdownString('`CHR$ (aexpr)`')
		]);
		this.hmap.set("tok_clear",[
			MarkdownString('Reset all variables and internal control information'),
			MarkdownString('`CLEAR`')
		]);
		this.hmap.set("tok_coloreq",[
			MarkdownString('Set the low resolution color'),
			MarkdownString('`COLOR = aexpr`')
		]);
		this.hmap.set("tok_cont",[
			MarkdownString('Resume program execution, immediate mode only'),
			MarkdownString('`CONT`')
		]);
		this.hmap.set("tok_cos",[
			MarkdownString('cosine, the argument is in radians'),
			MarkdownString('`COS (aexpr)`')
		]);
		this.hmap.set("tok_data",[
			MarkdownString('create list of items to be loaded into variables using `READ`'),
			MarkdownString('`DATA [literal|string|real|integer][{,[literal|string|real|integer]}]`'),
			exampleString([
				'DATA literal 1, "HELLO", "WORLD", 1.5, -3',
				'READ A$,B$,C$,X,L'])
		]);
		this.hmap.set("tok_def",[
			MarkdownString('define a function'),
			MarkdownString('`DEF FN name(name) = aexpr`'),
			exampleString([
				'DEF FN CUBE(X) = X^3',
				'Y = FN CUBE(3)'])
		]);
		this.hmap.set("tok_del",[
			MarkdownString('delete a range of program lines inclusively'),
			MarkdownString('`DEL linenum,linenum`')
		]);
		this.hmap.set("tok_dim",[
			MarkdownString('allocate space for arrays, specifying the last element (length-1)'),
			MarkdownString('`DIM name[%|$] subscript [{,name[%|$] subscript}]`')
		]);
		this.hmap.set("tok_draw",[
			MarkdownString('draw a high resolution shape'),
			MarkdownString('`DRAW aexpr [AT aexpr,aexpr]`')
		]);
		this.hmap.set("tok_end",[
			MarkdownString('stop program execution'),
			MarkdownString('`END`')
		]);
		this.hmap.set("tok_exp",[
			MarkdownString('exponential'),
			MarkdownString('`EXP (aexpr)`')
		]);
		this.hmap.set("tok_flash",[
			MarkdownString('switch to flashing text, results depend on hardware configuration and soft switch settings'),
			MarkdownString('`FLASH`')
		]);
		this.hmap.set("tok_fn",[
			MarkdownString('call a user function, also used in function definition'),
			MarkdownString('`FN name(aexpr)`'),
			exampleString([
				'DEF FN CUBE(X) = X^3',
				'Y = FN CUBE(3)'])
		]);
		this.hmap.set("tok_for",[
			MarkdownString('start a loop indexing on the given variable'),
			MarkdownString('`FOR name = aexpr TO aexpr [STEP aexpr]`')
		]);
		this.hmap.set("tok_fre",[
			MarkdownString('Return remaining memory in bytes.  Argument is ignored but must be a valid expression.  This also forces garbage collection of strings.'),
			MarkdownString('`FRE (expr)`')
		]);
		this.hmap.set("tok_get",[
			MarkdownString('Get a number or character from a keypress.  Displays blinking prompt, otherwise display is not affected.'),
			MarkdownString('`GET var`')
		]);
		this.hmap.set("tok_gosub",[
			MarkdownString('Execute the subroutine starting at the given line number.  Variables cannot be used.'),
			MarkdownString('`GOSUB linenum`')
		]);
		this.hmap.set("tok_goto",[
			MarkdownString('Branch to the given line number.  Variables cannot be used.'),
			MarkdownString('`GOTO linenum`')
		]);
		this.hmap.set("tok_gr",[
			MarkdownString('Switch to low resolution graphics and clear the screen.'),
			MarkdownString('`GR`')
		]);
		this.hmap.set("tok_hcoloreq",[
			MarkdownString('Set the color for high resolution graphics.'),
			MarkdownString('`HCOLOR = aexpr`')
		]);
		this.hmap.set("tok_hgr",[
			MarkdownString('Switch to high resolution graphics page 1 and clear the screen.'),
			MarkdownString('`HGR`')
		]);
		this.hmap.set("tok_hgr2",[
			MarkdownString('Switch to high resolution graphics page 2 and clear the screen.'),
			MarkdownString('`HGR2`')
		]);
		this.hmap.set("tok_himem",[
			MarkdownString('Set the highest address available to the Applesoft program.'),
			MarkdownString('`HIMEM: aexpr`')
		]);
		this.hmap.set("tok_hlin",[
			MarkdownString('Draw a horizontal line on the low resolution screen.'),
			MarkdownString('`HLIN aexpr,aexpr AT aexpr`')
		]);
		this.hmap.set("tok_home",[
			MarkdownString('Clear the text screen and move cursor to top left.'),
			MarkdownString('`HOME`')
		]);
		this.hmap.set("tok_hplot",[
			MarkdownString('Plot a point or line on the high resolution screen in the current color.'),
			MarkdownString('`HPLOT aexpr,aexpr [{TO aexpr,aexpr}]`'),
			MarkdownString('`HPLOT TO aexpr,aexpr [{TO aexpr,aexpr}]`')
		]);
		this.hmap.set("tok_htab",[
			MarkdownString('move cursor to the given column, numbered from 1'),
			MarkdownString('`HTAB aexpr`')
		]);
		this.hmap.set("tok_if",[
			MarkdownString('Execute all statements following `THEN` (on the same line) if the condition is true. There are some abbreviated forms for branching.'),
			MarkdownString('`IF expr THEN statement[{:statement}]`'),
			exampleString([
				'IF X<Y THEN X = 0: Y = 0',
				'IF A$ = "Y" THEN GOTO 100',
				'IF A$ = "Y" THEN 100',
				'IF A$ = "Y" GOTO 100'])
		]);
		this.hmap.set("tok_inn",[
			MarkdownString('Switch input to a numbered expansion slot.'),
			MarkdownString('`IN# aexpr`')
		]);
		this.hmap.set("tok_input",[
			MarkdownString('Read from the current input device, optionally with prompt'),
			MarkdownString('`INPUT [sexpr;]var[{,var}]`'),
			exampleString([
				'INPUT PRICE',
				'INPUT MNTH%, DAY%, YEAR%',
				'INPUT "WHAT IS YOUR PASSWORD? "; PASSWD$'])
		]);
		this.hmap.set("tok_int",[
			MarkdownString('integer part of argument.'),
			MarkdownString('`INT (aexpr)`')
		]);
		this.hmap.set("tok_inverse",[
			MarkdownString('Switch text to inverse video. Results depend on hardware and soft switch settings.'),
			MarkdownString('`INVERSE`')
		]);
		this.hmap.set("tok_left",[
			MarkdownString('substring starting from the beginning of a string'),
			MarkdownString('`LEFT$ (sexpr,aexpr)`')
		]);
		this.hmap.set("tok_len",[
			MarkdownString('length of a string'),
			MarkdownString('`LEN (sexpr)`')
		]);
		this.hmap.set("tok_let",[
			MarkdownString('`LET` is optional in assignments')
		]);
		this.hmap.set("tok_list",[
			MarkdownString('output program listing to current device'),
			MarkdownString('`LIST [linenum] [-linenum]`'),
			MarkdownString('`LIST [linenum] [,linenum]`')
		]);
		this.hmap.set("tok_load",[
			MarkdownString('load a program from tape or disk'),
			MarkdownString('`LOAD [name]`')
		]);
		this.hmap.set("tok_log",[
			MarkdownString('natural logarithm'),
			MarkdownString('`LOG (aexpr)`')
		]);
		this.hmap.set("tok_lomem",[
			MarkdownString('lower boundary in memory for variables'),
			MarkdownString('`LOMEM: aexpr`')
		]);
		this.hmap.set("tok_mid",[
			MarkdownString('return substring, `aexpr` arguments are start (indexed from 1) and length'),
			MarkdownString('`MID$ (sexpr,aexpr[,aexpr])`')
		]);
		this.hmap.set("tok_new",[
			MarkdownString('clear program and reset all variables and internal states'),
			MarkdownString('`NEW`')
		]);
		this.hmap.set("tok_next",[
			MarkdownString('Mark the end of a loop. Specifying loop variable is optional.'),
			MarkdownString('`NEXT [avar[{,avar}]]`')
		]);
		this.hmap.set("tok_normal",[
			MarkdownString('display text normally, cancels `INVERSE` and `FLASH`'),
			MarkdownString('`NORMAL`')
		]);
		this.hmap.set("tok_notrace",[
			MarkdownString('cancel display of line numbers during execution'),
			MarkdownString('`NOTRACE`')
		]);
		this.hmap.set("tok_on",[
			MarkdownString('Branch on a variable with non-zero integer values.  Also works with subroutines.'),
			MarkdownString('`ON aexpr GOTO linenum[{,linenum}]`'),
			MarkdownString('`ON aexpr GOSUB linenum[{,linenum}]`')
		]);
		this.hmap.set("tok_onerr",[
			MarkdownString('Set error handling routine. There are some issues, see references.'),
			MarkdownString('`ONERR GOTO linenum`')
		]);
		this.hmap.set("tok_pdl",[
			MarkdownString('Read the dial on the given game paddle.'),
			MarkdownString('`PDL (aexpr)`')
		]);
		this.hmap.set("tok_peek",[
			MarkdownString('byte value at the given decimal address'),
			MarkdownString('`PEEK (aexpr)`')
		]);
		this.hmap.set("tok_plot",[
			MarkdownString('display low resolution pixel'),
			MarkdownString('`PLOT aexpr,aexpr`')
		]);
		this.hmap.set("tok_poke",[
			MarkdownString('set byte value at the given decimal address'),
			MarkdownString('`POKE aexpr,aexpr`')
		]);
		this.hmap.set("tok_pop",[
			MarkdownString('remove the most recent return address from the stack'),
			MarkdownString('`POP`')
		]);
		this.hmap.set("tok_pos",[
			MarkdownString('horizontal position of text cursor, argument is ignored, but must be a valid expression'),
			MarkdownString('`POS(expr)`')
		]);
		this.hmap.set("tok_prn",[
			MarkdownString('switch output to the given numbered expansion slot'),
			MarkdownString('`PR# aexpr`')
		]);
		this.hmap.set("tok_print",[
			MarkdownString('Write to the current output device.'),
			MarkdownString('`PRINT [{expr[,|;]}]`'),
			exampleString([
				'PRINT',
				'PRINT A$, "X = ";X'])
		]);
		this.hmap.set("tok_read",[
			MarkdownString('read `DATA` values into variables'),
			MarkdownString('`READ var[{,var}]`')
		]);
		this.hmap.set("tok_recall",[
			MarkdownString('read values from tape into an array'),
			MarkdownString('`RECALL name[%]`')
		]);
		this.hmap.set("tok_rem",[
			MarkdownString('start of a comment (remark)'),
			MarkdownString('`REM {character}`')
		]);
		this.hmap.set("tok_restore",[
			MarkdownString('reset `DATA` to the beginning'),
			MarkdownString('`RESTORE`')
		]);
		this.hmap.set("tok_resume",[
			MarkdownString('Used at end of error handler to resume with the statement where the error occurred.  There are some issues, see the references.'),
			MarkdownString('`RESUME`')
		]);
		this.hmap.set("tok_return",[
			MarkdownString('return from subroutine'),
			MarkdownString('`RETURN`')
		]);
		this.hmap.set("tok_right",[
			MarkdownString('substring counting from the right'),
			MarkdownString('`RIGHT$ (sexpr,aexpr)`')
		]);
		this.hmap.set("tok_rnd",[
			MarkdownString('This is a uniform deviate between 0 and 1. Positive arguments change the seed'),
			MarkdownString('`RND (aexpr)`')
		]);
		this.hmap.set("tok_roteq",[
			MarkdownString('Set rotation for `DRAW` or `XDRAW`. See references for angular units.'),
			MarkdownString('`ROT = aexpr`')
		]);
		this.hmap.set("tok_run",[
			MarkdownString('`RUN` can be used in a program, but all variables are reset.'),
			MarkdownString('`RUN [linenum|name]`')
		]);
		this.hmap.set("tok_save",[
			MarkdownString('save program to disk or tape'),
			MarkdownString('`SAVE [name]`')
		]);
		this.hmap.set("tok_scaleeq",[
			MarkdownString('set scale for `DRAW` or `XDRAW`'),
			MarkdownString('`SCALE = aexpr`')
		]);
		this.hmap.set("tok_scrnp",[
			MarkdownString('color code at position on low resolution graphics screen'),
			MarkdownString('`SCRN (aexpr,aexpr)`')
		]);
		this.hmap.set("tok_sgn",[
			MarkdownString('sign function, gives -1,0, or 1'),
			MarkdownString('`SGN (aexpr)`')
		]);
		this.hmap.set("tok_shload",[
			MarkdownString('load shape from tape'),
			MarkdownString('`SHLOAD`')
		]);
		this.hmap.set("tok_sin",[
			MarkdownString('sine, the argument is in radians'),
			MarkdownString('`SIN (aexpr)`')
		]);
		this.hmap.set("tok_spcp",[
			MarkdownString('print number of spaces given in argument'),
			MarkdownString('`SPC (aexpr)`')
		]);
		this.hmap.set("tok_speedeq",[
			MarkdownString('set rate of printing to output device'),
			MarkdownString('`SPEED = aexpr`')
		]);
		this.hmap.set("tok_sqr",[
			MarkdownString('positive square root'),
			MarkdownString('`SQR (aexpr)`')
		]);
		this.hmap.set("tok_stop",[
			MarkdownString('terminate execution with a message giving the line number'),
			MarkdownString('`STOP`')
		]);
		this.hmap.set("tok_store",[
			MarkdownString('save array values to tape'),
			MarkdownString('`STORE name[%]`')
		]);
		this.hmap.set("tok_str",[
			MarkdownString('convert number to string'),
			MarkdownString('`STR$ (aexpr)`')
		]);
		this.hmap.set("tok_tabp",[
			MarkdownString('move text cursor to given column, numbered from 1'),
			MarkdownString('`TAB (aexpr)`')
		]);
		this.hmap.set("tok_tan",[
			MarkdownString('tangent, argument is in radians'),
			MarkdownString('`TAN (aexpr)`')
		]);
		this.hmap.set("tok_text",[
			MarkdownString('switch display to text'),
			MarkdownString('`TEXT`')
		]);
		this.hmap.set("tok_then",[
			MarkdownString('see `IF`'),
		]);
		this.hmap.set("tok_trace",[
			MarkdownString('display each line number during execution'),
			MarkdownString('`TRACE`')
		]);
		this.hmap.set("tok_usr",[
			MarkdownString('call machine language routine supplied by the user, passing the given argument'),
			MarkdownString('`USR (aexpr)`')
		]);
		this.hmap.set("tok_val",[
			MarkdownString('convert string to number'),
			MarkdownString('`VAL (sexpr)`')
		]);
		this.hmap.set("tok_vlin",[
			MarkdownString('draw a vertical line on the low resolution screen'),
			MarkdownString('`VLIN aexpr,aexpr AT aexpr`')
		]);
		this.hmap.set("tok_vtab",[
			MarkdownString('move text cursor to the given row, numbered from 1'),
			MarkdownString('`VTAB aexpr`')
		]);
		this.hmap.set("tok_wait",[
			MarkdownString('Suspend execution until bit pattern appears at given address. First argument is address, second is mask giving bits to test, third is a mask giving the expected bit values.'),
			MarkdownString('`WAIT aexpr,aexpr[,aexpr]`')
		]);
		this.hmap.set("tok_xdraw",[
			MarkdownString('Draw a shape using colors complementary to those currently on the screen. This can be used to erase a previously drawn shape.'),
			MarkdownString('`XDRAW aexpr [AT aexpr,aexpr]`')
		]);
	}
	get(tok : string) : Array<vsserv.MarkupContent> | undefined
	{
		return this.hmap.get(tok);
	}
}