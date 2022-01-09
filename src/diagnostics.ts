import * as vscode from 'vscode';
import * as Parser from 'web-tree-sitter';

// Warn against long name variables with same first two characters
class VariableNameSentry
{
	vars : Set<string>;
	shortnames : Map<string,Set<string>>;

	constructor()
	{
		this.vars = new Set<string>();
		this.shortnames = new Map<string,Set<string>>();
	}
	add(curs: Parser.TreeCursor): string
	{
		const varname = curs.nodeText;
		const colliding = [];
		const parts = varname.replace(/ /g,'').split(/([$%()])/);
		const basename = parts[0];
		let trimmed = basename;
		["$","%","(",")"].forEach(s => trimmed += parts.indexOf(s)>-1 ? s : "" );
		this.vars.add(trimmed);
		if (basename.length>2)
		{
			let key = basename.substring(0,2).toUpperCase();
			["$","%","(",")"].forEach(s => key += parts.indexOf(s)>-1 ? s : "" );

			if (this.shortnames.has(key))
			{
				let vals = this.shortnames.get(key);
				if (vals)
					vals.add(trimmed);
				else
					vals = new Set([trimmed]);
				this.shortnames.set(key,vals);
				for (const value of vals)
					colliding.push(value);
			}
			else
			{
				this.shortnames.set(key,new Set([trimmed]));
			}
		}
		if (colliding.length>1)
		{
			let s = "variable name collision:\n";
			for (const c of colliding)
				s += c + ",";
			return s.substring(0,s.length-1);
		}
		return "";
	}
}

// Apparently no standard provider, so make one up
export class TSDiagnosticProvider
{
	parser : Parser;

