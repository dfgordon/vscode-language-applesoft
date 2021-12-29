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
	add_simple(ans: Array<vscode.CompletionItem>,a2tok: string[])
	{
		a2tok.forEach(s =>
		{
			ans.push(new vscode.CompletionItem(s));
		});
	}
	add_funcs(ans: Array<vscode.CompletionItem>,a2tok: string[],expr_typ: string)
	{
		a2tok.forEach(s =>
		{
			ans.push(new vscode.CompletionItem(s+' ('+expr_typ+')'));
			ans[ans.length-1].insertText = new vscode.SnippetString(s+'(${0})');
		});
	}
	add_procs(ans: Array<vscode.CompletionItem>,a2tok: string[],expr_typ: string)
	{
		a2tok.forEach(s =>
		{
			ans.push(new vscode.CompletionItem(s+' '+expr_typ));
			ans[ans.length-1].insertText = new vscode.SnippetString(s+' ${0}');
		});
	}
	provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext)
	{
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

		ans.push(new vscode.CompletionItem('DEF FN name (name) = aexpr'));
		ans[ans.length-1].insertText = new vscode.SnippetString('DEF FN ${1:name} (${2:dummy variable}) = ${0:aexpr}');
	
		ans.push(new vscode.CompletionItem('DEL linenum,linenum'));
		ans[ans.length-1].insertText = new vscode.SnippetString('DEL ${1:first},${0:last}');

		ans.push(new vscode.CompletionItem('DIM name (subscript)'));
		ans[ans.length-1].insertText = new vscode.SnippetString('DIM ${1:name} (${0:subscript})');

		ans.push(new vscode.CompletionItem('DRAW aexpr'));
		ans[ans.length-1].insertText = new vscode.SnippetString('DRAW ${0:shape}');
		ans.push(new vscode.CompletionItem('DRAW aexpr AT aexpr,aexpr'));
		ans[ans.length-1].insertText = new vscode.SnippetString('DRAW ${1:shape} AT ${2:x},${0:y}');

		ans.push(new vscode.CompletionItem('FOR index = first TO last: statement: NEXT'));
		ans[ans.length-1].insertText = new vscode.SnippetString('FOR ${1:I} = ${2:1} TO ${3:last}: ${0}: NEXT');
		ans.push(new vscode.CompletionItem('FOR index = first TO last STEP s: statement: NEXT'));
		ans[ans.length-1].insertText = new vscode.SnippetString('FOR ${1:I} = ${2:1} TO ${3:last} STEP ${4:step}: ${0}: NEXT');

		ans.push(new vscode.CompletionItem('FN name (aexpr)'));
		ans[ans.length-1].insertText = new vscode.SnippetString('FN ${1:name} (${0:aexpr})');

		ans.push(new vscode.CompletionItem('GET var'));
		ans[ans.length-1].insertText = new vscode.SnippetString('GET ${0:var}');

		ans.push(new vscode.CompletionItem('GOSUB linenum'));
		ans[ans.length-1].insertText = new vscode.SnippetString('GOSUB ${0:linenum}');

		ans.push(new vscode.CompletionItem('GOTO linenum'));
		ans[ans.length-1].insertText = new vscode.SnippetString('GOTO ${0:linenum}');

		ans.push(new vscode.CompletionItem('HLIN aexpr,aexpr AT aexpr'));
		ans[ans.length-1].insertText = new vscode.SnippetString('HLIN ${1:x1},${2:x2} AT ${0:y}');

		ans.push(new vscode.CompletionItem('HPLOT aexpr,aexpr'));
		ans[ans.length-1].insertText = new vscode.SnippetString('HPLOT ${1:x},${0:y}');
		ans.push(new vscode.CompletionItem('HPLOT TO aexpr,aexpr'));
		ans[ans.length-1].insertText = new vscode.SnippetString('HPLOT TO ${1:x},${0:y}');
		ans.push(new vscode.CompletionItem('HPLOT aexpr,aexpr TO aexpr,aexpr'));
		ans[ans.length-1].insertText = new vscode.SnippetString('HPLOT ${1:x},${2:y} TO ${3:x},${0:y}');

		ans.push(new vscode.CompletionItem('IF expr THEN statement'));
		ans[ans.length-1].insertText = new vscode.SnippetString('IF ${1} THEN ${0}');

		ans.push(new vscode.CompletionItem('LEFT$ (sexpr,aexpr)'));
		ans[ans.length-1].insertText = new vscode.SnippetString('LEFT$ (${1:sexpr},${0:length})');

		ans.push(new vscode.CompletionItem('LET var = expr'));
		ans[ans.length-1].insertText = new vscode.SnippetString('LET ${1:var} = ${0:expr}');
		
		ans.push(new vscode.CompletionItem('LIST linenum, linenum'));
		ans[ans.length-1].insertText = new vscode.SnippetString('LIST ${1:first}, ${0:last}');

		ans.push(new vscode.CompletionItem('MID$ (sexpr,aexpr,aexpr)'));
		ans[ans.length-1].insertText = new vscode.SnippetString('MID$ (${1:sexpr},${2:start},${0:length})');

		ans.push(new vscode.CompletionItem('ON aexpr GOTO|GOSUB linenum'));
		ans[ans.length-1].insertText = new vscode.SnippetString('ON ${1:aexpr} ${2|GOTO,GOSUB|} ${0:linenum}');

		ans.push(new vscode.CompletionItem('ONERR GOTO linenum'));
		ans[ans.length-1].insertText = new vscode.SnippetString('ONERR GOTO ${0:linenum}');

		ans.push(new vscode.CompletionItem('PLOT aexpr,aexpr'));
		ans[ans.length-1].insertText = new vscode.SnippetString('PLOT ${1:x},${0:y}');

		ans.push(new vscode.CompletionItem('POKE aexpr,aexpr'));
		ans[ans.length-1].insertText = new vscode.SnippetString('POKE ${1:addr},${0:val}');
		
		ans.push(new vscode.CompletionItem('RIGHT$ (sexpr,aexpr)'));
		ans[ans.length-1].insertText = new vscode.SnippetString('RIGHT$ (${1:sexpr},${0:length})');

		ans.push(new vscode.CompletionItem('SCRN (aexpr,aexpr)'));
		ans[ans.length-1].insertText = new vscode.SnippetString('SCRN (${1:x},${0:y})');

		ans.push(new vscode.CompletionItem('VLIN aexpr,aexpr AT aexpr'));
		ans[ans.length-1].insertText = new vscode.SnippetString('VLIN ${1:y1},${2:y2} AT ${0:x}');

		ans.push(new vscode.CompletionItem('WAIT aexpr,aexpr,aexpr'));
		ans[ans.length-1].insertText = new vscode.SnippetString('WAIT ${1:addr},${2:mask},${0:expected}');

		ans.push(new vscode.CompletionItem('XDRAW aexpr'));
		ans[ans.length-1].insertText = new vscode.SnippetString('XDRAW ${0:shape}');
		ans.push(new vscode.CompletionItem('XDRAW aexpr AT aexpr,aexpr'));
		ans[ans.length-1].insertText = new vscode.SnippetString('XDRAW ${1:shape} AT ${2:x},${0:y}');

		return ans;
	}
}
