import * as vscode from 'vscode';
//import * as Parser from 'web-tree-sitter';

export class LineCompletionProvider implements vscode.CompletionItemProvider
{
	get_linenum(line: string) : number
	{
		const nums = line.match(/^[0-9]+/);
		if (nums)
			if (nums.length>0)
			{
				const num = parseInt(nums[0]);
				if (!isNaN(num))
					return num;
			}
		return -1;
	}
	provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext)
	{
		const linePrefix = document.lineAt(position).text.substring(0,position.character);
		if (document.positionAt(0) && document.lineAt(position).text.length==0)
		{
			let step = 10;
			const prevNum = this.get_linenum(document.lineAt(position.line-1).text);
			if (prevNum==-1)
				return undefined;
			const prevPrevNum = this.get_linenum(document.lineAt(position.line-2).text);
			if (prevPrevNum!=-1)
				step = prevNum - prevPrevNum;
			return [new vscode.CompletionItem((prevNum + step).toString()+' ')];
		}
		return undefined;
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
		if (this.config.get('lowerCaseCompletions') && !this.config.get('caseSensitive'))
			return s.toLowerCase();
		else
			return s;
	}
	add_simple(ans: Array<vscode.CompletionItem>,a2tok: string[])
	{
		a2tok.forEach(s =>
		{
			ans.push(new vscode.CompletionItem(this.modify(s)));
		});
	}
	add_funcs(ans: Array<vscode.CompletionItem>,a2tok: string[],expr_typ: string)
	{
		a2tok.forEach(s =>
		{
			s = this.modify(s);
			ans.push(new vscode.CompletionItem(s+' ('+expr_typ+')'));
			ans[ans.length-1].insertText = new vscode.SnippetString(s+'(${0})');
		});
	}
	add_procs(ans: Array<vscode.CompletionItem>,a2tok: string[],expr_typ: string)
	{
		a2tok.forEach(s =>
		{
			s = this.modify(s);
			ans.push(new vscode.CompletionItem(s+' '+expr_typ));
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

		ans.push(new vscode.CompletionItem(this.modify('PLOT aexpr,aexpr')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('PLOT ${1:x},${0:y}'));

		ans.push(new vscode.CompletionItem(this.modify('POKE aexpr,aexpr')));
		ans[ans.length-1].insertText = new vscode.SnippetString(this.modify('POKE ${1:addr},${0:val}'));
		
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