	constructor(parser: Parser)
	{
		this.parser = parser;
	}
	curs_to_range(curs: Parser.TreeCursor): vscode.Range
	{
		const start_pos = new vscode.Position(curs.startPosition.row,curs.startPosition.column);
		const end_pos = new vscode.Position(curs.endPosition.row,curs.endPosition.column);
		return new vscode.Range(start_pos,end_pos);
	}
	node_to_range(node: Parser.SyntaxNode): vscode.Range
	{
		const start_pos = new vscode.Position(node.startPosition.row,node.startPosition.column);
		const end_pos = new vscode.Position(node.endPosition.row,node.endPosition.column);
		return new vscode.Range(start_pos,end_pos);
	}
	value_range(diag: Array<vscode.Diagnostic>,node: Parser.SyntaxNode,low:number,high:number)
	{
		if (node.type!="integer" && node.type!="real")
			return;
		const rng = this.node_to_range(node);
		const parsed = parseInt(node.text);
		if (!isNaN(parsed))
			if (parsed<low || parsed>high)
				diag.push(new vscode.Diagnostic(rng,'Out of range ('+low+','+high+')'));
	}
	is_error_inside(node: Parser.SyntaxNode): boolean
	{
		let child = node.firstChild;
		if (child)
		{
			do
			{
				if (child.hasError())
					return true;
				child = child.nextNamedSibling;
			} while (child);
		}
		return false;
	}
	process_node(diag: Array<vscode.Diagnostic>,nums: Array<number>,vars: VariableNameSentry,curs: Parser.TreeCursor): boolean
	{
		const rng = this.curs_to_range(curs);
		if (curs.currentNode().hasError())
		{
			if (!this.is_error_inside(curs.currentNode()))
				diag.push(new vscode.Diagnostic(rng,curs.currentNode().toString(),vscode.DiagnosticSeverity.Error));
		}
		if (["realvar","intvar","svar","real_scalar","int_scalar"].indexOf(curs.nodeType)>-1)
		{
			const s = vars.add(curs);
			if (s.length>0)
				diag.push(new vscode.Diagnostic(rng,s,vscode.DiagnosticSeverity.Warning));
		}
		if (curs.nodeType=="line")
		{
			if (curs.currentNode().text.trimEnd().length>239)
				diag.push(new vscode.Diagnostic(rng,'Maximum length of a line is 239'));
		}
		if (curs.nodeType=="linenum")
		{
			const parsed = parseInt(curs.nodeText);
			if (isNaN(parsed))
				diag.push(new vscode.Diagnostic(rng,'Line number is not a number')); // should not happen
			else if (parsed<0 || parsed>63999)
				diag.push(new vscode.Diagnostic(rng,'Out of range (0,63999)'));
			else if (nums.indexOf(parsed)==-1 && curs.currentNode().previousNamedSibling)
				diag.push(new vscode.Diagnostic(rng,'Line does not exist'));
		}
		if (curs.nodeType=="poke_tok")
		{
			const addr = curs.currentNode().nextNamedSibling;
			if (addr)
			{
				this.value_range(diag,addr,-32767,65535);
				const byte = addr.nextNamedSibling;
				if (byte)
					this.value_range(diag,byte,0,255);
			}
		}
		if (curs.nodeType=="peek_tok")
		{
			const addr = curs.currentNode().nextNamedSibling;
			if (addr)
				this.value_range(diag,addr,-32767,65535);
		}
		if (["call_tok","himem_tok","lomem_tok"].indexOf(curs.nodeType)>-1)
		{
			const addr = curs.currentNode().nextNamedSibling;
			if (addr)
				this.value_range(diag,addr,-32767,65535);
		}
		if (["coloreq_tok","speedeq_tok"].indexOf(curs.nodeType)>-1)
		{
			const byte = curs.currentNode().nextNamedSibling;
			if (byte)
				this.value_range(diag,byte,0,255);
		}
		if (curs.nodeType=="hcoloreq_tok")
		{
			const v = curs.currentNode().nextNamedSibling;
			if (v)
				this.value_range(diag,v,0,7);
		}
		if (curs.nodeType=="wait_tok")
		{
			const addr = curs.currentNode().nextNamedSibling;
			if (addr)
			{
				this.value_range(diag,addr,-32767,65535);
				const mask = addr.nextNamedSibling;
				if (mask)
				{
					this.value_range(diag,mask,0,255);
					const val = mask.nextNamedSibling;
					if (val)
						this.value_range(diag,val,0,255);
				}
			}
		}
		return true;
	}
	process_line_number(diag: Array<vscode.Diagnostic>,nums: Array<number>,curs: Parser.TreeCursor)
	{
		if (curs.nodeType=="linenum")
		{
			const rng = this.curs_to_range(curs);
			const parsed = parseInt(curs.nodeText);
			if (!isNaN(parsed))
			{
				nums.push(parsed);
				if (nums.length>1)
					if (nums[nums.length-1]<=nums[nums.length-2])
						diag.push(new vscode.Diagnostic(rng,'Line number out of order'));
			}
		}
	}
	update(document : vscode.TextDocument, collection: vscode.DiagnosticCollection): void
	{
		if (document && document.languageId=='applesoft')
		{
			const vars = new VariableNameSentry();
			const line_numbers = Array<number>();
			const diag = Array<vscode.Diagnostic>();
			const syntaxTree = this.parser.parse(document.getText()+"\n");
			const cursor = syntaxTree.walk();
			// First gather and check the line numbers
			let recurse = true;
			let finished = false;
			if (cursor.gotoFirstChild()) // line
				do
				{
					if (cursor.gotoFirstChild()) // line number
					{
						this.process_line_number(diag,line_numbers,cursor);
						cursor.gotoParent();
					}
					if (!cursor.gotoNextSibling())
						finished = true;
				} while (!finished);
			// Now run general diagnostics
			cursor.reset(syntaxTree.rootNode);
			recurse = true;
			finished = false;
			do
			{
				if (recurse && cursor.gotoFirstChild())
					recurse = this.process_node(diag,line_numbers,vars,cursor);
				else
				{
					if (cursor.gotoNextSibling())
						recurse = this.process_node(diag,line_numbers,vars,cursor);
					else if (cursor.gotoParent())
						recurse = false;
					else
						finished = true;
				}
			} while (!finished);
			collection.set(document.uri, diag);
		}
		else
		{
			collection.clear();
		}
	}
}