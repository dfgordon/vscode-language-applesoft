import * as vsserv from 'vscode-languageserver/node';
import * as vsdoc from 'vscode-languageserver-textdocument';
import * as lxbase from './langExtBase';
import * as specialAddresses from './specialAddresses.json';
import { applesoftSettings } from './settings';
import Parser from 'web-tree-sitter';

export class LineCompletionProvider extends lxbase.LangExtBase
{
	get_linenum(line: string) : number
	{
		const nums = line.match(/^[0-9 ]+/);
		if (nums)
			if (nums.length>0)
			{
				const num = parseInt(nums[0].replace(/ /g,''));
				if (!isNaN(num))
					return num;
			}
		return -1;
	}
	provideCompletionItems(document: vsdoc.TextDocument | undefined, position: vsdoc.Position) : vsserv.CompletionItem[]
	{
		if (!document)
			return [];
		const lines = this.lines(document);
		lines.push('\n');
		if (lines[position.line].trim().length==0 && position.line>1)
		{
			let step = 10;
			const prevNum = this.get_linenum(lines[position.line-1]);
			if (prevNum==-1)
				return [];
			const prevPrevNum = this.get_linenum(lines[position.line-2]);
			if (prevPrevNum!=-1)
				step = prevNum - prevPrevNum;
			const it = vsserv.CompletionItem.create((prevNum + step).toString() + ' ');
			it.kind = vsserv.CompletionItemKind.Constant;
			return [it];
		}
		return [];
	}
}

export class AddressCompletionProvider extends lxbase.LangExtBase
{
	pokeCompletions : Array<vsserv.CompletionItem>;
	peekCompletions : Array<vsserv.CompletionItem>;
	callCompletions : Array<vsserv.CompletionItem>;
	constructor(TSInitResult: [Parser,Parser.Language],config: applesoftSettings)
	{
		super(TSInitResult, config);
		this.pokeCompletions = new Array<vsserv.CompletionItem>();
		this.peekCompletions = new Array<vsserv.CompletionItem>();
		this.callCompletions = new Array<vsserv.CompletionItem>();
		this.rebuild();
	}
	configure(settings: applesoftSettings) {
		this.config = settings;
		this.rebuild();
	}
	rebuild()
	{
		this.pokeCompletions = new Array<vsserv.CompletionItem>();
		this.peekCompletions = new Array<vsserv.CompletionItem>();
		this.callCompletions = new Array<vsserv.CompletionItem>();
		for (const addr in specialAddresses)
		{
			const typ = Object(specialAddresses)[addr].type;
			const ctx = Object(specialAddresses)[addr].ctx;
			if (ctx && ctx=='Integer BASIC')
				continue;
			if (typ && typ.search('soft switch')==-1 && typ.search('routine')==-1)
			{
				this.pokeCompletions.push(this.get_completion_item(addr,'',','));
				this.peekCompletions.push(this.get_completion_item(addr,'(',')'));
			}
			if (typ=='soft switch')
			{
				this.pokeCompletions.push(this.get_completion_item(addr,'',',0'));
				this.peekCompletions.push(this.get_completion_item(addr,'(',')'));
			}
			if (typ && typ.search('routine')>=0)
				this.callCompletions.push(this.get_completion_item(addr,'',''));
		}
	}
	get_completion_item(addr: string, prefix: string, postfix: string): vsserv.CompletionItem {
		const addr_entry = Object(specialAddresses)[addr];
		let num_addr = parseInt(addr);
		num_addr = num_addr < 0 && !this.config.completions.negativeAddresses ? num_addr + 2 ** 16 : num_addr;
		num_addr = num_addr >= 2 ** 15 && this.config.completions.negativeAddresses ? num_addr - 2 ** 16 : num_addr;
		const it = vsserv.CompletionItem.create(prefix + num_addr + postfix);
		it.kind = vsserv.CompletionItemKind.Constant;
		it.documentation = addr_entry.desc;
		if (addr_entry.brief)
			it.detail = addr_entry.brief;
		else {
			const temp = addr_entry.desc as string;
			const temp2 = temp.lastIndexOf('.') == temp.length - 1 ? temp.substring(0, temp.length - 1) : temp;
			it.detail = temp2;
		}
		if (addr_entry.label) {
			it.insertText = it.label;
			it.insertTextFormat = vsserv.InsertTextFormat.PlainText;
			it.label += ' '.repeat(8-it.label.length) + addr_entry.label;
		}
		return it;
	}
	provideCompletionItems(document: vsdoc.TextDocument | undefined, position: vsdoc.Position) : vsserv.CompletionItem[]
	{
		if (!document)
			return [];
		
		let ans = new Array<vsserv.CompletionItem>();

		if (position.character>4)
		{
			const l = position.line;
			const c = position.character;
			let statement = document.getText(vsserv.Range.create(vsserv.Position.create(l,0),vsserv.Position.create(l,c)));
			if (!this.config.case.caseSensitive)
				statement = statement.toUpperCase();
			if (statement.search(/POKE\s*$/)>-1)
				ans = ans.concat(this.pokeCompletions);
			if (statement.search(/PEEK\s*$/)>-1)
				ans = ans.concat(this.peekCompletions);
			if (statement.search(/CALL\s*$/)>-1)
				ans = ans.concat(this.callCompletions);
		}
		return ans;
	}
}

