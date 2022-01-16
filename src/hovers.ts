import * as vscode from 'vscode';
import * as Parser from 'web-tree-sitter';

function exampleString(examples: string[]) : vscode.MarkdownString
{
	const result = new vscode.MarkdownString();
	examples.forEach(s => result.appendCodeblock(s,'applesoft'));
	return result;
}

export class TSHoverProvider implements vscode.HoverProvider
{
	parser : Parser;
	hmap: Map<string,Array<vscode.MarkdownString>>;

	constructor(parser: Parser)
	{
		this.parser = parser;
		this.hmap = new Map<string,Array<vscode.MarkdownString>>();
		this.hmap.set("abs_tok",[
			new vscode.MarkdownString('absolute value'),
			new vscode.MarkdownString('`ABS (aexpr)`')
		]);
		this.hmap.set("asc_tok",[
			new vscode.MarkdownString('ASCII code of first character'),
			new vscode.MarkdownString('`ASC (sexpr)`')
		]);
		this.hmap.set("amp_tok",[
			new vscode.MarkdownString('Execute JMP at $03F5.  Syntax depends on the particular object code that is called.'),
			new vscode.MarkdownString('`& [{character}]`'),
			exampleString([
				'& "hello from ampersand"',
				'& (X/5,A$,"hello from ampersand")'])
		]);
		this.hmap.set("atn_tok",[
			new vscode.MarkdownString('arc tangent in radians'),
			new vscode.MarkdownString('`ATN (aexpr)`')
		]);
		this.hmap.set("call_tok",[
			new vscode.MarkdownString('Call machine language subroutine at decimal address.  The optional string argument is only for specialized object code like `CHAIN`.'),
			new vscode.MarkdownString('`CALL aexpr [string]`'),
			exampleString([
				'CALL 768',
				'CALL 520"NEXT PROGRAM"'])
		]);
		this.hmap.set("chr_tok",[
			new vscode.MarkdownString('character corresponding to ASCII code'),
			new vscode.MarkdownString('`CHR$ (aexpr)`')
		]);
		this.hmap.set("clear_tok",[
			new vscode.MarkdownString('Reset all variables and internal control information'),
			new vscode.MarkdownString('`CLEAR`')
		]);
		this.hmap.set("coloreq_tok",[
			new vscode.MarkdownString('Set the low resolution color'),
			new vscode.MarkdownString('`COLOR = aexpr`')
		]);
		this.hmap.set("cont_tok",[
			new vscode.MarkdownString('Resume program execution, immediate mode only'),
			new vscode.MarkdownString('`CONT`')
		]);
		this.hmap.set("cos_tok",[
			new vscode.MarkdownString('cosine, the argument is in radians'),
			new vscode.MarkdownString('`COS (aexpr)`')
		]);
		this.hmap.set("data_tok",[
			new vscode.MarkdownString('create list of items to be loaded into variables using `READ`'),
			new vscode.MarkdownString('`DATA [literal|string|real|integer][{,[literal|string|real|integer]}]`'),
			exampleString([
				'DATA literal 1, "HELLO", "WORLD", 1.5, -3',
				'READ A$,B$,C$,X,L'])
		]);
		this.hmap.set("def_tok",[
			new vscode.MarkdownString('define a function'),
			new vscode.MarkdownString('`DEF FN name(name) = aexpr`'),
			exampleString([
				'DEF FN CUBE(X) = X^3',
				'Y = FN CUBE(3)'])
		]);
		this.hmap.set("del_tok",[
			new vscode.MarkdownString('delete a range of program lines inclusively'),
			new vscode.MarkdownString('`DEL linenum,linenum`')
		]);
		this.hmap.set("dim_tok",[
			new vscode.MarkdownString('allocate space for arrays'),
			new vscode.MarkdownString('`DIM name[%|$] subscript [{,name[%|$] subscript}]`')
		]);
		this.hmap.set("draw_tok",[
			new vscode.MarkdownString('draw a high resolution shape'),
			new vscode.MarkdownString('`DRAW aexpr [AT aexpr,aexpr]`')
		]);
		this.hmap.set("end_tok",[
			new vscode.MarkdownString('stop program execution'),
			new vscode.MarkdownString('`END`')
		]);
		this.hmap.set("exp_tok",[
			new vscode.MarkdownString('exponential'),
			new vscode.MarkdownString('`EXP (aexpr)`')
		]);
		this.hmap.set("flash_tok",[
			new vscode.MarkdownString('switch to flashing text, results depend on hardware configuration and soft switch settings'),
			new vscode.MarkdownString('`FLASH`')
		]);
		this.hmap.set("fn_tok",[
			new vscode.MarkdownString('call a user function, also used in function definition'),
			new vscode.MarkdownString('`FN name(aexpr)`'),
			exampleString([
				'DEF FN CUBE(X) = X^3',
				'Y = FN CUBE(3)'])
		]);
		this.hmap.set("for_tok",[
			new vscode.MarkdownString('start a loop indexing on the given variable'),
			new vscode.MarkdownString('`FOR name = aexpr TO aexpr [STEP aexpr]`')
		]);
		this.hmap.set("fre_tok",[
			new vscode.MarkdownString('Return remaining memory in bytes.  Argument is ignored but must be a valid expression.  This also forces garbage collection of strings.'),
			new vscode.MarkdownString('`FRE (expr)`')
		]);
		this.hmap.set("get_tok",[
			new vscode.MarkdownString('Get a number or character from a keypress.  Displays blinking prompt, otherwise display is not affected.'),
			new vscode.MarkdownString('`GET var`')
		]);
		this.hmap.set("gosub_tok",[
			new vscode.MarkdownString('Execute the subroutine starting at the given line number.  Variables cannot be used.'),
			new vscode.MarkdownString('`GOSUB linenum`')
		]);
		this.hmap.set("goto_tok",[
			new vscode.MarkdownString('Branch to the given line number.  Variables cannot be used.'),
			new vscode.MarkdownString('`GOTO linenum`')
		]);
		this.hmap.set("gr_tok",[
			new vscode.MarkdownString('Switch to low resolution graphics and clear the screen.'),
			new vscode.MarkdownString('`GR`')
		]);
		this.hmap.set("hcoloreq_tok",[
			new vscode.MarkdownString('Set the color for high resolution graphics.'),
			new vscode.MarkdownString('`HCOLOR = aexpr`')
		]);
		this.hmap.set("hgr_tok",[
			new vscode.MarkdownString('Switch to high resolution graphics page 1 and clear the screen.'),
			new vscode.MarkdownString('`HGR`')
		]);
		this.hmap.set("hgr2_tok",[
			new vscode.MarkdownString('Switch to high resolution graphics page 2 and clear the screen.'),
			new vscode.MarkdownString('`HGR2`')
		]);
		this.hmap.set("himem_tok",[
			new vscode.MarkdownString('Set the highest address available to the Applesoft program.'),
			new vscode.MarkdownString('`HIMEM: aexpr`')
		]);
		this.hmap.set("hlin_tok",[
			new vscode.MarkdownString('Draw a horizontal line on the low resolution screen.'),
			new vscode.MarkdownString('`HLIN aexpr,aexpr AT aexpr`')
		]);
		this.hmap.set("home_tok",[
			new vscode.MarkdownString('Clear the text screen and move cursor to top left.'),
			new vscode.MarkdownString('`HOME`')
		]);
		this.hmap.set("hplot_tok",[
			new vscode.MarkdownString('Plot a point or line on the high resolution screen in the current color.'),
			new vscode.MarkdownString('`HPLOT aexpr,aexpr [{TO aexpr,aexpr}]`'),
			new vscode.MarkdownString('`HPLOT TO aexpr,aexpr [{TO aexpr,aexpr}]`')
		]);
		this.hmap.set("htab_tok",[
			new vscode.MarkdownString('move cursor to the given column, numbered from 1'),
			new vscode.MarkdownString('`HTAB aexpr`')
		]);
		this.hmap.set("if_tok",[
			new vscode.MarkdownString('Execute all statements following `THEN` (on the same line) if the condition is true. There are some abbreviated forms for branching.'),
			new vscode.MarkdownString('`IF expr THEN statement[{:statement}]`'),
			exampleString([
				'IF X<Y THEN X = 0: Y = 0',
				'IF A$ = "Y" THEN GOTO 100',
				'IF A$ = "Y" THEN 100',
				'IF A$ = "Y" GOTO 100'])
		]);
		this.hmap.set("inn_tok",[
			new vscode.MarkdownString('Switch input to a numbered expansion slot.'),
			new vscode.MarkdownString('`IN# aexpr`')
		]);
		this.hmap.set("input_tok",[
			new vscode.MarkdownString('Read from the current input device, optionally with prompt'),
			new vscode.MarkdownString('`INPUT [sexpr;]var[{,var}]`'),
			exampleString([
				'INPUT PRICE',
				'INPUT MNTH%, DAY%, YEAR%',
				'INPUT "WHAT IS YOUR PASSWORD? "; PASSWD$'])
		]);
		this.hmap.set("int_tok",[
			new vscode.MarkdownString('integer part of argument.'),
			new vscode.MarkdownString('`INT (aexpr)`')
		]);
		this.hmap.set("inverse_tok",[
			new vscode.MarkdownString('Switch text to inverse video. Results depend on hardware and soft switch settings.'),
			new vscode.MarkdownString('`INVERSE`')
		]);
		this.hmap.set("left_tok",[
			new vscode.MarkdownString('substring starting from the beginning of a string'),
			new vscode.MarkdownString('`LEFT$ (sexpr,aexpr)`')
		]);
		this.hmap.set("len_tok",[
			new vscode.MarkdownString('length of a string'),
			new vscode.MarkdownString('`LEN (sexpr)`')
		]);
		this.hmap.set("let_tok",[
			new vscode.MarkdownString('`LET` is optional in assignments')
		]);
		this.hmap.set("list_tok",[
			new vscode.MarkdownString('output program listing to current device'),
			new vscode.MarkdownString('`LIST [linenum] [-linenum]`'),
			new vscode.MarkdownString('`LIST [linenum] [,linenum]`')
		]);
		this.hmap.set("load_tok",[
			new vscode.MarkdownString('load a program from tape or disk'),
			new vscode.MarkdownString('`LOAD [name]`')
		]);
		this.hmap.set("log_tok",[
			new vscode.MarkdownString('natural logarithm'),
			new vscode.MarkdownString('`LOG (aexpr)`')
		]);
		this.hmap.set("lomem_tok",[
			new vscode.MarkdownString('lower boundary in memory for variables'),
			new vscode.MarkdownString('`LOMEM: aexpr`')
		]);
		this.hmap.set("mid_tok",[
			new vscode.MarkdownString('return substring, `aexpr` arguments are start and length'),
			new vscode.MarkdownString('`MID$ (sexpr,aexpr[,aexpr])`')
		]);
		this.hmap.set("new_tok",[
			new vscode.MarkdownString('clear program and reset all variables and internal states'),
			new vscode.MarkdownString('`NEW`')
		]);
		this.hmap.set("next_tok",[
			new vscode.MarkdownString('Mark the end of a loop. Specifying loop variable is optional.'),
			new vscode.MarkdownString('`NEXT [avar[{,avar}]]`')
		]);
		this.hmap.set("normal_tok",[
			new vscode.MarkdownString('display text normally, cancels `INVERSE` and `FLASH`'),
			new vscode.MarkdownString('`NORMAL`')
		]);
		this.hmap.set("notrace_tok",[
			new vscode.MarkdownString('cancel display of line numbers during execution'),
			new vscode.MarkdownString('`NOTRACE`')
		]);
		this.hmap.set("on_tok",[
			new vscode.MarkdownString('Branch on a variable with non-zero integer values.  Also works with subroutines.'),
			new vscode.MarkdownString('`ON aexpr GOTO linenum[{,linenum}]`'),
			new vscode.MarkdownString('`ON aexpr GOSUB linenum[{,linenum}]`')
		]);
		this.hmap.set("onerr_tok",[
			new vscode.MarkdownString('Set error handling routine. There are some issues, see references.'),
			new vscode.MarkdownString('`ONERR GOTO linenum`')
		]);
		this.hmap.set("pdl_tok",[
			new vscode.MarkdownString('Read the dial on the given game paddle.'),
			new vscode.MarkdownString('`PDL (aexpr)`')
		]);
		this.hmap.set("peek_tok",[
			new vscode.MarkdownString('byte value at the given decimal address'),
			new vscode.MarkdownString('`PEEK (aexpr)`')
		]);
		this.hmap.set("plot_tok",[
			new vscode.MarkdownString('display low resolution pixel'),
			new vscode.MarkdownString('`PLOT aexpr,aexpr`')
		]);
		this.hmap.set("poke_tok",[
			new vscode.MarkdownString('set byte value at the given decimal address'),
			new vscode.MarkdownString('`POKE aexpr,aexpr`')
		]);
		this.hmap.set("pop_tok",[
			new vscode.MarkdownString('remove the most recent return address from the stack'),
			new vscode.MarkdownString('`POP`')
		]);
		this.hmap.set("pos_tok",[
			new vscode.MarkdownString('horizontal position of text cursor, argument is ignored, but must be a valid expression'),
			new vscode.MarkdownString('`POS(expr)`')
		]);
		this.hmap.set("prn_tok",[
			new vscode.MarkdownString('switch output to the given numbered expansion slot'),
			new vscode.MarkdownString('`PR# aexpr`')
		]);
		this.hmap.set("print_tok",[
			new vscode.MarkdownString('Write to the current output device.'),
			new vscode.MarkdownString('`PRINT [{expr[,|;]}]`'),
			exampleString([
				'PRINT',
				'PRINT A$, "X = ";X'])
		]);
		this.hmap.set("read_tok",[
			new vscode.MarkdownString('read `DATA` values into variables'),
			new vscode.MarkdownString('`READ var[{,var}]`')
		]);
		this.hmap.set("recall_tok",[
			new vscode.MarkdownString('read values from tape into an array'),
			new vscode.MarkdownString('`RECALL name[%]`')
		]);
		this.hmap.set("rem_tok",[
			new vscode.MarkdownString('start of a comment (remark)'),
			new vscode.MarkdownString('`REM {character}`')
		]);
		this.hmap.set("restore_tok",[
			new vscode.MarkdownString('reset `DATA` to the beginning'),
			new vscode.MarkdownString('`RESTORE`')
		]);
		this.hmap.set("resume_tok",[
			new vscode.MarkdownString('Used at end of error handler to resume with the statement where the error occurred.  There are some issues, see the references.'),
			new vscode.MarkdownString('`RESUME`')
		]);
		this.hmap.set("return_tok",[
			new vscode.MarkdownString('return from subroutine'),
			new vscode.MarkdownString('`RETURN`')
		]);
		this.hmap.set("right_tok",[
			new vscode.MarkdownString('substring counting from the right'),
			new vscode.MarkdownString('`RIGHT$ (sexpr,aexpr)`')
		]);
		this.hmap.set("rnd_tok",[
			new vscode.MarkdownString('This is a uniform deviate between 0 and 1. Positive arguments change the seed'),
			new vscode.MarkdownString('`RND (aexpr)`')
		]);
		this.hmap.set("roteq_tok",[
			new vscode.MarkdownString('Set rotation for `DRAW` or `XDRAW`. See references for angular units.'),
			new vscode.MarkdownString('`ROT = aexpr`')
		]);
		this.hmap.set("run_tok",[
			new vscode.MarkdownString('`RUN` can be used in a program, but all variables are reset.'),
			new vscode.MarkdownString('`RUN [linenum|name]`')
		]);
		this.hmap.set("save_tok",[
			new vscode.MarkdownString('save program to disk or tape'),
			new vscode.MarkdownString('`SAVE [name]`')
		]);
		this.hmap.set("scaleeq_tok",[
			new vscode.MarkdownString('set scale for `DRAW` or `XDRAW`'),
			new vscode.MarkdownString('`SCALE = aexpr`')
		]);
		this.hmap.set("scrnp_tok",[
			new vscode.MarkdownString('color code at position on low resolution graphics screen'),
			new vscode.MarkdownString('`SCRN (aexpr,aexpr)`')
		]);
		this.hmap.set("sgn_tok",[
			new vscode.MarkdownString('sign function, gives -1,0, or 1'),
			new vscode.MarkdownString('`SGN (aexpr)`')
		]);
		this.hmap.set("shload_tok",[
			new vscode.MarkdownString('load shape from tape'),
			new vscode.MarkdownString('`SHLOAD`')
		]);
		this.hmap.set("sin_tok",[
			new vscode.MarkdownString('sine, the argument is in radians'),
			new vscode.MarkdownString('`SIN (aexpr)`')
		]);
		this.hmap.set("spcp_tok",[
			new vscode.MarkdownString('print number of spaces given in argument'),
			new vscode.MarkdownString('`SPC (aexpr)`')
		]);
		this.hmap.set("speedeq_tok",[
			new vscode.MarkdownString('set rate of printing to output device'),
			new vscode.MarkdownString('`SPEED = aexpr`')
		]);
		this.hmap.set("sqr_tok",[
			new vscode.MarkdownString('positive square root'),
			new vscode.MarkdownString('`SQR (aexpr)`')
		]);
		this.hmap.set("stop_tok",[
			new vscode.MarkdownString('terminate execution with a message giving the line number'),
			new vscode.MarkdownString('`STOP`')
		]);
		this.hmap.set("store_tok",[
			new vscode.MarkdownString('save array values to tape'),
			new vscode.MarkdownString('`STORE name[%]`')
		]);
		this.hmap.set("str_tok",[
			new vscode.MarkdownString('convert number to string'),
			new vscode.MarkdownString('`STR$ (aexpr)`')
		]);
		this.hmap.set("tabp_tok",[
			new vscode.MarkdownString('move text cursor to given column, numbered from 1'),
			new vscode.MarkdownString('`TAB (aexpr)`')
		]);
		this.hmap.set("tan_tok",[
			new vscode.MarkdownString('tangent, argument is in radians'),
			new vscode.MarkdownString('`TAN (aexpr)`')
		]);
		this.hmap.set("text_tok",[
			new vscode.MarkdownString('switch display to text'),
			new vscode.MarkdownString('`TEXT`')
		]);
		this.hmap.set("then_tok",[
			new vscode.MarkdownString('see `IF`'),
		]);
		this.hmap.set("trace_tok",[
			new vscode.MarkdownString('display each line number during execution'),
			new vscode.MarkdownString('`TRACE`')
		]);
		this.hmap.set("usr_tok",[
			new vscode.MarkdownString('call machine language routine supplied by the user, passing the given argument'),
			new vscode.MarkdownString('`USR (aexpr)`')
		]);
		this.hmap.set("val_tok",[
			new vscode.MarkdownString('convert string to number'),
			new vscode.MarkdownString('`VAL (sexpr)`')
		]);
		this.hmap.set("vlin_tok",[
			new vscode.MarkdownString('draw a vertical line on the low resolution screen'),
			new vscode.MarkdownString('`VLIN aexpr,aexpr AT aexpr`')
		]);
		this.hmap.set("vtab_tok",[
			new vscode.MarkdownString('move text cursor to the given row, numbered from 1'),
			new vscode.MarkdownString('`VTAB aexpr`')
		]);
		this.hmap.set("wait_tok",[
			new vscode.MarkdownString('Suspend execution until bit pattern appears at given address. First argument is address, second is mask giving bits to test, third is a mask giving the expected bit values.'),
			new vscode.MarkdownString('`WAIT aexpr,aexpr[,aexpr]`')
		]);
		this.hmap.set("xdraw_tok",[
			new vscode.MarkdownString('Draw a shape using colors complementary to those currently on the screen. This can be used to erase a previously drawn shape.'),
			new vscode.MarkdownString('`XDRAW aexpr [AT aexpr,aexpr]`')
		]);	}
	curs_to_range(curs: Parser.TreeCursor): vscode.Range
	{
		const start_pos = new vscode.Position(curs.startPosition.row,curs.startPosition.column);
		const end_pos = new vscode.Position(curs.endPosition.row,curs.endPosition.column);
		return new vscode.Range(start_pos,end_pos);
	}	
	get_hover(hover:Array<vscode.MarkdownString>,curs:Parser.TreeCursor,position:vscode.Position) : boolean
	{
		const rng = this.curs_to_range(curs);
		if (rng.contains(position))
		{
			const temp = this.hmap.get(curs.nodeType);
			if (temp)
			{
				temp.forEach(s => hover.push(s));
				return false;
			}
			return true;
		}
		return false;
	}
	provideHover(document:vscode.TextDocument,position: vscode.Position,token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover>
	{
		const hover = new Array<vscode.MarkdownString>();
		const tree = this.parser.parse(document.getText()+"\n");
		const cursor = tree.walk();
		let recurse = true;
		let finished = false;
		do
		{
			if (recurse && cursor.gotoFirstChild())
				recurse = this.get_hover(hover,cursor,position);
			else
			{
				if (cursor.gotoNextSibling())
					recurse = this.get_hover(hover,cursor,position);
				else if (cursor.gotoParent())
					recurse = false;
				else
					finished = true;
			}
			if (hover.length>0)
				finished = true;
		} while (!finished);
		if (hover.length>0)
			return new vscode.Hover(hover,this.curs_to_range(cursor));
		else
			return undefined;
	}
}