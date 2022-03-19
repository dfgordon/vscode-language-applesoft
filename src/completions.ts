import * as vscode from 'vscode';
import * as specialAddresses from './specialAddresses.json';

export class LineCompletionProvider implements vscode.CompletionItemProvider
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
	provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext)
	{
		if (document.lineAt(position).text.trim().length==0)
		{
			let step = 10;
			const prevNum = this.get_linenum(document.lineAt(position.line-1).text);
			if (prevNum==-1)
				return undefined;
			const prevPrevNum = this.get_linenum(document.lineAt(position.line-2).text);
			if (prevPrevNum!=-1)
				step = prevNum - prevPrevNum;
			return [new vscode.CompletionItem((prevNum + step).toString()+' ',vscode.CompletionItemKind.Constant)];
		}
		return undefined;
	}
}

export class AddressCompletionProvider implements vscode.CompletionItemProvider
{
	pokeCompletions : Array<vscode.CompletionItem>;
	peekCompletions : Array<vscode.CompletionItem>;
	callCompletions : Array<vscode.CompletionItem>;
	negativeAddr: boolean | undefined;
	constructor()
	{
		this.pokeCompletions = new Array<vscode.CompletionItem>();
		this.peekCompletions = new Array<vscode.CompletionItem>();
		this.callCompletions = new Array<vscode.CompletionItem>();
		this.rebuild();
	}
	rebuild()
	{
		this.pokeCompletions = new Array<vscode.CompletionItem>();
		this.peekCompletions = new Array<vscode.CompletionItem>();
		this.callCompletions = new Array<vscode.CompletionItem>();
		const config = vscode.workspace.getConfiguration('applesoft');
		this.negativeAddr = config.get('completions.negativeAddresses');
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
	get_completion_item(addr: string,prefix: string,postfix: string) : vscode.CompletionItem
	{
		const addr_entry = Object(specialAddresses)[addr];
		let num_addr = parseInt(addr);
		num_addr = num_addr<0 && !this.negativeAddr ? num_addr+2**16 : num_addr;
		num_addr = num_addr>=2**15 && this.negativeAddr ? num_addr-2**16 : num_addr;
		const it = { 
			description: addr_entry.brief,
			detail: addr_entry.label,
			label: prefix + num_addr + postfix
		};
		if (!it.description)
		{
			const temp = addr_entry.desc as string;
			const temp2 = temp.lastIndexOf('.')==temp.length-1 ? temp.substring(0,temp.length-1) : temp;
			it.description = temp2;
		}
		return new vscode.CompletionItem(it,vscode.CompletionItemKind.Constant);
	}
	provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext)
	{
		let ans = new Array<vscode.CompletionItem>();

		if (position.character>4)
		{
			const l = position.line;
			const c = position.character;
			let statement = document.getText(new vscode.Range(new vscode.Position(l,0),new vscode.Position(l,c)));
			if (!vscode.workspace.getConfiguration('applesoft').get('case.caseSensitive'))
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

export class TSCompletionProvider implements vscode.CompletionItemProvider
{
	config : vscode.WorkspaceConfiguration;
	constructor()
	{
		this.config = vscode.workspace.getConfiguration('applesoft');
	}
	modify(s:string)
	{
		if (this.config.get('case.lowerCaseCompletions') && !this.config.get('case.caseSensitive'))
			return s.toLowerCase();
		else
			return s;
	}
	add_simple(ans: Array<vscode.CompletionItem>,a2tok: string[])
	{
		a2tok.forEach(s =>
		{
			ans.push(new vscode.CompletionItem(this.modify(s),vscode.CompletionItemKind.Keyword));
		});
	}
	add_funcs(ans: Array<vscode.CompletionItem>,a2tok: string[],expr_typ: string)
	{
		a2tok.forEach(s =>
		{
			s = this.modify(s);
			ans.push(new vscode.CompletionItem(s+' ('+expr_typ+')',vscode.CompletionItemKind.Function));
			ans[ans.length-1].insertText = new vscode.SnippetString(s+'(${0})');
		});
	}
	add_procs(ans: Array<vscode.CompletionItem>,a2tok: string[],expr_typ: string)
	{
		a2tok.forEach(s =>
		{
			s = this.modify(s);
			ans.push(new vscode.CompletionItem(s+' '+expr_typ,vscode.CompletionItemKind.Keyword));
			ans[ans.length-1].insertText = new vscode.SnippetString(s+' ${0}');
		});
	}
	provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext)
	{
		this.config = vscode.workspace.getConfiguration('applesoft');
		const ans = new Array<vscode.CompletionItem>();

		this.add_simple(ans,['CLEAR','CONT','DATA','END','FLASH','GR','HGR','HGR2','HOME','INPUT','INVERSE','LOAD',
			'NEW','NEXT','NORMAL','NOTRACE','POP','PRINT','READ','RECALL','REM','RESTORE','RESUME','RETURN','RUN',
			'SAVE','SHLOAD','STOP','STORE','TEXT','TRACE']);
		this.add_funcs(ans,['ABS','ATN','CHR$','COS','EXP','INT','LOG','PDL','PEEK','RND','SGN','SIN','SPC','SQR',
			'STR$','TAB','TAN','USR'],'aexpr');
		this.add_funcs(ans,['ASC','LEN','VAL'],'sexpr');
		this.add_funcs(ans,['FRE','POS'],'expr');
		this.add_procs(ans,['CALL','COLOR =','HCOLOR =','HIMEM:','HTAB','IN#','LOMEM:','PR#',
			'ROT =','SCALE =','SPEED =','VTAB'],'aexpr');

		ans.push(new vscode.CompletionItem(this.modify('CALL special (enter, space)')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('CALL'));
	
		ans.push(new vscode.CompletionItem(this.modify('DEF FN name (name) = aexpr')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('DEF FN ${1:name} (${2:dummy variable}) = ${0:aexpr}'));
	
		ans.push(new vscode.CompletionItem(this.modify('DEL linenum,linenum')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('DEL ${1:first},${0:last}'));

		ans.push(new vscode.CompletionItem(this.modify('DIM name (subscript)')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('DIM ${1:name} (${0:subscript})'));

		ans.push(new vscode.CompletionItem(this.modify('DRAW aexpr')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('DRAW ${0:shape}'));
		ans.push(new vscode.CompletionItem(this.modify('DRAW aexpr AT aexpr,aexpr')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('DRAW ${1:shape} AT ${2:x},${0:y}'));

		ans.push(new vscode.CompletionItem(this.modify('FOR index = first TO last: statement: NEXT')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('FOR ${1:I} = ${2:1} TO ${3:last}: ${0}: NEXT'));
		ans.push(new vscode.CompletionItem(this.modify('FOR index = first TO last STEP s: statement: NEXT')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('FOR ${1:I} = ${2:1} TO ${3:last} STEP ${4:step}: ${0}: NEXT'));

		ans.push(new vscode.CompletionItem(this.modify('FN name (aexpr)')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('FN ${1:name} (${0:aexpr})'));

		ans.push(new vscode.CompletionItem(this.modify('GET var')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('GET ${0:var}'));

		ans.push(new vscode.CompletionItem(this.modify('GOSUB linenum')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('GOSUB ${0:linenum}'));

		ans.push(new vscode.CompletionItem(this.modify('GOTO linenum')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('GOTO ${0:linenum}'));

		ans.push(new vscode.CompletionItem(this.modify('HLIN aexpr,aexpr AT aexpr')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('HLIN ${1:x1},${2:x2} AT ${0:y}'));

		ans.push(new vscode.CompletionItem(this.modify('HPLOT aexpr,aexpr')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('HPLOT ${1:x},${0:y}'));
		ans.push(new vscode.CompletionItem(this.modify('HPLOT TO aexpr,aexpr')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('HPLOT TO ${1:x},${0:y}'));
		ans.push(new vscode.CompletionItem(this.modify('HPLOT aexpr,aexpr TO aexpr,aexpr')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('HPLOT ${1:x},${2:y} TO ${3:x},${0:y}'));

		ans.push(new vscode.CompletionItem(this.modify('IF expr THEN statement')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('IF ${1} THEN ${0}'));

		ans.push(new vscode.CompletionItem(this.modify('LEFT$ (sexpr,aexpr)')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('LEFT$ (${1:sexpr},${0:length})'));

		ans.push(new vscode.CompletionItem(this.modify('LET var = expr')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('LET ${1:var} = ${0:expr}'));
		
		ans.push(new vscode.CompletionItem(this.modify('LIST linenum, linenum')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('LIST ${1:first}, ${0:last}'));

		ans.push(new vscode.CompletionItem(this.modify('MID$ (sexpr,aexpr,aexpr)')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('MID$ (${1:sexpr},${2:start},${0:length})'));

		ans.push(new vscode.CompletionItem(this.modify('ON aexpr GOTO|GOSUB linenum')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('ON ${1:aexpr} ${2|GOTO,GOSUB|} ${0:linenum}'));

		ans.push(new vscode.CompletionItem(this.modify('ONERR GOTO linenum')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('ONERR GOTO ${0:linenum}'));

		ans.push(new vscode.CompletionItem(this.modify('PEEK (special) (enter, space)')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('PEEK'));

		ans.push(new vscode.CompletionItem(this.modify('PLOT aexpr,aexpr')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('PLOT ${1:x},${0:y}'));

		ans.push(new vscode.CompletionItem(this.modify('POKE aexpr,aexpr')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('POKE ${1:addr},${0:val}'));

		ans.push(new vscode.CompletionItem(this.modify('POKE special (enter, space)')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('POKE'));
		
		ans.push(new vscode.CompletionItem(this.modify('RIGHT$ (sexpr,aexpr)')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('RIGHT$ (${1:sexpr},${0:length})'));

		ans.push(new vscode.CompletionItem(this.modify('SCRN (aexpr,aexpr)')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('SCRN (${1:x},${0:y})'));

		ans.push(new vscode.CompletionItem(this.modify('VLIN aexpr,aexpr AT aexpr')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('VLIN ${1:y1},${2:y2} AT ${0:x}'));

		ans.push(new vscode.CompletionItem(this.modify('WAIT aexpr,aexpr,aexpr')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('WAIT ${1:addr},${2:mask},${0:expected}'));

		ans.push(new vscode.CompletionItem(this.modify('XDRAW aexpr')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('XDRAW ${0:shape}'));
		ans.push(new vscode.CompletionItem(this.modify('XDRAW aexpr AT aexpr,aexpr')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('XDRAW ${1:shape} AT ${2:x},${0:y}'));

		return ans;
	}
}