export class StatementCompletionProvider extends lxbase.LangExtBase
{
	modify(s:string)
	{
		if (this.config.case.lowerCaseCompletions && !this.config.case.caseSensitive)
			return s.toLowerCase();
		else
			return s;
	}
	add_simple(ans: Array<vsserv.CompletionItem>,a2tok: string[])
	{
		a2tok.forEach(s =>
		{
			s = this.modify(s);
			ans.push(vsserv.CompletionItem.create(this.modify(s)));
			ans[ans.length - 1].kind = vsserv.CompletionItemKind.Keyword;
		});
	}
	add_funcs(ans: Array<vsserv.CompletionItem>,a2tok: string[],expr_typ: string)
	{
		a2tok.forEach(s =>
		{
			s = this.modify(s);
			ans.push(vsserv.CompletionItem.create(s+' ('+expr_typ+')'));
			ans[ans.length - 1].kind = vsserv.CompletionItemKind.Function;
			ans[ans.length - 1].insertText = s + '(${0})';
			ans[ans.length - 1].insertTextFormat = vsserv.InsertTextFormat.Snippet;
		});
	}
	add_procs(ans: Array<vsserv.CompletionItem>,a2tok: string[],expr_typ: string)
	{
		a2tok.forEach(s =>
		{
			s = this.modify(s);
			ans.push(vsserv.CompletionItem.create(s + ' ' + expr_typ));
			ans[ans.length - 1].kind = vsserv.CompletionItemKind.Keyword;
			ans[ans.length - 1].insertText = s + ' ${0}';
			ans[ans.length - 1].insertTextFormat = vsserv.InsertTextFormat.Snippet;
		});
	}
	add_snippet(ans: Array<vsserv.CompletionItem>, lab: string, snip: string)
	{
		ans.push(vsserv.CompletionItem.create(this.modify(lab)));
		ans[ans.length - 1].insertText = this.modify(snip);
		ans[ans.length - 1].insertTextFormat = vsserv.InsertTextFormat.Snippet;
	}
	provideCompletionItems(document: vsdoc.TextDocument | undefined, position: vsdoc.Position) : vsserv.CompletionItem[]
	{
		const ans = new Array<vsserv.CompletionItem>();

		if (!document)
			return ans;

		this.add_simple(ans, ['CLEAR', 'CONT', 'DATA', 'END', 'FLASH', 'GR', 'HGR', 'HGR2', 'HOME', 'INPUT', 'INVERSE', 'LOAD',
			'NEW','NEXT','NORMAL','NOTRACE','POP','PRINT','READ','RECALL','REM','RESTORE','RESUME','RETURN','RUN',
			'SAVE','SHLOAD','STOP','STORE','TEXT','TRACE']);
		this.add_funcs(ans,['ABS','ATN','CHR$','COS','EXP','INT','LOG','PDL','PEEK','RND','SGN','SIN','SPC','SQR',
			'STR$','TAB','TAN','USR'],'aexpr');
		this.add_funcs(ans,['ASC','LEN','VAL'],'sexpr');
		this.add_funcs(ans,['FRE','POS'],'expr');
		this.add_procs(ans,['CALL','COLOR =','HCOLOR =','HIMEM:','HTAB','IN#','LOMEM:','PR#',
			'ROT =','SCALE =','SPEED =','VTAB'],'aexpr');

		this.add_snippet(ans, 'CALL special (enter, space)', 'CALL');

		this.add_snippet(ans, 'DEF FN name (name) = aexpr', 'DEF FN ${1:name} (${2:dummy variable}) = ${0:aexpr}');
	
		this.add_snippet(ans, 'DEL linenum,linenum', 'DEL ${1:first},${0:last}');

		this.add_snippet(ans, 'DIM name (subscript)', 'DIM ${1:name} (${0:subscript})');

		this.add_snippet(ans, 'DRAW aexpr', 'DRAW ${0:shape}');
		this.add_snippet(ans, 'DRAW aexpr AT aexpr,aexpr', 'DRAW ${1:shape} AT ${2:x},${0:y}');

		this.add_snippet(ans, 'FOR index = first TO last: statement: NEXT', 'FOR ${1:I} = ${2:1} TO ${3:last}: ${0}: NEXT');
		this.add_snippet(ans, 'FOR index = first TO last STEP s: statement: NEXT', 'FOR ${1:I} = ${2:1} TO ${3:last} STEP ${4:step}: ${0}: NEXT');

		this.add_snippet(ans, 'FN name (aexpr)', 'FN ${1:name} (${0:aexpr})');

		this.add_snippet(ans, 'GET var', 'GET ${0:var}');

		this.add_snippet(ans, 'GOSUB linenum', 'GOSUB ${0:linenum}');

		this.add_snippet(ans, 'GOTO linenum', 'GOTO ${0:linenum}');

		this.add_snippet(ans, 'HLIN aexpr,aexpr AT aexpr', 'HLIN ${1:x1},${2:x2} AT ${0:y}');

		this.add_snippet(ans, 'HPLOT aexpr,aexpr', 'HPLOT ${1:x},${0:y}');
		this.add_snippet(ans, 'HPLOT TO aexpr,aexpr', 'HPLOT TO ${1:x},${0:y}');
		this.add_snippet(ans, 'HPLOT aexpr,aexpr TO aexpr,aexpr', 'HPLOT ${1:x},${2:y} TO ${3:x},${0:y}');

		this.add_snippet(ans, 'IF expr THEN statement', 'IF ${1} THEN ${0}');

		this.add_snippet(ans, 'LEFT$ (sexpr,aexpr)', 'LEFT$ (${1:sexpr},${0:length})');

		this.add_snippet(ans, 'LET var = expr', 'LET ${1:var} = ${0:expr}');
		
		this.add_snippet(ans, 'LIST linenum, linenum', 'LIST ${1:first}, ${0:last}');

		this.add_snippet(ans, 'MID$ (sexpr,aexpr,aexpr)', 'MID$ (${1:sexpr},${2:start},${0:length})');

		this.add_snippet(ans, 'ON aexpr GOTO|GOSUB linenum', 'ON ${1:aexpr} ${2|GOTO,GOSUB|} ${0:linenum}');

		this.add_snippet(ans, 'ONERR GOTO linenum', 'ONERR GOTO ${0:linenum}');

		this.add_snippet(ans, 'PEEK (special) (enter, space)', 'PEEK');

		this.add_snippet(ans, 'PLOT aexpr,aexpr', 'PLOT ${1:x},${0:y}');

		this.add_snippet(ans, 'POKE aexpr,aexpr', 'POKE ${1:addr},${0:val}');

		this.add_snippet(ans, 'POKE special (enter, space)', 'POKE');
		
		this.add_snippet(ans, 'RIGHT$ (sexpr,aexpr)', 'RIGHT$ (${1:sexpr},${0:length})');

		this.add_snippet(ans, 'SCRN (aexpr,aexpr)', 'SCRN (${1:x},${0:y})');

		this.add_snippet(ans, 'VLIN aexpr,aexpr AT aexpr', 'VLIN ${1:y1},${2:y2} AT ${0:x}');

		this.add_snippet(ans, 'WAIT aexpr,aexpr,aexpr', 'WAIT ${1:addr},${2:mask},${0:expected}');

		this.add_snippet(ans, 'XDRAW aexpr', 'XDRAW ${0:shape}');
		this.add_snippet(ans, 'XDRAW aexpr AT aexpr,aexpr', 'XDRAW ${1:shape} AT ${2:x},${0:y}');

		return ans;
	}
}
