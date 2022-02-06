import * as vscode from 'vscode';
import * as Parser from 'web-tree-sitter';
import * as path from 'path';

function get_lang_path(caseSens: boolean|undefined) : string
{
	let lang = 'tree-sitter-applesoft';
	if (caseSens)
		lang += 'casesens';
	return path.join(__dirname,'..',lang+'.wasm');
}

export async function TreeSitterInit(): Promise<[Parser,Parser.Language,Parser.Language,boolean]>
{
	const config = vscode.workspace.getConfiguration('applesoft');
	const caseSens = (c => c==undefined?false:c)(config.get('case.caseSensitive')); 
	await Parser.init();
	const parser = new Parser();
	const Applesoft = await Parser.Language.load(get_lang_path(false));
	const ApplesoftCaseSens = await Parser.Language.load(get_lang_path(true));
	if (caseSens)
		parser.setLanguage(ApplesoftCaseSens);
	else
		parser.setLanguage(Applesoft);
	return [parser,Applesoft,ApplesoftCaseSens,caseSens];
}

export class LangExtBase
{
	parser : Parser;
	Applesoft : Parser.Language;
	ApplesoftCaseSens : Parser.Language;
	config : vscode.WorkspaceConfiguration;
	caseSens: boolean;
	constructor(TSInitResult : [Parser,Parser.Language,Parser.Language,boolean])
	{
		this.parser = TSInitResult[0];
		this.Applesoft = TSInitResult[1];
		this.ApplesoftCaseSens = TSInitResult[2];
		this.caseSens = TSInitResult[3];
		this.config = vscode.workspace.getConfiguration('applesoft');
	}
	curs_to_range(curs: Parser.TreeCursor): vscode.Range
	{
		const start_pos = new vscode.Position(curs.startPosition.row,curs.startPosition.column);
		const end_pos = new vscode.Position(curs.endPosition.row,curs.endPosition.column);
		return new vscode.Range(start_pos,end_pos);
	}
	parse(txt: string) : Parser.Tree
	{
		this.config = vscode.workspace.getConfiguration('applesoft');
		const caseSens = (c => c==undefined?false:c)(this.config.get('case.caseSensitive')); 
		if (caseSens!=this.caseSens)
		{
			this.caseSens = caseSens;
			if (caseSens)
				this.parser.setLanguage(this.ApplesoftCaseSens);
			else
				this.parser.setLanguage(this.Applesoft);
		}
		return this.parser.parse(txt);
	}
}

export class LineNumberTool
{
	syntaxTree : Parser.Tree;
	nums : Array<number>;
	rngs : Array<vscode.Range>;
	leading_space : Array<number>;
	trailing_space : Array<number>;
	constructor(tree: Parser.Tree)
	{
		// leaves nums and rngs with only *primary* line numbers
		this.syntaxTree = tree;
		this.nums = new Array<number>();
		this.rngs = new Array<vscode.Range>();
		this.leading_space = new Array<number>();
		this.trailing_space = new Array<number>();
		const curs = this.syntaxTree.walk();
		let finished = false;
		if (curs.gotoFirstChild()) // line
			do
			{
				if (curs.gotoFirstChild()) // line number
				{
					this.record(curs);
					curs.gotoParent();
				}
				if (!curs.gotoNextSibling())
					finished = true;
			} while (!finished);
	}
	curs_to_range(curs: Parser.TreeCursor): vscode.Range
	{
		const start_pos = new vscode.Position(curs.startPosition.row,curs.startPosition.column);
		const end_pos = new vscode.Position(curs.endPosition.row,curs.endPosition.column);
		return new vscode.Range(start_pos,end_pos);
	}
	record(curs: Parser.TreeCursor)
	{
		if (curs.nodeType=="linenum")
		{
			const rng = this.curs_to_range(curs);
			const leading = curs.nodeText.length - curs.nodeText.trimLeft().length;
			const trailing = curs.nodeText.length - curs.nodeText.trimRight().length;
			const parsed = parseInt(curs.nodeText.replace(/ /g,''));
			if (!isNaN(parsed))
			{
				this.nums.push(parsed);
				this.rngs.push(rng);
				this.leading_space.push(leading);
				this.trailing_space.push(trailing);
			}
		}
	}
	get_nums() : Array<number>
	{
		return this.nums;
	}
	renumber(mapping: Map<number,number>,editBuilder: vscode.TextEditorEdit)
	{
		// clear the primary line number data
		this.nums = new Array<number>();
		this.rngs = new Array<vscode.Range>();
		this.leading_space = new Array<number>();
		this.trailing_space = new Array<number>();
		// walk the entire tree to load the full line number data (including statement refs)
		const curs = this.syntaxTree.walk();
		let recurse = true;
		let finished = false;
		do
		{
			if (recurse && curs.gotoFirstChild())
				this.record(curs);
			else
			{
				recurse = true;
				if (curs.gotoNextSibling())
					this.record(curs);
				else if (curs.gotoParent())
					recurse = false;
				else
					finished = true;
			}
		} while (!finished);
		// apply the mapping
		for (let i=0;i<this.nums.length;i++)
		{
			const new_num =  mapping.get(this.nums[i]);
			if (new_num!=undefined)
			{
				let fmt_num = ' '.repeat(this.leading_space[i]);
				fmt_num += new_num.toString();
				fmt_num += ' '.repeat(this.trailing_space[i]);
				editBuilder.replace(this.rngs[i],fmt_num);
			}
		}
	}
	add_diagnostics(diag: Array<vscode.Diagnostic>)
	{
		const n = this.nums.length;
		for (let i=1;i<n;i++)
			if (this.nums[i]<=this.nums[i-1])
				diag.push(new vscode.Diagnostic(this.rngs[i],'Line number out of order'));
	}
}
