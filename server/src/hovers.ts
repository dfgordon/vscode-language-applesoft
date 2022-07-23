import * as vsserv from 'vscode-languageserver/node';
import * as vsdoc from 'vscode-languageserver-textdocument';
import Parser from 'web-tree-sitter';
import { AddressHovers } from './hoversAddresses';
import { StatementHovers } from './hoversStatements';
import * as lxbase from './langExtBase';

export class TSHoverProvider extends lxbase.LangExtBase
{
	addresses = new AddressHovers();
	statements = new StatementHovers();
	hover = new Array<vsserv.MarkupContent>();
	position = vsserv.Position.create(0,0);
	range = vsserv.Range.create(vsserv.Position.create(0,0),vsserv.Position.create(0,0));

	addr_hover(hover:Array<vsserv.MarkupContent>,curs:Parser.TreeCursor) : boolean
	{
		let mul = 1;
		if (curs.nodeType=="int")
		{
			let cmd = curs.currentNode().previousNamedSibling;
			const prev = curs.currentNode().previousNamedSibling;
			if (prev)
			{
				if (prev.type=="tok_minus" || prev.type=="tok_plus")
				{
					const parent = prev.parent;
					if (parent)
						if (parent.type=="unary_aexpr")
						{
							mul *= prev.type=="tok_minus" ? -1 : 1;
							cmd = parent.previousNamedSibling;
						}
					
				}
			}
			if (cmd)
				if (cmd.type=="tok_poke" || cmd.type=="tok_peek" || cmd.type=="tok_call")
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
		this.range = lxbase.curs_to_range(curs);
		if (lxbase.rangeContainsPos(this.range,this.position))
		{
			if (this.config.hovers.specialAddresses)
				if (this.addr_hover(this.hover,curs))
					return lxbase.WalkerOptions.exit;
			if (this.config.hovers.keywords)
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
	provideHover(document: vsdoc.TextDocument | undefined ,position: vsserv.Position): vsserv.Hover | undefined
	{
		if (!document)
			return undefined;
		this.hover = new Array<vsserv.MarkupContent>();
		this.position = position;
		const tree = this.parse(document.getText(),"\n");
		this.walk(tree,this.get_hover.bind(this));
		if (this.hover.length < 1)
			return undefined;
		const content : string[] = [];
		this.hover.forEach(h => {
			content.push(h.value);
		});
		return {contents: content.join('\n\n---\n\n'), range: this.range};
	}
}