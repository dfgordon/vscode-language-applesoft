import * as vscode from 'vscode';
import * as Parser from 'web-tree-sitter';
import { AddressHovers } from './hoversAddresses';
import { StatementHovers } from './hoversStatements';
import * as lxbase from './langExtBase';

export class TSHoverProvider extends lxbase.LangExtBase implements vscode.HoverProvider
{
	addresses = new AddressHovers();
	statements = new StatementHovers();
	hover = new Array<vscode.MarkdownString>();
	position = new vscode.Position(0,0);
	range = new vscode.Range(new vscode.Position(0,0),new vscode.Position(0,0));

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
	get_hover(curs:Parser.TreeCursor) : lxbase.WalkerChoice
	{
		this.range = this.curs_to_range(curs);
		if (this.range.contains(this.position))
		{
			if (this.config.get('hovers.specialAddresses'))
				if (this.addr_hover(this.hover,curs))
					return lxbase.WalkerOptions.exit;
			if (this.config.get('hovers.keywords'))
			{
				const temp = this.statements.get(curs.nodeType);
				if (temp)
				{
					temp.forEach(s => this.hover.push(s));
					return lxbase.WalkerOptions.exit;
				}
			}
			return lxbase.WalkerOptions.gotoChild;
		}
		return lxbase.WalkerOptions.gotoChild;
	}
	provideHover(document:vscode.TextDocument,position: vscode.Position,token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover>
	{
		this.hover = new Array<vscode.MarkdownString>();
		this.position = position;
		const tree = this.parse(document.getText()+"\n");
		this.walk(tree,this.get_hover.bind(this));
		if (this.hover.length>0)
			return new vscode.Hover(this.hover,this.range);
		else
			return undefined;
	}
}