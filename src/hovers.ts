import * as vscode from 'vscode';
import * as Parser from 'web-tree-sitter';
import { AddressHovers } from './hoversAddresses';
import { StatementHovers } from './hoversStatements';
import { LangExtBase } from './langExtBase';

export class TSHoverProvider extends LangExtBase implements vscode.HoverProvider
{
	addresses = new AddressHovers();
	statements = new StatementHovers();

	addr_hover(hover:Array<vscode.MarkdownString>,curs:Parser.TreeCursor) : boolean
	{
		let mul = 1;
		if (curs.nodeType=="integer")
		{
			let cmd = curs.currentNode().previousNamedSibling;
			const prev = curs.currentNode().previousNamedSibling;
			if (prev)
			{
				if (prev.type=="minus_tok" || prev.type=="plus_tok")
				{
					const parent = prev.parent;
					if (parent)
						if (parent.type=="unary_aexpr")
						{
							mul *= prev.type=="minus_tok" ? -1 : 1;
							cmd = parent.previousNamedSibling;
						}
					
				}
			}
			if (cmd)
				if (cmd.type=="poke_tok" || cmd.type=="peek_tok" || cmd.type=="call_tok")
				{
					let parsed = parseInt(curs.nodeText.replace(/ /g,''));
					if (!isNaN(parsed))
					{
						parsed *= mul;
						if (parsed>=2**15)
							parsed = parsed - 2**16;
						const temp = this.addresses.get(parsed);
						if (temp)
						{
							temp.forEach(s => hover.push(s));
							return true;
						}
					}
				}
		}
		return false;
	}
	get_hover(hover:Array<vscode.MarkdownString>,curs:Parser.TreeCursor,position:vscode.Position) : boolean
	{
		const rng = this.curs_to_range(curs);
		if (rng.contains(position))
		{
			if (this.config.get('hovers.specialAddresses'))
				if (this.addr_hover(hover,curs))
					return false;
			if (this.config.get('hovers.keywords'))
			{
				const temp = this.statements.get(curs.nodeType);
				if (temp)
				{
					temp.forEach(s => hover.push(s));
					return false;
				}
			}
			return true;
		}
		return false;
	}
	provideHover(document:vscode.TextDocument,position: vscode.Position,token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover>
	{
		const hover = new Array<vscode.MarkdownString>();
		const tree = this.parse(document.getText()+"\n");
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